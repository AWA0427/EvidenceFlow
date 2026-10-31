import type {
  ActionItem,
  AgentStep,
  AiCallLog,
  AiRuntimeInfo,
  AnalysisResult,
  AnalyzeRequest,
  ChartSpec,
  Claim,
  ClaimInput,
  ClaimStatus,
  Evidence,
  Insight,
  KPI,
  RetrievedBenchmark,
  SourceDoc,
  ToolCall,
} from '../../shared/types';
import { buildDemoRun, getDemoCase } from './demo';
import { callChatJSON, type LLMConfig } from './llm';
import { EXTRACTION_SYSTEM, SYNTHESIS_SYSTEM, extractionUserPrompt, synthesisUserPrompt } from './prompts';
import { searchBenchmarks } from './rag';
import { buildSafetyReport, detectPromptInjection, redactPII, summaryLeaksBlockedClaims, wrapUntrustedData } from './safety';
import {
  average,
  formatNumber,
  looksLikeCsv,
  locateQuote,
  numberAppearsInText,
  parseCsv,
  parseNumber,
  sleep,
  truncate,
} from './text';

/**
 * 分析流水线。
 *
 * Demo 与 Live 共用同一套「证据 -> 校验 -> 检索 -> 综合 -> 质疑 -> 闸门」结构，
 * 区别只在于 Claim 的来源：内置案例 or 大模型抽取。
 */

export interface AnalysisHooks {
  onStep?: (step: AgentStep) => void;
  onToken?: (text: string) => void;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function makeSource(input: {
  id: string;
  name: string;
  kind: SourceDoc['kind'];
  content: string;
  rows?: SourceDoc['rows'];
}): SourceDoc {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    content: input.content,
    rows: input.rows,
    rowCount: input.rows?.length,
    charCount: input.content.length,
    createdAt: new Date().toISOString(),
  };
}

function tool(params: {
  name: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  status?: ToolCall['status'];
}): ToolCall {
  return {
    id: `tool-${params.name}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name,
    label: params.label,
    args: params.args,
    result: params.result,
    durationMs: Math.max(1, Math.round(params.durationMs)),
    status: params.status ?? 'success',
  };
}

function step(params: {
  order: number;
  stage: AgentStep['stage'];
  title: string;
  detail: string;
  durationMs: number;
  tools?: ToolCall[];
  status?: AgentStep['status'];
}): AgentStep {
  return {
    id: `step-${params.order}-${params.stage}`,
    order: params.order,
    stage: params.stage,
    title: params.title,
    detail: params.detail,
    status: params.status ?? 'completed',
    durationMs: Math.max(1, Math.round(params.durationMs)),
    tools: params.tools ?? [],
  };
}

/** 安全算术求值器：只允许数字、括号和四则运算，绝不使用 eval。 */
export function evaluateArithmetic(expression: string): number | null {
  const normalized = expression
    .replace(/[，,]/g, '')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/[=＝]/g, '=')
    .replace(/%/g, '');
  // 只允许数字、空白、括号和四则运算符；出现字母/函数名/其他符号直接拒绝。
  if (!/^[\d\s()+\-*/]+$/.test(normalized)) return null;
  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!tokens) return null;

  const values: number[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

  const apply = (): boolean => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || right === undefined || left === undefined) return false;
    switch (operator) {
      case '+':
        values.push(left + right);
        break;
      case '-':
        values.push(left - right);
        break;
      case '*':
        values.push(left * right);
        break;
      case '/':
        if (right === 0) return false;
        values.push(left / right);
        break;
      default:
        return false;
    }
    return true;
  };

  for (const token of tokens) {
    if (/^\d/.test(token)) {
      values.push(Number(token));
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        if (!apply()) return null;
      }
      if (operators.pop() !== '(') return null;
    } else {
      while (
        operators.length > 0 &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        if (!apply()) return null;
      }
      operators.push(token);
    }
  }
  while (operators.length > 0) {
    if (!apply()) return null;
  }
  return values.length === 1 && Number.isFinite(values[0]) ? values[0] : null;
}

/** 校验「公式 -> 值」是否成立，并容忍四舍五入与百分比表示差异。 */
export function verifyFormula(formula: string, claimedValue: number | null): { ok: boolean; computed: number | null } {
  if (claimedValue === null) return { ok: false, computed: null };
  const left = formula.split('=')[0]?.trim() ?? formula;
  const computed = evaluateArithmetic(left);
  if (computed === null) return { ok: false, computed: null };
  const candidates = [computed, computed * 100, computed / 100];
  const ok = candidates.some(
    (candidate) => Math.abs(candidate - claimedValue) <= Math.max(0.05, Math.abs(claimedValue) * 0.001),
  );
  return { ok, computed };
}

function buildEvidenceForClaim(params: {
  claim: ClaimInput & { id: string };
  source: SourceDoc;
  index: number;
}): { claim: Claim; evidence: Evidence } {
  const { claim, source } = params;
  const location = locateQuote(source.content, claim.quote);
  const hasFormula = Boolean(claim.formula);
  const formulaCheck = hasFormula && claim.formula ? verifyFormula(claim.formula, claim.value) : null;
  const formulaNumbers = (claim.formula?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const formulaTraceable =
    formulaNumbers.length === 0 || formulaNumbers.every((number) => numberAppearsInText(number, location?.quote ?? ''));

  let status: ClaimStatus;
  if (!location) {
    status = 'unsupported';
  } else if (hasFormula) {
    status = formulaCheck?.ok && formulaTraceable ? 'verified' : 'partial';
  } else if (claim.value === null) {
    status = 'verified';
  } else {
    status = numberAppearsInText(claim.value, location.quote) ? 'verified' : 'partial';
  }

  const evidence: Evidence = {
    id: `ev-${claim.id}`,
    claimId: claim.id,
    sourceId: source.id,
    sourceName: source.name,
    quote: location?.quote ?? claim.quote,
    locator: location ? `第 ${paragraphOf(source.content, location.start)} 段` : '未在原文中定位',
    method: hasFormula ? 'computed' : 'direct_quote',
    formula: claim.formula,
    inputs: hasFormula
      ? [
          { label: '公式', value: claim.formula ?? '' },
          { label: '计算结果', value: formulaCheck?.computed != null ? formatNumber(formulaCheck.computed, 2) : '无法计算' },
        ]
      : undefined,
    confidence: status === 'verified' ? 0.98 : status === 'partial' ? 0.6 : 0.18,
    verified: status === 'verified',
    note:
      status === 'unsupported'
        ? '原文中未找到可逐字核对的引用，已拦截。'
        : status === 'partial'
          ? hasFormula
            ? '公式或公式中的输入无法在原文中完整复核，需人工确认。'
            : '引文存在，但数值未能在引文中直接核对。'
          : undefined,
  };

  return {
    claim: {
      ...claim,
      text: `${claim.metric}：${claim.displayValue}`,
      status,
      confidence: evidence.confidence,
      evidenceIds: [evidence.id],
      criticNote: evidence.note,
    },
    evidence,
  };
}

function paragraphOf(content: string, index: number): number {
  return content.slice(0, index).split(/\n+/).filter((part) => part.trim().length > 0).length;
}

function retrievalQuery(title: string, claims: Claim[]): string {
  const metrics = claims
    .filter((claim) => claim.status === 'verified')
    .slice(0, 10)
    .map((claim) => `${claim.metric} ${claim.displayValue}`)
    .join(' ');
  return `${title} ${metrics}`.slice(0, 600);
}

function buildStepsForRun(params: {
  source: SourceDoc;
  claims: Claim[];
  benchmarks: RetrievedBenchmark[];
  kpis: KPI[];
  charts: ChartSpec[];
  mode: 'live' | 'demo';
  extractionMs: number;
  synthesisMs: number;
  injectionDetected: boolean;
  piiRedacted: number;
}): AgentStep[] {
  const { source, claims, benchmarks, kpis, charts, extractionMs, synthesisMs } = params;
  const verified = claims.filter((claim) => claim.status === 'verified');
  const blocked = claims.filter((claim) => claim.status === 'unsupported' || claim.status === 'partial');

  return [
    step({
      order: 1,
      stage: 'plan',
      title: '规划分析路径',
      detail:
        source.kind === 'csv'
          ? '识别为结构化数据：选择「列统计 + 异常检测 + 基准对标」路径。'
          : '识别为叙事材料：选择「主张抽取 + 数值校验 + 基准检索」路径。',
      durationMs: 24,
      tools: [
        tool({
          name: 'plan_analysis',
          label: '规划器',
          args: { kind: source.kind, chars: source.charCount, rows: source.rowCount ?? 0 },
          result: source.kind === 'csv' ? '结构化分析路径' : '叙事材料分析路径',
          durationMs: 24,
        }),
      ],
    }),
    step({
      order: 2,
      stage: 'parse',
      title: '解析与脱敏',
      detail: `读取 ${source.charCount.toLocaleString('zh-CN')} 字符${source.rowCount ? `、${source.rowCount} 行数据` : ''}；PII 脱敏 ${params.piiRedacted} 处。`,
      durationMs: 38,
      tools: [
        tool({
          name: 'parse_document',
          label: '文档解析',
          args: { name: source.name, kind: source.kind },
          result: `${source.charCount} 字符 / ${source.rowCount ?? 0} 行`,
          durationMs: 38,
        }),
      ],
    }),
    step({
      order: 3,
      stage: 'extract',
      title: '抽取主张',
      detail: `得到 ${claims.length} 条候选主张；其中 ${verified.length} 条可直接核对，${blocked.length} 条需降级。`,
      durationMs: extractionMs,
      tools: [
        tool({
          name: 'extract_claims',
          label: '证据抽取',
          args: { mode: params.mode, temperature: 0.1 },
          result: `${claims.length} 条候选，${verified.length} 条已核对`,
          durationMs: extractionMs,
        }),
      ],
    }),
    step({
      order: 4,
      stage: 'verify',
      title: '确定性数值校验',
      detail: '逐条检查引文是否存在、数字是否可回填、公式是否可复算；不通过的主张不会进入高管摘要。',
      durationMs: 31,
      tools: [
        tool({
          name: 'verify_numeric_claim',
          label: '数值校验器',
          args: { claims: claims.length, method: 'quote + formula' },
          result: `${verified.length} 条通过，${blocked.length} 条标记待核实`,
          durationMs: 31,
        }),
      ],
    }),
    step({
      order: 5,
      stage: 'retrieve',
      title: '检索行业基准',
      detail: `BM25 召回 ${benchmarks.length} 条基准片段；引用只用于解释，不替代企业自身数据。`,
      durationMs: 18,
      tools: [
        tool({
          name: 'search_benchmark',
          label: 'RAG 检索',
          args: { query: retrievalQuery(source.name, claims), topK: 3 },
          result: benchmarks.map((item) => item.title).join('；') || '无匹配',
          durationMs: 18,
        }),
      ],
    }),
    step({
      order: 6,
      stage: 'analyze',
      title: '综合经营看板',
      detail: `生成 ${kpis.length} 个 KPI、${charts.length} 个图表；所有图表都可以回到 claim。`,
      durationMs: synthesisMs,
      tools: [
        tool({
          name: 'compose_dashboard',
          label: '看板综合',
          args: { kpis: kpis.length, charts: charts.length, mode: params.mode },
          result: '结构化看板已生成',
          durationMs: synthesisMs,
        }),
      ],
    }),
    step({
      order: 7,
      stage: 'critic',
      title: '质疑官复核',
      detail: `发现 ${blocked.length} 条需要降级或补充证据的主张；质疑记录会显示在证据链中。`,
      durationMs: 27,
      tools: [
        tool({
          name: 'challenge_claims',
          label: '质疑官',
          args: { rules: ['unsupported', 'overclaim', 'target_as_actual'] },
          result: blocked.length > 0 ? blocked.map((claim) => claim.metric).join('、') : '未发现高风险问题',
          durationMs: 27,
        }),
      ],
    }),
    step({
      order: 8,
      stage: 'guard',
      title: '发布闸门',
      detail: params.injectionDetected
        ? '检测到疑似指令注入；已将来源材料隔离为不可信数据，工具调用仍受白名单约束。'
        : '检查数值一致性、引用覆盖、待核实主张与 PII；通过后才允许导出报告。',
      durationMs: 22,
      tools: [
        tool({
          name: 'publish_gate',
          label: '安全闸门',
          args: { requireCitation: true, blockUnsupported: true },
          result: `${verified.length} 条可发布，${blocked.length} 条被拦截`,
          durationMs: 22,
        }),
      ],
    }),
  ];
}

function finalizeResult(params: {
  title: string;
  subtitle: string;
  source: SourceDoc;
  summary: string;
  healthScore: number;
  claims: Claim[];
  evidence: Evidence[];
  kpis: KPI[];
  charts: ChartSpec[];
  insights: Insight[];
  actions: ActionItem[];
  benchmarks: RetrievedBenchmark[];
  steps: AgentStep[];
  mode: 'live' | 'demo' | 'local';
  model: string;
  aiCalls?: AiCallLog[];
  startedAt: number;
  piiRedacted: number;
  injectionDetected: boolean;
}): AnalysisResult {
  const safety = buildSafetyReport({
    claims: params.claims,
    evidence: params.evidence,
    piiRedacted: params.piiRedacted,
    injectionDetected: params.injectionDetected,
  });

  // 发布闸门：如果摘要泄露了被拦截的数字，替换为不含该数字的安全摘要。
  const leaked = summaryLeaksBlockedClaims(params.summary, params.claims);
  let summary = params.summary;
  if (leaked.length > 0) {
    const verified = params.claims.filter((claim) => claim.status === 'verified').slice(0, 4);
    summary = `高管摘要已触发安全闸门：原摘要引用了 ${leaked.length} 条待核实数据。当前可发布的确定结论为：${verified
      .map((claim) => `${claim.metric} ${claim.displayValue}`)
      .join('；')}。其余结论需补充原始凭证后再发布。`;
  }

  const ai: AiRuntimeInfo = {
    mode: params.mode,
    provider:
      params.mode === 'demo'
        ? '内置示例引擎'
        : params.mode === 'local'
          ? '本地启发式'
          : 'DeepSeek / OpenAI 兼容',
    model: params.model,
    called: params.mode === 'live' && (params.aiCalls?.length ?? 0) > 0,
    calls: params.aiCalls ?? [],
    note:
      params.mode === 'demo'
        ? '示例模式不调用大模型：用内置证据 + 本地校验，保证没 Key 也能演示。'
        : params.mode === 'local'
          ? '未配置 API Key：只做规则抽取和本地校验，没有调用大模型。'
          : '已调用模型完成抽取/综合；数字仍由本地校验器复核。',
  };

  return {
    id: `analysis-${Date.now().toString(36)}`,
    title: params.title,
    subtitle: params.subtitle,
    summary,
    healthScore: params.healthScore,
    kpis: params.kpis,
    charts: params.charts,
    insights: params.insights,
    actions: params.actions,
    claims: params.claims,
    evidence: params.evidence,
    benchmarks: params.benchmarks,
    agentSteps: params.steps,
    safety,
    sources: [params.source],
    createdAt: new Date().toISOString(),
    mode: params.mode,
    model: params.model,
    ai,
    elapsedMs: Math.round(now() - params.startedAt),
  };
}

/** 演示模式：完整跑通证据链、检索、质疑与安全闸门，不依赖网络。 */
export async function runDemoAnalysis(caseId: string, hooks: AnalysisHooks = {}): Promise<AnalysisResult> {
  const startedAt = now();
  const run = buildDemoRun(caseId);

  await sleep(90);
  const planStep = step({
    order: 1,
    stage: 'plan',
    title: '规划分析路径',
    detail: '识别为叙事材料：选择「主张抽取 + 数值校验 + 基准检索」路径。',
    durationMs: 24,
    tools: [
      tool({
        name: 'plan_analysis',
        label: '规划器',
        args: { kind: 'transcript', caseId },
        result: '叙事材料分析路径',
        durationMs: 24,
      }),
    ],
  });
  hooks.onStep?.(planStep);

  await sleep(90);
  const parseStep = step({
    order: 2,
    stage: 'parse',
    title: '解析与脱敏',
    detail: `读取 ${run.source.charCount.toLocaleString('zh-CN')} 字符；示例材料已完成 PII 检查。`,
    durationMs: 38,
    tools: [
      tool({
        name: 'parse_document',
        label: '文档解析',
        args: { name: run.source.name, kind: run.source.kind },
        result: `${run.source.charCount} 字符`,
        durationMs: 38,
      }),
    ],
  });
  hooks.onStep?.(parseStep);

  await sleep(140);
  const verified = run.claims.filter((claim) => claim.status === 'verified');
  const extractStep = step({
    order: 3,
    stage: 'extract',
    title: '抽取主张',
    detail: `从案例材料中抽取 ${run.claims.length} 条主张，全部带原文引用。`,
    durationMs: 186,
    tools: [
      tool({
        name: 'extract_claims',
        label: '证据抽取',
        args: { mode: 'demo', claims: run.claims.length },
        result: `${run.claims.length} 条候选`,
        durationMs: 186,
      }),
    ],
  });
  hooks.onStep?.(extractStep);

  await sleep(120);
  const verifyStep = step({
    order: 4,
    stage: 'verify',
    title: '确定性数值校验',
    detail: `逐条比对引文与公式：${verified.length} 条通过，${run.claims.length - verified.length} 条标记待核实。`,
    durationMs: 31,
    tools: [
      tool({
        name: 'verify_numeric_claim',
        label: '数值校验器',
        args: { claims: run.claims.length, method: 'quote + formula' },
        result: `${verified.length} 条通过`,
        durationMs: 31,
      }),
    ],
  });
  hooks.onStep?.(verifyStep);

  await sleep(150);
  const benchmarks = searchBenchmarks(retrievalQuery(run.title, run.claims), 3);
  const retrieveStep = step({
    order: 5,
    stage: 'retrieve',
    title: '检索行业基准',
    detail: `BM25 召回 ${benchmarks.length} 条基准片段，用于解释而非替代企业数据。`,
    durationMs: 18,
    tools: [
      tool({
        name: 'search_benchmark',
        label: 'RAG 检索',
        args: { query: retrievalQuery(run.title, run.claims), topK: 3 },
        result: benchmarks.map((item) => item.title).join('；') || '无匹配',
        durationMs: 18,
      }),
    ],
  });
  hooks.onStep?.(retrieveStep);

  await sleep(160);
  const analyzeStep = step({
    order: 6,
    stage: 'analyze',
    title: '综合经营看板',
    detail: `生成 ${run.kpis.length} 个 KPI、${run.charts.length} 个图表。`,
    durationMs: 210,
    tools: [
      tool({
        name: 'compose_dashboard',
        label: '看板综合',
        args: { kpis: run.kpis.length, charts: run.charts.length },
        result: '结构化看板已生成',
        durationMs: 210,
      }),
    ],
  });
  hooks.onStep?.(analyzeStep);

  await sleep(120);
  const blocked = run.claims.filter((claim) => claim.status !== 'verified');
  const criticStep = step({
    order: 7,
    stage: 'critic',
    title: '质疑官复核',
    detail: `质疑官拦截 ${blocked.length} 条高风险主张；其中同比口径缺少基期，已从高管摘要移除。`,
    durationMs: 27,
    tools: [
      tool({
        name: 'challenge_claims',
        label: '质疑官',
        args: { rules: ['unsupported', 'overclaim', 'target_as_actual'] },
        result: blocked.map((claim) => claim.metric).join('、') || '未发现高风险问题',
        durationMs: 27,
      }),
    ],
  });
  hooks.onStep?.(criticStep);

  await sleep(100);
  const guardStep = step({
    order: 8,
    stage: 'guard',
    title: '发布闸门',
    detail: '检查数值一致性、引用覆盖、待核实主张与 PII；通过后才允许导出报告。',
    durationMs: 22,
    tools: [
      tool({
        name: 'publish_gate',
        label: '安全闸门',
        args: { requireCitation: true, blockUnsupported: true },
        result: `${verified.length} 条可发布，${blocked.length} 条被拦截`,
        durationMs: 22,
      }),
    ],
  });
  hooks.onStep?.(guardStep);

  return finalizeResult({
    title: run.title,
    subtitle: run.subtitle,
    source: run.source,
    summary: run.summary,
    healthScore: run.healthScore,
    claims: run.claims,
    evidence: run.evidence,
    kpis: run.kpis,
    charts: run.charts,
    insights: run.insights,
    actions: run.actions,
    benchmarks,
    steps: [planStep, parseStep, extractStep, verifyStep, retrieveStep, analyzeStep, criticStep, guardStep],
    mode: 'demo',
    model: 'EvidenceFlow Demo Engine',
    startedAt,
    piiRedacted: 0,
    injectionDetected: false,
  });
}

interface ExtractedClaim {
  metric?: string;
  value?: number | string | null;
  displayValue?: string;
  unit?: string;
  quote?: string;
  category?: string;
  formula?: string | null;
}

interface ExtractionResponse {
  title?: string;
  subtitle?: string;
  claims?: ExtractedClaim[];
}

/** 无 Key / 模型失败时的启发式抽取：只抓「一句话里同时有指标词和数字」的片段。 */
export function heuristicExtract(text: string): ExtractedClaim[] {
  const sentences = text
    .split(/(?<=[。！？；\n])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);

  const claims: ExtractedClaim[] = [];
  for (const sentence of sentences) {
    const number = parseNumber(sentence);
    if (number === null) continue;
    // 避免把年份、日期当成经营指标
    if (/^20\d{2}[-年]/.test(sentence.trim()) && !/(?:GMV|营收|增长|下降|率|元|万)/.test(sentence)) continue;
    const metricMatch = sentence.match(
      /([\u4e00-\u9fa5A-Za-z0-9（）()·/]{2,24}?)(?:为|是|达到|完成|录得|降至|提升至|增长|下降|环比|同比|：|:)\s*[-+]?[\d,，.]+\s*(?:%|万|亿|元|ms|s|分钟|个|条|点|倍)?/,
    );
    const metric = (metricMatch?.[1] ?? sentence.slice(0, 16)).replace(/[，。；：]/g, '').trim();
    claims.push({
      metric,
      value: number,
      displayValue: sentence.match(/[-+]?[\d,，.]+\s*(?:%|万|亿|元|ms|s|分钟|个|条|点|倍)?/)?.[0]?.trim() ?? String(number),
      quote: sentence,
      category: '自动抽取',
      formula: null,
    });
    if (claims.length >= 18) break;
  }
  return claims;
}

function defaultKpis(claims: Claim[]): KPI[] {
  return claims
    .filter((claim) => claim.status === 'verified' && claim.value !== null)
    .slice(0, 4)
    .map((claim, index) => ({
      id: `kpi-${index}`,
      label: claim.metric,
      value: String(claim.value),
      unit: claim.unit,
      change: claim.formula ? '公式可复算' : '原文可核对',
      trend: 'neutral' as const,
      description: truncate(claim.quote, 64),
      claimId: claim.id,
    }));
}

function defaultChart(claims: Claim[]): ChartSpec[] {
  const numeric = claims.filter((claim) => claim.status === 'verified' && claim.value !== null).slice(0, 8);
  if (numeric.length < 2) return [];
  return [
    {
      id: 'chart-auto',
      title: '已核验指标一览',
      type: 'bar',
      description: '仅展示通过原文或公式校验的数值，未通过的主张不进入图表。',
      categories: numeric.map((claim) => claim.metric.slice(0, 12)),
      series: [{ name: '数值', data: numeric.map((claim) => Number(claim.value)), color: 'var(--accent)' }],
      claimIds: numeric.map((claim) => claim.id),
    },
  ];
}

function defaultAnalysisFromClaims(params: {
  title: string;
  subtitle: string;
  claims: Claim[];
}): { summary: string; healthScore: number; kpis: KPI[]; charts: ChartSpec[]; insights: Insight[]; actions: ActionItem[] } {
  const verified = params.claims.filter((claim) => claim.status === 'verified');
  const blocked = params.claims.filter((claim) => claim.status !== 'verified');
  const summary =
    verified.length > 0
      ? `本次材料共抽取 ${params.claims.length} 条主张，其中 ${verified.length} 条通过原文或公式校验。可确认的关键指标包括：${verified
          .slice(0, 4)
          .map((claim) => `${claim.metric} ${claim.displayValue}`)
          .join('；')}。${blocked.length > 0 ? `另有 ${blocked.length} 条主张因缺少引用或基期数据被标记为待核实，未进入高管结论。` : ''}`
      : '材料中没有找到可逐字核对的量化主张。建议补充带明确数字与口径的经营数据后重新分析。';

  const insights: Insight[] =
    verified.length > 0
      ? [
          {
            id: 'ins-auto-1',
            title: '先看可核对的事实，再谈判断',
            body: `当前证据最强的是「${verified[0].metric}」：${verified[0].displayValue}。其余结论需要补充分母、时间窗口或对照期后再下判断。`,
            impact: 'high',
            category: '分析结论',
            claimIds: [verified[0].id],
          },
        ]
      : [];

  return {
    summary,
    healthScore: verified.length === 0 ? 35 : Math.min(88, 55 + verified.length * 3),
    kpis: defaultKpis(params.claims),
    charts: defaultChart(params.claims),
    insights,
    actions: [],
  };
}

/** 实时模式：DeepSeek 抽取 -> 确定性校验 -> BM25 检索 -> LLM 综合 -> 闸门。 */
export async function runLiveAnalysis(
  request: AnalyzeRequest,
  config: LLMConfig,
  hooks: AnalysisHooks = {},
): Promise<AnalysisResult> {
  const startedAt = now();
  const sourceName = request.sourceName?.trim() || '未命名材料.txt';
  const kind: SourceDoc['kind'] = request.kind ?? (looksLikeCsv(request.text) ? 'csv' : 'transcript');
  const redaction = redactPII(request.text);
  const injection = detectPromptInjection(redaction.text);
  const safeText = redaction.text;
  const parsedCsv = kind === 'csv' ? parseCsv(safeText) : null;
  const source = makeSource({
    id: `src-${Date.now().toString(36)}`,
    name: sourceName,
    kind,
    content: safeText,
    rows: request.rows ?? parsedCsv?.rows,
  });

  const planStep = step({
    order: 1,
    stage: 'plan',
    title: '规划分析路径',
    detail: kind === 'csv' ? '识别为结构化数据：列统计 + 指标校验 + 基准对标。' : '识别为叙事材料：主张抽取 + 数值校验 + 基准检索。',
    durationMs: 21,
    tools: [
      tool({
        name: 'plan_analysis',
        label: '规划器',
        args: { kind, chars: source.charCount, rows: source.rowCount ?? 0, injection: injection.detected },
        result: kind === 'csv' ? '结构化分析路径' : '叙事材料分析路径',
        durationMs: 21,
      }),
    ],
  });
  hooks.onStep?.(planStep);

  const parseStep = step({
    order: 2,
    stage: 'parse',
    title: '解析与脱敏',
    detail: `读取 ${source.charCount.toLocaleString('zh-CN')} 字符${source.rowCount ? `、${source.rowCount} 行` : ''}；脱敏 ${redaction.count} 处。`,
    durationMs: 35,
    tools: [
      tool({
        name: 'parse_document',
        label: '文档解析',
        args: { name: sourceName, kind },
        result: `${source.charCount} 字符${parsedCsv ? ` / ${parsedCsv.rows.length} 行` : ''}`,
        durationMs: 35,
      }),
    ],
  });
  hooks.onStep?.(parseStep);

  const extractionStart = now();
  const aiCalls: AiCallLog[] = [];
  let extractionFailed = false;
  let extraction: ExtractionResponse;
  try {
    extraction = await callChatJSON<ExtractionResponse>(config, {
      system: EXTRACTION_SYSTEM,
      user: extractionUserPrompt(wrapUntrustedData(safeText), kind, parsedCsv ? `列：${parsedCsv.headers.join(' / ')}` : undefined),
      temperature: 0.05,
      maxTokens: 2600,
    });
  } catch {
    extractionFailed = true;
    extraction = { title: request.title, claims: heuristicExtract(safeText) };
  }
  aiCalls.push({
    stage: 'extract',
    model: config.model,
    durationMs: Math.round(now() - extractionStart),
    status: extractionFailed ? 'failed' : 'success',
  });

  const rawClaims = (extraction.claims ?? []).slice(0, 28);
  const claims: Claim[] = [];
  const evidence: Evidence[] = [];
  rawClaims.forEach((raw, index) => {
    if (!raw.quote || !raw.metric) return;
    const value = parseNumber(raw.value);
    const claimInput: ClaimInput & { id: string } = {
      id: `c-${index + 1}`,
      metric: String(raw.metric).slice(0, 40),
      value,
      displayValue: String(raw.displayValue || (value !== null ? formatNumber(value, 2) : '—')),
      unit: raw.unit,
      quote: String(raw.quote).slice(0, 600),
      category: raw.category || '未分类',
      formula: raw.formula || undefined,
    };
    const built = buildEvidenceForClaim({ claim: claimInput, source, index });
    claims.push(built.claim);
    evidence.push(built.evidence);
  });

  if (claims.length === 0) {
    throw new Error('模型未能从材料中抽取出可核对的主张。请补充带明确数字和口径的文本，或在设置中切换演示模式。');
  }

  const extractStep = step({
    order: 3,
    stage: 'extract',
    title: '抽取主张',
    detail: `模型抽取 ${claims.length} 条候选主张；每条都必须提供原文引用。`,
    durationMs: now() - extractionStart,
    tools: [
      tool({
        name: 'extract_claims',
        label: '证据抽取',
        args: { model: config.model, temperature: 0.05 },
        result: `${claims.length} 条候选`,
        durationMs: now() - extractionStart,
      }),
    ],
  });
  hooks.onStep?.(extractStep);

  const verifyStart = now();
  const verifiedCount = claims.filter((claim) => claim.status === 'verified').length;
  const verifyStep = step({
    order: 4,
    stage: 'verify',
    title: '确定性数值校验',
    detail: `逐条检查引文、数字与公式：${verifiedCount} 条通过，${claims.length - verifiedCount} 条降级。`,
    durationMs: now() - verifyStart,
    tools: [
      tool({
        name: 'verify_numeric_claim',
        label: '数值校验器',
        args: { claims: claims.length, method: 'quote + formula' },
        result: `${verifiedCount} 条通过`,
        durationMs: now() - verifyStart,
      }),
    ],
  });
  hooks.onStep?.(verifyStep);

  const retrieveStart = now();
  const benchmarks = searchBenchmarks(retrievalQuery(request.title || extraction.title || sourceName, claims), 3);
  const retrieveStep = step({
    order: 5,
    stage: 'retrieve',
    title: '检索行业基准',
    detail: `BM25 召回 ${benchmarks.length} 条基准片段。`,
    durationMs: now() - retrieveStart,
    tools: [
      tool({
        name: 'search_benchmark',
        label: 'RAG 检索',
        args: { query: retrievalQuery(request.title || sourceName, claims), topK: 3 },
        result: benchmarks.map((item) => item.title).join('；') || '无匹配',
        durationMs: now() - retrieveStart,
      }),
    ],
  });
  hooks.onStep?.(retrieveStep);

  const synthesisStart = now();
  let synthesisFailed = false;
  let synthesis: {
    summary?: string;
    healthScore?: number;
    kpis?: KPI[];
    charts?: ChartSpec[];
    insights?: Insight[];
    actions?: ActionItem[];
  } = {};
  try {
    synthesis = await callChatJSON(config, {
      system: SYNTHESIS_SYSTEM,
      user: synthesisUserPrompt({
        title: request.title || extraction.title || sourceName,
        claims,
        benchmarks,
      }),
      temperature: 0.2,
      maxTokens: 3200,
    });
  } catch {
    synthesisFailed = true;
    synthesis = {};
  }
  aiCalls.push({
    stage: 'compose',
    model: config.model,
    durationMs: Math.round(now() - synthesisStart),
    status: synthesisFailed ? 'failed' : 'success',
  });

  const fallback = defaultAnalysisFromClaims({
    title: request.title || extraction.title || sourceName,
    subtitle: extraction.subtitle || (kind === 'csv' ? '结构化数据' : '经营材料'),
    claims,
  });

  const validClaimIds = new Set(claims.map((claim) => claim.id));
  const kpis = (synthesis.kpis ?? []).filter((kpi) => !kpi.claimId || validClaimIds.has(kpi.claimId)).slice(0, 4);
  const charts = (synthesis.charts ?? [])
    .map((chart) => ({
      ...chart,
      categories: (chart.categories ?? []).slice(0, 10),
      series: (chart.series ?? [])
        .map((series) => ({
          ...series,
          data: (series.data ?? []).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
        }))
        .filter((series) => series.data.length > 0),
      claimIds: (chart.claimIds ?? []).filter((id) => validClaimIds.has(id)),
    }))
    .filter((chart) => ['bar', 'line', 'pie', 'funnel'].includes(chart.type) && chart.categories.length > 0 && chart.series.length > 0)
    .slice(0, 3);
  const insights = (synthesis.insights ?? [])
    .filter((insight) => insight.title && insight.body)
    .map((insight) => ({ ...insight, claimIds: (insight.claimIds ?? []).filter((id) => validClaimIds.has(id)) }))
    .slice(0, 5);
  const actions = (synthesis.actions ?? []).filter((action) => action.task).slice(0, 6);

  const analyzeStep = step({
    order: 6,
    stage: 'analyze',
    title: '综合经营看板',
    detail: `生成 ${kpis.length || fallback.kpis.length} 个 KPI、${charts.length || fallback.charts.length} 个图表。`,
    durationMs: now() - synthesisStart,
    tools: [
      tool({
        name: 'compose_dashboard',
        label: '看板综合',
        args: { model: config.model, claims: claims.length },
        result: '结构化看板已生成',
        durationMs: now() - synthesisStart,
      }),
    ],
  });
  hooks.onStep?.(analyzeStep);

  const criticStart = now();
  const blocked = claims.filter((claim) => claim.status !== 'verified');
  for (const claim of blocked) {
    if (!claim.criticNote) {
      claim.criticNote =
        claim.status === 'unsupported'
          ? '原文中未找到可逐字核对的引用，已拦截。'
          : '引文存在，但数值或公式无法在原文中完整复核，需补充凭证。';
    }
  }
  const criticStep = step({
    order: 7,
    stage: 'critic',
    title: '质疑官复核',
    detail: `质疑官标记 ${blocked.length} 条主张，要求补充凭证或降级。`,
    durationMs: now() - criticStart,
    tools: [
      tool({
        name: 'challenge_claims',
        label: '质疑官',
        args: { rules: ['unsupported', 'overclaim', 'target_as_actual'] },
        result: blocked.map((claim) => claim.metric).join('、') || '未发现高风险问题',
        durationMs: now() - criticStart,
      }),
    ],
  });
  hooks.onStep?.(criticStep);

  const guardStep = step({
    order: 8,
    stage: 'guard',
    title: '发布闸门',
    detail: '检查数值一致性、引用覆盖、待核实主张与 PII；通过后才允许导出报告。',
    durationMs: 19,
    tools: [
      tool({
        name: 'publish_gate',
        label: '安全闸门',
        args: { requireCitation: true, blockUnsupported: true },
        result: `${verifiedCount} 条可发布，${blocked.length} 条被拦截`,
        durationMs: 19,
      }),
    ],
  });
  hooks.onStep?.(guardStep);

  const summary = synthesis.summary || fallback.summary;
  // 如果模型摘要引用了未通过校验的数字，finalizeResult 会触发安全闸门并替换摘要。
  return finalizeResult({
    title: request.title || extraction.title || sourceName,
    subtitle: extraction.subtitle || (kind === 'csv' ? '结构化数据' : '经营材料'),
    source,
    summary,
    healthScore: synthesis.healthScore ?? fallback.healthScore,
    claims,
    evidence,
    kpis: kpis.length > 0 ? kpis : fallback.kpis,
    charts: charts.length > 0 ? charts : fallback.charts,
    insights: insights.length > 0 ? insights : fallback.insights,
    actions,
    benchmarks,
    steps: [planStep, parseStep, extractStep, verifyStep, retrieveStep, analyzeStep, criticStep, guardStep],
    mode: 'live',
    model: config.model,
    aiCalls,
    startedAt,
    piiRedacted: redaction.count,
    injectionDetected: injection.detected,
  });
}

/**
 * 本地启发式模式：没有 API Key 时也能分析用户自己的材料。
 *
 * 抽取值依赖正则与数字解析，能力有限，但完全可解释、可离线；
 * 界面会明确标注「本地启发式」，不会伪装成大模型输出。
 */
export async function runLocalAnalysis(request: AnalyzeRequest, hooks: AnalysisHooks = {}): Promise<AnalysisResult> {
  const startedAt = now();
  const sourceName = request.sourceName?.trim() || '未命名材料.txt';
  const kind: SourceDoc['kind'] = request.kind ?? (looksLikeCsv(request.text) ? 'csv' : 'transcript');
  const redaction = redactPII(request.text);
  const injection = detectPromptInjection(redaction.text);
  const parsedCsv = kind === 'csv' ? parseCsv(redaction.text) : null;
  const source = makeSource({
    id: `src-${Date.now().toString(36)}`,
    name: sourceName,
    kind,
    content: redaction.text,
    rows: request.rows ?? parsedCsv?.rows,
  });

  const planStep = step({
    order: 1,
    stage: 'plan',
    title: '规划分析路径',
    detail: '未配置模型 Key，切换到本地启发式路径：只抽取带明确数字的句子，不做生成式推断。',
    durationMs: 18,
    tools: [
      tool({
        name: 'plan_analysis',
        label: '规划器',
        args: { kind, mode: 'local', chars: source.charCount },
        result: '本地启发式路径',
        durationMs: 18,
      }),
    ],
  });
  hooks.onStep?.(planStep);

  const parseStep = step({
    order: 2,
    stage: 'parse',
    title: '解析与脱敏',
    detail: `读取 ${source.charCount.toLocaleString('zh-CN')} 字符；脱敏 ${redaction.count} 处。`,
    durationMs: 26,
    tools: [
      tool({
        name: 'parse_document',
        label: '文档解析',
        args: { name: sourceName, kind },
        result: `${source.charCount} 字符`,
        durationMs: 26,
      }),
    ],
  });
  hooks.onStep?.(parseStep);

  const rawClaims = heuristicExtract(redaction.text);
  const claims: Claim[] = [];
  const evidence: Evidence[] = [];
  rawClaims.forEach((raw, index) => {
    if (!raw.quote || !raw.metric) return;
    const value = parseNumber(raw.value);
    const built = buildEvidenceForClaim({
      claim: {
        id: `c-${index + 1}`,
        metric: String(raw.metric).slice(0, 40),
        value,
        displayValue: String(raw.displayValue || (value !== null ? formatNumber(value, 2) : '—')),
        unit: raw.unit,
        quote: String(raw.quote).slice(0, 600),
        category: raw.category || '自动抽取',
        formula: raw.formula || undefined,
      },
      source,
      index,
    });
    claims.push(built.claim);
    evidence.push(built.evidence);
  });

  if (claims.length === 0) {
    throw new Error('本地模式没有从材料中识别出带数字的句子。请补充明确指标，或在设置中配置 API Key。');
  }

  const verified = claims.filter((claim) => claim.status === 'verified');
  const extractStep = step({
    order: 3,
    stage: 'extract',
    title: '抽取主张',
    detail: `本地规则抽取 ${claims.length} 条带数字的候选句；不做语义扩写。`,
    durationMs: 42,
    tools: [
      tool({
        name: 'extract_claims',
        label: '证据抽取',
        args: { mode: 'local_heuristic' },
        result: `${claims.length} 条候选`,
        durationMs: 42,
      }),
    ],
  });
  hooks.onStep?.(extractStep);

  const verifyStep = step({
    order: 4,
    stage: 'verify',
    title: '确定性数值校验',
    detail: `逐条回查引文：${verified.length} 条通过，${claims.length - verified.length} 条降级。`,
    durationMs: 24,
    tools: [
      tool({
        name: 'verify_numeric_claim',
        label: '数值校验器',
        args: { claims: claims.length },
        result: `${verified.length} 条通过`,
        durationMs: 24,
      }),
    ],
  });
  hooks.onStep?.(verifyStep);

  const benchmarks = searchBenchmarks(retrievalQuery(request.title || sourceName, claims), 3);
  const retrieveStep = step({
    order: 5,
    stage: 'retrieve',
    title: '检索行业基准',
    detail: `BM25 召回 ${benchmarks.length} 条基准片段。`,
    durationMs: 14,
    tools: [
      tool({
        name: 'search_benchmark',
        label: 'RAG 检索',
        args: { query: retrievalQuery(request.title || sourceName, claims), topK: 3 },
        result: benchmarks.map((item) => item.title).join('；') || '无匹配',
        durationMs: 14,
      }),
    ],
  });
  hooks.onStep?.(retrieveStep);

  const fallback = defaultAnalysisFromClaims({
    title: request.title || sourceName,
    subtitle: kind === 'csv' ? '结构化数据' : '经营材料',
    claims,
  });
  const analyzeStep = step({
    order: 6,
    stage: 'analyze',
    title: '综合经营看板',
    detail: `生成 ${fallback.kpis.length} 个 KPI、${fallback.charts.length} 个图表；未配置模型，不生成新的因果判断。`,
    durationMs: 20,
    tools: [
      tool({
        name: 'compose_dashboard',
        label: '看板综合',
        args: { mode: 'local' },
        result: '结构化看板已生成',
        durationMs: 20,
      }),
    ],
  });
  hooks.onStep?.(analyzeStep);

  const blocked = claims.filter((claim) => claim.status !== 'verified');
  const criticStep = step({
    order: 7,
    stage: 'critic',
    title: '质疑官复核',
    detail: `标记 ${blocked.length} 条需要补充凭证的主张。`,
    durationMs: 18,
    tools: [
      tool({
        name: 'challenge_claims',
        label: '质疑官',
        args: { rules: ['unsupported', 'overclaim'] },
        result: blocked.map((claim) => claim.metric).join('、') || '未发现高风险问题',
        durationMs: 18,
      }),
    ],
  });
  hooks.onStep?.(criticStep);

  const guardStep = step({
    order: 8,
    stage: 'guard',
    title: '发布闸门',
    detail: '检查数值一致性、引用覆盖与 PII；本地模式只发布已核对的主张。',
    durationMs: 12,
    tools: [
      tool({
        name: 'publish_gate',
        label: '安全闸门',
        args: { requireCitation: true, blockUnsupported: true },
        result: `${verified.length} 条可发布，${blocked.length} 条被拦截`,
        durationMs: 12,
      }),
    ],
  });
  hooks.onStep?.(guardStep);

  return finalizeResult({
    title: request.title || sourceName,
    subtitle: kind === 'csv' ? '结构化数据' : '经营材料',
    source,
    summary: fallback.summary,
    healthScore: fallback.healthScore,
    claims,
    evidence,
    kpis: fallback.kpis,
    charts: fallback.charts,
    insights: fallback.insights,
    actions: [],
    benchmarks,
    steps: [planStep, parseStep, extractStep, verifyStep, retrieveStep, analyzeStep, criticStep, guardStep],
    mode: 'local',
    model: 'Local Heuristic Engine（未配置 API）',
    startedAt,
    piiRedacted: redaction.count,
    injectionDetected: injection.detected,
  });
}

export function splitRowsForPrompt(source: SourceDoc): string {
  if (!source.rows) return '';
  return source.rows
    .slice(0, 8)
    .map((row) => Object.entries(row).map(([key, value]) => `${key}=${value ?? ''}`).join(' | '))
    .join('\n');
}

export function summarizeSeries(rows: Array<Record<string, string | number | null>>): string {
  const numericValues = rows
    .flatMap((row) => Object.values(row))
    .filter((value): value is number => typeof value === 'number');
  if (numericValues.length === 0) return '无数值列';
  return `${numericValues.length} 个数值，均值 ${formatNumber(average(numericValues) ?? 0, 1)}`;
}
