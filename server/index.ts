import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalyzeRequest, ChatRequest, StreamEvent } from '../shared/types';
import { runDemoAnalysis, runLiveAnalysis, runLocalAnalysis } from './lib/analysis';
import { chunkAnswer, localAnswer } from './lib/chat';
import {
  buildChatQuestion,
  callChatText,
  modelLabel,
  resolveLLMConfig,
  selectToolCall,
  streamChatText,
  summarizeAnalysisForPrompt,
} from './lib/llm';
import { CHAT_SYSTEM, TOOL_SELECT_SYSTEM, chatUserPrompt } from './lib/prompts';
import { TOOL_DEFINITIONS, executeTool } from './lib/tools';
import { DEMO_CASES, getDemoCase } from './lib/demo';
import {
  AuthError,
  authRequired,
  clearSessionCookie,
  createSession,
  currentUser,
  demoAccountHint,
  destroySession,
  registerUser,
  verifyUser,
} from './lib/auth';
import { sleep } from './lib/text';

// 先读 .env.local，再读 .env；已存在的系统环境变量优先级最高。
dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self)');
  next();
});

// 简单的内存限流：足够防止评审期间的误触/恶意刷接口，不需要引入 Redis。
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: () => void): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > 30) {
    res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
    return;
  }
  next();
}

function sendEvent(res: Response, event: StreamEvent): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function initSSE(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function endSSE(res: Response): void {
  if (!res.writableEnded) res.end();
}

app.get('/api/health', (_req, res) => {
  const hasServerKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    hasServerKey,
    demoMode: process.env.DEMO_MODE !== 'false' || !hasServerKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    uptime: Math.round(process.uptime()),
  });
});

app.get('/api/config', (_req, res) => {
  const hasServerKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  const allowClientKey = process.env.ALLOW_CLIENT_KEY !== 'false';
  res.json({
    demoMode: process.env.DEMO_MODE !== 'false' || !hasServerKey,
    allowClientKey,
    hasServerKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    visionEnabled: Boolean(process.env.VISION_API_KEY?.trim()),
    authRequired: authRequired(),
    demoAccount: demoAccountHint(),
    capabilities: {
      streaming: true,
      functionCalling: true,
      rag: true,
      vision: Boolean(process.env.VISION_API_KEY?.trim()),
    },
  });
});

app.post('/api/auth/login', rateLimit, (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ ok: false, error: '请输入账号和密码。' });
    return;
  }
  const user = verifyUser(username, password);
  if (!user) {
    res.status(401).json({ ok: false, error: '账号或密码不对。评审账号见登录页提示。' });
    return;
  }
  const session = createSession(user);
  res.setHeader('Set-Cookie', session.cookie);
  res.json({ ok: true, user });
});

app.post('/api/auth/register', rateLimit, (req: Request, res: Response) => {
  const { username, password, displayName } = req.body as { username?: string; password?: string; displayName?: string };
  if (!username || !password) {
    res.status(400).json({ ok: false, error: '请输入账号和密码。' });
    return;
  }
  try {
    const user = registerUser({ username, password, displayName });
    const session = createSession(user);
    res.setHeader('Set-Cookie', session.cookie);
    res.status(201).json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败';
    const status = error instanceof AuthError ? error.status : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  res.json({ ok: true, user: currentUser(req) });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  destroySession(req);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.post('/api/test-key', rateLimit, async (req: Request, res: Response) => {
  const body = req.body as { clientKey?: string; baseUrl?: string; model?: string };
  const config = resolveLLMConfig({
    clientKey: typeof body.clientKey === 'string' ? body.clientKey : undefined,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
  });
  if (!config) {
    res.status(400).json({ ok: false, error: '没有可用的 API Key。' });
    return;
  }
  try {
    const startedAt = Date.now();
    const reply = await callChatText(config, {
      system: '你是连通性测试助手。只回复两个字：可用。',
      user: 'ping',
      temperature: 0,
      maxTokens: 16,
    });
    res.json({
      ok: true,
      model: config.model,
      source: config.source,
      latency: Date.now() - startedAt,
      reply: reply.slice(0, 40),
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : '连接失败' });
  }
});

app.get('/api/demo-cases', (_req, res) => {
  res.json({
    cases: DEMO_CASES.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      industry: item.industry,
      period: item.period,
      description: item.description,
      highlights: item.highlights,
      sourceName: item.source.name,
      charCount: item.source.charCount,
    })),
  });
});

app.post('/api/analyze', rateLimit, async (req: Request, res: Response) => {
  const body = req.body as Partial<AnalyzeRequest> & { demoCaseId?: string };
  const demoCaseId = typeof body.demoCaseId === 'string' ? body.demoCaseId : undefined;
  const hasText = typeof body.text === 'string' && body.text.trim().length >= 8;

  if (!demoCaseId && !hasText) {
    res.status(400).json({ error: '请提供至少 8 个字符的材料，或选择一个示例案例。' });
    return;
  }
  if (demoCaseId && !getDemoCase(demoCaseId)) {
    res.status(404).json({ error: '示例案例不存在。' });
    return;
  }
  if (!demoCaseId && authRequired() && !currentUser(req)) {
    res.status(401).json({ error: '请先登录，再分析自己的材料。示例案例不需要登录。' });
    return;
  }

  initSSE(res);
  const controller = new AbortController();
  let closed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true;
      controller.abort();
    }
  });

  try {
    const startedAt = Date.now();
    let result;
    if (demoCaseId) {
      result = await runDemoAnalysis(demoCaseId, {
        onStep: (step) => {
          if (!closed) sendEvent(res, { type: 'stage', step });
        },
      });
    } else {
      const config = resolveLLMConfig({
        clientKey: typeof body.clientKey === 'string' ? body.clientKey : undefined,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        model: typeof body.model === 'string' ? body.model : undefined,
      });

      if (!config) {
        sendEvent(res, {
          type: 'token',
          text: '未检测到 API Key，切换到本地启发式模式：只抽取带数字的句子，不生成新的因果判断。',
        });
        result = await runLocalAnalysis(body as AnalyzeRequest, {
          onStep: (step) => {
            if (!closed) sendEvent(res, { type: 'stage', step });
          },
        });
      } else {
        try {
          result = await runLiveAnalysis(body as AnalyzeRequest, config, {
            onStep: (step) => {
              if (!closed) sendEvent(res, { type: 'stage', step });
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : '模型分析失败';
          sendEvent(res, { type: 'error', message: `模型调用失败，已降级到本地模式：${message}` });
          result = await runLocalAnalysis(body as AnalyzeRequest, {
            onStep: (step) => {
              if (!closed) sendEvent(res, { type: 'stage', step });
            },
          });
          result.model = `Local Fallback（${message.slice(0, 48)}）`;
        }
      }
    }

    if (closed) return;
    sendEvent(res, { type: 'result', data: result });
    sendEvent(res, { type: 'done' });
    // 只在服务端日志记录耗时和模式，不打印用户材料与 Key
    console.info(
      `[analyze] mode=${result.mode} model=${result.model} claims=${result.claims.length} elapsed=${Date.now() - startedAt}ms`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败，请稍后重试。';
    console.error('[analyze] failed:', message);
    if (!closed) {
      sendEvent(res, { type: 'error', message });
      sendEvent(res, { type: 'done' });
    }
  } finally {
    endSSE(res);
  }
});

app.post('/api/chat', rateLimit, async (req: Request, res: Response) => {
  const body = req.body as Partial<ChatRequest>;
  if (!body.question || typeof body.question !== 'string' || !body.analysis || !Array.isArray(body.analysis.claims)) {
    res.status(400).json({ error: '缺少问题或看板上下文。' });
    return;
  }

  initSSE(res);
  const controller = new AbortController();
  let closed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true;
      controller.abort();
    }
  });

  const analysis = body.analysis;
  const question = buildChatQuestion(body as ChatRequest);
  const config = resolveLLMConfig({
    clientKey: typeof body.clientKey === 'string' ? body.clientKey : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
  });

  const streamLocal = async (notice?: string) => {
    if (notice) sendEvent(res, { type: 'token', text: notice });
    const local = localAnswer(question, analysis);
    for (const citation of local.citations) {
      if (closed) return;
      sendEvent(res, { type: 'citation', citation });
    }
    for (const chunk of chunkAnswer(local.answer, 5)) {
      if (closed) return;
      sendEvent(res, { type: 'token', text: chunk });
      await sleep(14);
    }
  };

  try {
    if (!config) {
      await streamLocal('当前未配置大模型，以下回答由看板内的证据与规则生成：\n\n');
      sendEvent(res, { type: 'done' });
      return;
    }

    let toolResults = '';
    const citations = [];
    try {
      const tool = await selectToolCall(config, {
        system: TOOL_SELECT_SYSTEM,
        user: `看板摘要：${summarizeAnalysisForPrompt(analysis).slice(0, 5000)}\n\n用户问题：${question}`,
        tools: TOOL_DEFINITIONS,
      });
      if (tool) {
        const execution = executeTool(tool.name, tool.args, analysis);
        sendEvent(res, { type: 'tool', stepId: 'chat', tool: execution.call });
        toolResults = execution.content;
        citations.push(...execution.citations);
      }
    } catch {
      // 工具选择失败不阻断回答
    }

    for (const citation of citations) {
      sendEvent(res, { type: 'citation', citation });
    }

    const userPrompt = chatUserPrompt({
      question,
      analysisJson: summarizeAnalysisForPrompt(analysis),
      toolResults,
      history: body.history ?? [],
    });

    let fullText = '';
    for await (const delta of streamChatText(config, {
      system: CHAT_SYSTEM,
      user: userPrompt,
      temperature: 0.2,
      signal: controller.signal,
    })) {
      if (closed) return;
      fullText += delta;
      sendEvent(res, { type: 'token', text: delta });
    }

    // 从回答中的 [c-xxx] / [基准1] 提取引用，方便前端展示
    const citedIds = new Set(fullText.match(/c-[\w-]+/g) ?? []);
    for (const id of citedIds) {
      const claim = analysis.claims.find((item) => item.id === id);
      if (!claim) continue;
      const evidence = analysis.evidence.find((item) => item.claimId === id);
      sendEvent(res, {
        type: 'citation',
        citation: {
          id,
          label: claim.metric,
          sourceName: evidence?.sourceName ?? analysis.sources[0]?.name ?? '原始材料',
          quote: evidence?.quote ?? claim.quote,
        },
      });
    }

    sendEvent(res, { type: 'done' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '回答失败';
    console.error('[chat] failed:', message);
    if (!closed) {
      sendEvent(res, { type: 'error', message: `模型回答失败，已切换本地回答：${message}` });
      try {
        await streamLocal();
      } catch {
        // ignore
      }
      sendEvent(res, { type: 'done' });
    }
  } finally {
    endSSE(res);
  }
});

async function start(): Promise<void> {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(ROOT, 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const hasKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
    console.info(`EvidenceFlow server: http://127.0.0.1:${PORT}`);
    console.info(`  model: ${modelLabel(resolveLLMConfig({}))} | server key: ${hasKey ? 'yes' : 'no'} | demo fallback: yes`);
  });
}

start().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
