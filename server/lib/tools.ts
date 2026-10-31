import type { AnalysisResult, ChatCitation, ToolCall } from '../../shared/types';
import type { ToolDefinition } from './llm';
import { searchBenchmarks } from './rag';
import { locateQuote, truncate } from './text';

/**
 * 服务端工具白名单。
 *
 * 工具调用永远由服务端执行，参数经过校验；用户文档里的「请调用 xx」不会直接触发工具。
 * 这一层同时服务 /api/chat 的 Function Calling 和分析流水线的可解释轨迹。
 */

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_source',
      description: '在用户上传的原始材料中检索关键词，返回原文片段与位置。适合回答“原文哪里提到”“谁负责”。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索关键词，2-20 字' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_claim',
      description: '按 claim id 或指标名获取精确数值、校验状态和证据引用。',
      parameters: {
        type: 'object',
        properties: {
          claimId: { type: 'string', description: 'claim id，例如 c-gmv' },
          metric: { type: 'string', description: '指标名关键词' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_benchmark',
      description: '检索行业基准知识库，返回可引用的公开资料摘要。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索主题，例如 服饰退货率、SaaS NDR' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_action',
      description: '把用户明确要求的执行动作整理成待办草稿；只生成草稿，不直接写入看板。',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          owner: { type: 'string' },
          deadline: { type: 'string' },
          priority: { type: 'string', enum: ['urgent', 'high', 'normal'] },
        },
        required: ['task'],
        additionalProperties: false,
      },
    },
  },
];

export interface ToolExecution {
  call: ToolCall;
  content: string;
  citations: ChatCitation[];
}

function citationFromClaim(analysis: AnalysisResult, claimId: string): ChatCitation | null {
  const claim = analysis.claims.find((item) => item.id === claimId);
  if (!claim) return null;
  const evidence = analysis.evidence.find((item) => item.claimId === claimId);
  return {
    id: claim.id,
    label: claim.metric,
    sourceName: evidence?.sourceName ?? analysis.sources[0]?.name ?? '原始材料',
    quote: evidence?.quote ?? claim.quote,
  };
}

export function executeTool(name: string, args: Record<string, unknown>, analysis: AnalysisResult): ToolExecution {
  const startedAt = performance.now();
  const finish = (content: string, citations: ChatCitation[] = [], status: ToolCall['status'] = 'success'): ToolExecution => ({
    call: {
      id: `tool-${name}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      label: name,
      args,
      result: truncate(content, 240),
      durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
      status,
    },
    content,
    citations,
  });

  if (name === 'search_source') {
    const query = String(args.query ?? '').trim();
    if (!query) return finish('缺少检索关键词。', [], 'failed');
    const hits: string[] = [];
    const citations: ChatCitation[] = [];
    for (const source of analysis.sources) {
      const location = locateQuote(source.content, query);
      if (location) {
        const quote = source.content.slice(Math.max(0, location.start - 80), Math.min(source.content.length, location.end + 80));
        hits.push(`《${source.name}》：…${quote}…`);
        citations.push({ id: source.id, label: source.name, sourceName: source.name, quote: location.quote });
      }
    }
    return finish(hits.slice(0, 3).join('\n\n') || `原始材料中没有找到「${query}」。`, citations);
  }

  if (name === 'get_claim') {
    const claimId = String(args.claimId ?? '').trim();
    const metric = String(args.metric ?? '').trim();
    const claim = analysis.claims.find(
      (item) => (claimId && item.id === claimId) || (metric && item.metric.includes(metric)),
    );
    if (!claim) return finish('没有找到对应的 claim。', [], 'failed');
    const evidence = analysis.evidence.find((item) => item.claimId === claim.id);
    const content = [
      `指标：${claim.metric}`,
      `数值：${claim.displayValue}`,
      `状态：${claim.status}`,
      `引用：${evidence?.quote ?? claim.quote}`,
      claim.formula ? `公式：${claim.formula}` : '',
      claim.criticNote ? `质疑：${claim.criticNote}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const citation = citationFromClaim(analysis, claim.id);
    return finish(content, citation ? [citation] : []);
  }

  if (name === 'search_benchmark') {
    const query = String(args.query ?? '').trim();
    if (!query) return finish('缺少检索主题。', [], 'failed');
    const results = searchBenchmarks(query, 3);
    if (results.length === 0) return finish(`知识库中没有找到与「${query}」匹配的基准。`);
    const content = results
      .map((item, index) => `[基准${index + 1}] ${item.title}（${item.source}，${item.year}）：${item.excerpt}`)
      .join('\n\n');
    const citations = results.map((item, index) => ({
      id: `benchmark-${index + 1}`,
      label: `行业基准 ${index + 1}`,
      sourceName: item.source,
      quote: item.excerpt,
    }));
    return finish(content, citations);
  }

  if (name === 'create_action') {
    const task = String(args.task ?? '').trim();
    if (!task) return finish('待办内容为空。', [], 'failed');
    const draft = {
      task,
      owner: String(args.owner ?? '待指派'),
      deadline: String(args.deadline ?? '待定'),
      priority: String(args.priority ?? 'normal'),
      status: 'draft',
      note: '这是草稿，需用户确认后才会写入看板。',
    };
    return finish(JSON.stringify(draft, null, 2));
  }

  return finish(`未注册的工具：${name}`, [], 'failed');
}
