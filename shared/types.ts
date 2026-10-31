/**
 * 证析 EvidenceFlow — 共享类型定义
 *
 * 设计原则：
 * 1. 大模型只输出「主张」和「解释」，不直接拥有数字的最终解释权；
 * 2. 每个数字必须能关联到证据（原文引用 / 计算公式 / 数据行）；
 * 3. 前端、后端、测试共用同一套类型，避免接口漂移。
 */

export type SourceKind = 'transcript' | 'csv' | 'text' | 'markdown' | 'image';

export type ClaimStatus = 'verified' | 'partial' | 'unsupported' | 'conflict';

export type Impact = 'high' | 'medium' | 'low';

export type Trend = 'up' | 'down' | 'neutral';

export type Priority = 'urgent' | 'high' | 'normal';

export type ActionStatus = 'pending' | 'in_progress' | 'completed';

export interface SourceDoc {
  id: string;
  name: string;
  kind: SourceKind;
  /** 纯文本内容；CSV 同时保留原始文本 */
  content: string;
  /** CSV 解析后的结构化行 */
  rows?: Array<Record<string, string | number | null>>;
  rowCount?: number;
  charCount: number;
  createdAt: string;
}

export interface ClaimInput {
  metric: string;
  value: number | null;
  displayValue: string;
  unit?: string;
  quote: string;
  category?: string;
  /** 由计算器生成的公式说明，例如「780 / 650 = 120.0%」 */
  formula?: string;
}

export interface Claim extends ClaimInput {
  id: string;
  /** 面向界面展示的主张文本，例如「Q3 全渠道 GMV：1,840 万元」 */
  text: string;
  status: ClaimStatus;
  confidence: number;
  evidenceIds: string[];
  criticNote?: string;
}

export interface EvidenceInput {
  claimId: string;
  sourceId: string;
  quote: string;
  locator: string;
  method: 'direct_quote' | 'computed' | 'retrieved';
  formula?: string;
  inputs?: Array<{ label: string; value: string | number }>;
  confidence: number;
  verified: boolean;
  note?: string;
}

export interface Evidence extends EvidenceInput {
  id: string;
  sourceName: string;
}

export interface KPI {
  id: string;
  label: string;
  value: string;
  unit?: string;
  change?: string;
  trend: Trend;
  description: string;
  claimId?: string;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartSpec {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'funnel';
  description: string;
  categories: string[];
  series: ChartSeries[];
  claimIds: string[];
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  impact: Impact;
  category: string;
  claimIds: string[];
}

export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  priority: Priority;
  status: ActionStatus;
  claimId?: string;
}

export interface BenchmarkDoc {
  id: string;
  title: string;
  source: string;
  year: string;
  tags: string[];
  content: string;
}

export interface RetrievedBenchmark {
  id: string;
  title: string;
  source: string;
  year: string;
  excerpt: string;
  score: number;
}

export interface ToolCall {
  id: string;
  name: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  status: 'success' | 'failed';
}

export interface AgentStep {
  id: string;
  order: number;
  stage:
    | 'plan'
    | 'parse'
    | 'extract'
    | 'verify'
    | 'retrieve'
    | 'analyze'
    | 'critic'
    | 'guard';
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs: number;
  tools: ToolCall[];
}

export interface SafetyCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface SafetyReport {
  passed: boolean;
  numericConsistency: number;
  citationCoverage: number;
  unsupportedCount: number;
  blockedClaims: number;
  piiRedacted: number;
  injectionDetected: boolean;
  checks: SafetyCheck[];
}

export interface AiCallLog {
  stage: 'extract' | 'compose';
  model: string;
  durationMs: number;
  status: 'success' | 'failed';
}

export interface AiRuntimeInfo {
  mode: 'live' | 'demo' | 'local';
  provider: string;
  model: string;
  called: boolean;
  calls: AiCallLog[];
  note: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  healthScore: number;
  kpis: KPI[];
  charts: ChartSpec[];
  insights: Insight[];
  actions: ActionItem[];
  claims: Claim[];
  evidence: Evidence[];
  benchmarks: RetrievedBenchmark[];
  agentSteps: AgentStep[];
  safety: SafetyReport;
  sources: SourceDoc[];
  createdAt: string;
  mode: 'live' | 'demo' | 'local';
  model: string;
  /** 这次分析里 AI 实际做了什么 */
  ai?: AiRuntimeInfo;
  /** 总耗时，毫秒 */
  elapsedMs: number;
}

export interface ChatCitation {
  id: string;
  label: string;
  sourceName: string;
  quote: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  toolCalls?: ToolCall[];
  createdAt: string;
  streaming?: boolean;
}

export interface DemoCase {
  id: string;
  title: string;
  subtitle: string;
  industry: string;
  period: string;
  description: string;
  highlights: string[];
  source: SourceDoc;
}

export interface AnalyzeRequest {
  title?: string;
  text: string;
  sourceName?: string;
  kind?: SourceKind;
  rows?: Array<Record<string, string | number | null>>;
  /** 客户端临时 Key，仅在 ALLOW_CLIENT_KEY=true 时被接受 */
  clientKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface ChatRequest {
  question: string;
  analysisId: string;
  analysis: AnalysisResult;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface ApiConfigResponse {
  demoMode: boolean;
  allowClientKey: boolean;
  hasServerKey: boolean;
  model: string;
  baseUrl: string;
  visionEnabled: boolean;
  authRequired: boolean;
  demoAccount: { username: string; password: string } | null;
  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
    rag: boolean;
    vision: boolean;
  };
}

export type StreamEvent =
  | { type: 'stage'; step: AgentStep }
  | { type: 'tool'; stepId: string; tool: ToolCall }
  | { type: 'token'; text: string }
  | { type: 'result'; data: AnalysisResult }
  | { type: 'citation'; citation: ChatCitation }
  | { type: 'done' }
  | { type: 'error'; message: string };
