import type { AnalysisResult, AnalyzeRequest, ApiConfigResponse, ChatRequest, StreamEvent } from '@shared/types';

/**
 * 前端 API 客户端。
 *
 * 安全约定：
 * - 服务端 Key 永远不进入前端；
 * - 用户在设置页填的临时 Key 只写 sessionStorage，关闭标签页即失效；
 * - 所有分析都通过 SSE 返回，前端可以逐阶段展示 Agent 轨迹。
 */

export const CLIENT_KEY_STORAGE = 'evidenceflow-session-key';

export function getClientKey(): string {
  try {
    return sessionStorage.getItem(CLIENT_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setClientKey(key: string): void {
  try {
    if (key.trim()) sessionStorage.setItem(CLIENT_KEY_STORAGE, key.trim());
    else sessionStorage.removeItem(CLIENT_KEY_STORAGE);
  } catch {
    // 隐私模式可能禁用 sessionStorage
  }
}

export function clearClientKey(): void {
  try {
    sessionStorage.removeItem(CLIENT_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export async function fetchConfig(): Promise<ApiConfigResponse> {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('无法读取服务端配置');
  return (await response.json()) as ApiConfigResponse;
}

export interface StreamHandlers {
  onEvent: (event: StreamEvent) => void;
  onError?: (message: string) => void;
}

async function consumeSSE(response: Response, handlers: StreamHandlers): Promise<void> {
  if (!response.body) throw new Error('浏览器不支持流式响应');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const dataLines = chunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      try {
        const event = JSON.parse(payload) as StreamEvent;
        handlers.onEvent(event);
      } catch {
        // 忽略不完整的心跳包
      }
    }
  }
}

async function handleErrorResponse(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error || `请求失败（${response.status}）`);
  }
  const text = await response.text();
  throw new Error(text.slice(0, 200) || `请求失败（${response.status}）`);
}

export async function streamAnalysis(
  input: AnalyzeRequest & { demoCaseId?: string },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<AnalysisResult | null> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      clientKey: getClientKey() || undefined,
    }),
    signal,
  });

  if (!response.ok) return handleErrorResponse(response);

  let result: AnalysisResult | null = null;
  await consumeSSE(response, {
    onEvent: (event) => {
      if (event.type === 'result') result = event.data;
      if (event.type === 'error') handlers.onError?.(event.message);
      handlers.onEvent(event);
    },
    onError: handlers.onError,
  });
  return result;
}

export async function streamChat(
  input: ChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      clientKey: getClientKey() || undefined,
    }),
    signal,
  });
  if (!response.ok) return handleErrorResponse(response);
  await consumeSSE(response, handlers);
}

export async function readTextFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    throw new Error('当前基础版支持 .txt / .md / .csv / .json；PDF 与图片识别接口已预留，请在设置中配置视觉模型后接入。');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('文件超过 2MB，请先精简或分段上传。');
  }
  return file.text();
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function analysisToMarkdown(analysis: AnalysisResult): string {
  const lines: string[] = [
    `# ${analysis.title}`,
    '',
    `> ${analysis.subtitle} · ${analysis.mode === 'demo' ? '演示模式' : analysis.mode === 'local' ? '本地启发式' : '实时模式'} · ${analysis.model}`,
    '',
    '## 高管摘要',
    '',
    analysis.summary,
    '',
    '## KPI',
    '',
    '| 指标 | 数值 | 变化 | 说明 |',
    '| --- | --- | --- | --- |',
    ...analysis.kpis.map((kpi) => `| ${kpi.label} | ${kpi.value}${kpi.unit ?? ''} | ${kpi.change ?? '—'} | ${kpi.description} |`),
    '',
    '## 洞察',
    '',
    ...analysis.insights.flatMap((insight) => [
      `### ${insight.title}`,
      '',
      insight.body,
      '',
      `证据：${insight.claimIds.join('、')}`,
      '',
    ]),
    '## 证据链',
    '',
    '| 主张 | 数值 | 状态 | 引用 | 公式 |',
    '| --- | --- | --- | --- | --- |',
    ...analysis.claims.map(
      (claim) => `| ${claim.metric} | ${claim.displayValue} | ${claim.status} | ${claim.quote.replace(/\|/g, '｜')} | ${claim.formula ?? '—'} |`,
    ),
    '',
    '## 安全报告',
    '',
    `- 数值一致性：${analysis.safety.numericConsistency}%`,
    `- 引用覆盖率：${analysis.safety.citationCoverage}%`,
    `- 待核实主张：${analysis.safety.unsupportedCount}`,
    `- 拦截主张：${analysis.safety.blockedClaims}`,
    '',
    '## 行业基准',
    '',
    ...analysis.benchmarks.map((item) => `- ${item.title}（${item.source}，${item.year}）：${item.excerpt}`),
    '',
    '---',
    '',
    '由证析 EvidenceFlow 生成。所有数字均可在原始材料中追溯。',
  ];
  return lines.join('\n');
}
