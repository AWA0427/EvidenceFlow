import type { AnalysisResult, ChatRequest, RetrievedBenchmark } from '../../shared/types';

/**
 * 文本大模型客户端：DeepSeek / 任意 OpenAI 兼容接口
 *
 * 设计约束：
 * - 不在日志里打印 Key；
 * - JSON 模式失败时自动降级为纯文本解析；
 * - 所有外部调用都有超时与一次重试；
 * - 返回的是「候选内容」，数值仍要经过 verify 层
 */

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: 'server' | 'client';
}

export class LLMError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'LLM_ERROR') {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.code = code;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveLLMConfig(input: {
  clientKey?: string;
  baseUrl?: string;
  model?: string;
}): LLMConfig | null {
  const allowClientKey = process.env.ALLOW_CLIENT_KEY !== 'false';
  const serverKey = process.env.DEEPSEEK_API_KEY?.trim();
  const clientKey = allowClientKey ? input.clientKey?.trim() : undefined;
  const apiKey = clientKey || serverKey;
  if (!apiKey) return null;

  const baseUrl = stripTrailingSlash(
    input.baseUrl?.trim() || process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com',
  );
  const model = input.model?.trim() || process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';

  return {
    apiKey,
    baseUrl,
    model,
    source: clientKey ? 'client' : 'server',
  };
}

function endpoint(baseUrl: string): string {
  // DeepSeek 官方地址不带 /v1；OpenAI 兼容网关通常带 /v1
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  return `${baseUrl}/chat/completions`;
}

interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason?: string;
}

async function requestCompletion(
  config: LLMConfig,
  messages: ChatMessageInput[],
  options: {
    temperature?: number;
    json?: boolean;
    maxTokens?: number;
    tools?: unknown[];
    signal?: AbortSignal;
  } = {},
): Promise<ChatCompletionChoice> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const payload: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 3000,
      stream: false,
    };
    if (options.json) payload.response_format = { type: 'json_object' };
    if (options.tools?.length) {
      payload.tools = options.tools;
      payload.tool_choice = 'auto';
    }

    let response = await fetch(endpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // 某些兼容网关不支持 response_format，去掉后重试一次
    if (!response.ok && options.json && response.status === 400) {
      delete payload.response_format;
      response = await fetch(endpoint(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LLMError(
        `模型接口返回 ${response.status}${body ? `：${body.slice(0, 180)}` : ''}`,
        response.status,
        'UPSTREAM_ERROR',
      );
    }

    const json = (await response.json()) as { choices?: ChatCompletionChoice[]; error?: { message?: string } };
    if (json.error?.message) {
      throw new LLMError(json.error.message, 502, 'UPSTREAM_ERROR');
    }
    const choice = json.choices?.[0];
    if (!choice) throw new LLMError('模型没有返回任何候选结果', 502, 'EMPTY_RESPONSE');
    return choice;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** 从可能带 Markdown 围栏的文本中提取 JSON 对象 */
export function extractJSON<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence) as T;
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as T;
    }
    throw new LLMError('模型返回的内容不是合法 JSON', 502, 'INVALID_JSON');
  }
}

export async function callChatJSON<T>(
  config: LLMConfig,
  params: {
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<T> {
  const choice = await requestCompletion(
    config,
    [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    { json: true, temperature: params.temperature, maxTokens: params.maxTokens },
  );
  const content = choice.message?.content ?? '';
  if (!content.trim()) throw new LLMError('模型返回空内容', 502, 'EMPTY_RESPONSE');
  return extractJSON<T>(content);
}

export async function callChatText(
  config: LLMConfig,
  params: { system: string; user: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  const choice = await requestCompletion(
    config,
    [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    { temperature: params.temperature, maxTokens: params.maxTokens },
  );
  return choice.message?.content?.trim() ?? '';
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** 非流式工具选择：让模型决定调用哪个工具，再由服务端执行 */
export async function selectToolCall(
  config: LLMConfig,
  params: { system: string; user: string; tools: ToolDefinition[] },
): Promise<ToolInvocation | null> {
  const choice = await requestCompletion(
    config,
    [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    { tools: params.tools, temperature: 0.1 },
  );
  const call = choice.message?.tool_calls?.[0];
  if (!call) return null;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
  } catch {
    args = {};
  }
  return { id: call.id, name: call.function.name, args };
}

/** 流式文本生成：把 OpenAI 兼容的 SSE 转成纯文本增量 */
export async function* streamChatText(
  config: LLMConfig,
  params: { system: string; user: string; temperature?: number; signal?: AbortSignal },
): AsyncGenerator<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const onAbort = () => controller.abort();
  params.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(endpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        temperature: params.temperature ?? 0.25,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new LLMError(`流式接口返回 ${response.status}${body ? `：${body.slice(0, 160)}` : ''}`, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // 忽略无法解析的心跳/空包
        }
      }
    }
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onAbort);
  }
}

export function modelLabel(config: LLMConfig | null): string {
  if (!config) return 'EvidenceFlow Demo Engine';
  return config.model;
}

export function buildChatQuestion(request: ChatRequest): string {
  return request.question.trim().slice(0, 1200);
}

export function summarizeAnalysisForPrompt(analysis: AnalysisResult): string {
  return JSON.stringify(
    {
      title: analysis.title,
      summary: analysis.summary,
      kpis: analysis.kpis,
      claims: analysis.claims.map((claim) => ({
        id: claim.id,
        metric: claim.metric,
        value: claim.displayValue,
        status: claim.status,
        quote: claim.quote,
        formula: claim.formula,
      })),
      benchmarks: analysis.benchmarks.map((item) => ({
        id: item.id,
        title: item.title,
        excerpt: item.excerpt,
      })),
    },
    null,
    2,
  );
}

export function benchmarkPromptBlock(benchmarks: RetrievedBenchmark[]): string {
  if (benchmarks.length === 0) return '（本次未检索到匹配的行业基准）';
  return benchmarks
    .map(
      (item, index) =>
        `[基准${index + 1}] id=${item.id}\n标题：${item.title}\n来源：${item.source}（${item.year}）\n摘要：${item.excerpt}`,
    )
    .join('\n\n');
}
