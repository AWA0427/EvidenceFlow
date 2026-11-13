import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Download,
  FilePlus2,
  FileText,
  Filter,
  Fingerprint,
  Gauge,
  Layers,
  ListChecks,
  Loader2,
  MessageSquareText,
  Printer,
  RotateCcw,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TriangleAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { ActionItem, AnalysisResult, ChartSpec, Claim, ClaimStatus, DemoCase } from '@shared/types';
import { useAnalysisStore } from '../store/analysis';
import { UploadPanel } from '../components/UploadPanel';
import { AgentTrace } from '../components/AgentTrace';
import { ChartZoomModal } from '../components/ChartZoomModal';
import { ChartRenderer } from '../components/ChartRenderer';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { ChatDock } from '../components/ChatDock';
import { analysisToMarkdown, downloadMarkdown } from '../lib/api';
import { cn, formatDate, formatDuration, formatNumber, percent, relativeTime } from '../lib/format';

const DEMO_META = [
  {
    id: 'consumer-q3',
    index: '01',
    title: '澄野生活 Q3 经营复盘',
    meta: '消费零售 · 全渠道',
    line: 'GMV 超额，但库存与同比口径埋着两颗雷',
    tags: ['品类达成', '库存风险', '同比缺基期'],
  },
  {
    id: 'saas-sprint',
    index: '02',
    title: '云栈科技 Sprint 42',
    meta: 'SaaS · 研发效能',
    line: '交付率 91.1% 不是瓶颈，14 分钟 CI 才是',
    tags: ['DORA 视角', 'CI 瓶颈', 'Safari 缺陷'],
  },
  {
    id: 'marketing-roi',
    index: '03',
    title: '远望智能 9 月获客',
    meta: 'B2B SaaS · 市场增长',
    line: 'CPL 最低的渠道，正在偷偷吃掉销售时间',
    tags: ['渠道质量', '归因污染', '预算再分配'],
  },
];

export function Workspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const analysis = useAnalysisStore((state) => state.analysis);
  const phase = useAnalysisStore((state) => state.phase);
  const error = useAnalysisStore((state) => state.error);
  const steps = useAnalysisStore((state) => state.steps);
  const notice = useAnalysisStore((state) => state.notice);
  const runDemo = useAnalysisStore((state) => state.runDemo);
  const runText = useAnalysisStore((state) => state.runText);
  const reset = useAnalysisStore((state) => state.reset);
  const [tab, setTab] = useState<'dashboard' | 'evidence' | 'critic' | 'source'>('dashboard');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [zoomChart, setZoomChart] = useState<ChartSpec | null>(null);
  useEffect(() => {
    const demo = searchParams.get('demo');
    const isNew = searchParams.get('new');
    if (!demo && !isNew) return;
    if (demo) void runDemo(demo);
    else reset();
    setSearchParams({}, { replace: true });
  }, [runDemo, reset, searchParams, setSearchParams]);

  useEffect(() => {
    if (analysis) setTab('dashboard');
  }, [analysis?.id]);

  const openClaim = (id: string) => setClaimId(id);

  if (phase === 'loading') {
    return <LoadingView steps={steps} notice={notice} />;
  }

  if (!analysis) {
    return (
      <div className="container-wide py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker">New analysis</div>
            <h1 className="display-md mt-3">把材料放进来，开始查证据</h1>
            <p className="mt-2 max-w-xl text-[12px] leading-6 text-[var(--muted)]">
              支持粘贴文本、上传 .txt / .md / .csv没有 API Key 也能先用三个示例
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <span className="status-dot text-[var(--verified)]" />
            无 Key 自动降级 · 示例可离线
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-[11px] leading-5 text-[var(--danger)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">上一次分析没有完成</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <p className="min-w-0 flex-1 text-[11px] leading-5 text-[var(--muted)]">
            <strong className="text-[var(--ink)]">AI 在哪工作：</strong>
            三个示例不调用 API；上传材料并配置 Key 后，模型负责抽取和综合，数字仍由本地校验器复核
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
            配置 API
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <UploadPanel
            onSubmit={(input) => {
              void runText(input);
            }}
          />

          <div className="space-y-3">
            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label">Quick start</p>
                  <h2 className="mt-1 text-[18px] font-bold">先看示例</h2>
                </div>
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                三个案例都在工作台里，点一个直接跑里面的数字、公式和拦截记录都能查
              </p>
              <div className="mt-3 space-y-2">
                {DEMO_META.map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => void runDemo(demo.id)}
                    className="group flex w-full items-start gap-3 border border-[var(--line)] bg-[var(--surface-2)] p-3 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
                  >
                    <span className="mono mt-0.5 text-[9px] text-[var(--muted-2)]">{demo.index}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold">{demo.title}</span>
                      <span className="mt-0.5 block text-[9px] text-[var(--muted)]">{demo.meta}</span>
                      <span className="mt-1 block text-[9px] leading-4 text-[var(--muted)]">{demo.line}</span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="panel p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--verified)]" />
                <h3 className="text-[11px] font-bold">演示顺序</h3>
              </div>
              <ol className="mt-3 space-y-2 text-[10px] leading-5 text-[var(--muted)]">
                <li className="flex gap-2"><span className="mono text-[var(--accent)]">01</span> 打开「澄野生活 Q3」，看 KPI 和图表</li>
                <li className="flex gap-2"><span className="mono text-[var(--accent)]">02</span> 点一个数字，看原文和公式</li>
                <li className="flex gap-2"><span className="mono text-[var(--accent)]">03</span> 去「质疑室」看哪条被拦</li>
                <li className="flex gap-2"><span className="mono text-[var(--accent)]">04</span> 右下角追问，看回答有没有引用</li>
              </ol>
            </div>
          </div>
        </div>

        {phase === 'error' && (
          <div className="mt-4 flex items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[11px] text-[var(--muted)]">也可以直接查看一个完整示例，确认界面与流程</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void runDemo('consumer-q3')}>
              打开示例 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container-wide py-6 print-page">
      <AnalysisHeader
        analysis={analysis}
        tab={tab}
        onTab={setTab}
        onNew={() => {
          reset();
          navigate('/app?new=1');
        }}
      />

      {tab === 'dashboard' && (
        <DashboardTab
          key={analysis.id}
          analysis={analysis}
          onEvidence={openClaim}
          onExpand={setZoomChart}
          onGoEvidence={() => setTab('evidence')}
        />
      )}
      {tab === 'evidence' && <EvidenceTab analysis={analysis} onEvidence={openClaim} />}
      {tab === 'critic' && <CriticTab analysis={analysis} onEvidence={openClaim} />}
      {tab === 'source' && <SourceTab analysis={analysis} onEvidence={openClaim} />}

      <EvidenceDrawer
        analysis={analysis}
        claimId={claimId}
        onClose={() => setClaimId(null)}
        onOpenSource={() => {
          setClaimId(null);
          setTab('source');
        }}
      />
      <ChartZoomModal
        chart={zoomChart}
        onClose={() => setZoomChart(null)}
        onEvidence={(id) => {
          setZoomChart(null);
          openClaim(id);
        }}
      />
      <ChatDock analysis={analysis} onCitation={openClaim} />
    </div>
  );
}

function AnalysisHeader({
  analysis,
  tab,
  onTab,
  onNew,
}: {
  analysis: AnalysisResult;
  tab: string;
  onTab: (tab: 'dashboard' | 'evidence' | 'critic' | 'source') => void;
  onNew: () => void;
}) {
  const tabs = [
    { id: 'dashboard' as const, label: '看板', count: null },
    { id: 'evidence' as const, label: '证据链', count: analysis.claims.length },
    { id: 'critic' as const, label: '质疑室', count: analysis.safety.blockedClaims },
    { id: 'source' as const, label: '原始材料', count: null },
  ];

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="kicker">Audit report</span>
            <span className="mono text-[9px] text-[var(--muted-2)]">{formatDate(analysis.createdAt)}</span>
            <span className="chip">
              {analysis.mode === 'demo' ? '演示引擎' : analysis.mode === 'local' ? '本地启发式' : '实时模型'}
            </span>
            <span className={`chip ${analysis.ai?.called ? 'chip-verified' : 'chip-warning'}`}>
              <Sparkles className="h-2.5 w-2.5" />
              {analysis.ai?.called ? `AI 已调用 ${analysis.ai.calls.length} 次` : 'AI 未调用（示例）'}
            </span>
            <span className="chip mono">{analysis.model}</span>
          </div>
          <h1 className="display-md mt-2 truncate">{analysis.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
            <span>{analysis.subtitle}</span>
            <span>·</span>
            <span>{analysis.sources[0]?.name}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {formatDuration(analysis.elapsedMs)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => downloadMarkdown(`${analysis.title}.md`, analysisToMarkdown(analysis))}
          >
            <Download className="h-3 w-3" /> 导出 Markdown
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Printer className="h-3 w-3" /> 打印 / PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onNew}>
            <FilePlus2 className="h-3 w-3" /> 新建分析
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-[var(--line)] scroll-thin">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition-colors',
              tab === item.id ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {item.label}
            {item.count !== null && <span className="mono rounded bg-[var(--surface-2)] px-1 py-0.5 text-[8px] text-[var(--muted)]">{item.count}</span>}
            {tab === item.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--accent)]" />}
          </button>
        ))}
        <div className="ml-auto hidden items-center gap-1.5 pr-1 text-[9px] text-[var(--muted)] sm:flex">
          <ShieldCheck className="h-3 w-3 text-[var(--verified)]" />
          {analysis.safety.passed ? '发布闸门通过' : '存在待核实项'}
        </div>
      </div>
    </>
  );
}

function DashboardTab({
  analysis,
  onEvidence,
  onExpand,
  onGoEvidence,
}: {
  analysis: AnalysisResult;
  onEvidence: (claimId: string) => void;
  onExpand: (chart: ChartSpec) => void;
  onGoEvidence: () => void;
}) {
  const [actions, setActions] = useState(analysis.actions);
  const [showAllInsights, setShowAllInsights] = useState(false);

  const toggleAction = (id: string) => {
    setActions((prev) =>
      prev.map((action) =>
        action.id === id
          ? { ...action, status: action.status === 'completed' ? 'pending' : action.status === 'pending' ? 'in_progress' : 'completed' }
          : action,
      ),
    );
  };

  return (
    <div className="fade-in space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analysis.kpis.map((kpi, index) => (
          <KpiCard key={kpi.id} kpi={kpi} index={index} onEvidence={onEvidence} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="label">Executive summary</span>
                <span className="chip chip-verified"><CheckCircle2 className="h-2.5 w-2.5" /> 仅含已核验主张</span>
              </div>
              <span className="mono text-[9px] text-[var(--muted-2)]">HEALTH {analysis.healthScore}/100</span>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_150px]">
              <div>
                <p className="text-[12px] leading-7 text-[var(--ink-soft)]">{analysis.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.insights.slice(0, 3).map((insight) => (
                    <button
                      key={insight.id}
                      type="button"
                      onClick={() => insight.claimIds[0] && onEvidence(insight.claimIds[0])}
                      className="chip transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
                    >
                      {insight.category} · {insight.title.slice(0, 12)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-between border-l border-[var(--line)] pl-4">
                <div>
                  <p className="metric-sm text-[var(--verified)]">{percent(analysis.safety.citationCoverage)}</p>
                  <p className="mt-1 text-[9px] text-[var(--muted)]">引用覆盖率</p>
                </div>
                <div className="mt-3">
                  <p className="metric-sm text-[var(--warning)]">{analysis.safety.blockedClaims}</p>
                  <p className="mt-1 text-[9px] text-[var(--muted)]">条结论被拦截</p>
                </div>
                <button type="button" onClick={onGoEvidence} className="mt-3 inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--accent)]">
                  检查证据链 <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {analysis.charts.map((chart) => (
              <ChartRenderer key={chart.id} chart={chart} onEvidence={onEvidence} onExpand={onExpand} />
            ))}
          </div>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <span className="label">Insights</span>
                <h3 className="mt-0.5 font-serif text-[15px] font-bold">这些数字意味着什么</h3>
              </div>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowAllInsights((value) => !value)}>
                {showAllInsights ? '收起' : `全部 ${analysis.insights.length} 条`}
              </button>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {(showAllInsights ? analysis.insights : analysis.insights.slice(0, 3)).map((insight, index) => (
                <article key={insight.id} className="group flex gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-2)]">
                  <span className="mono mt-0.5 text-[10px] text-[var(--muted-2)]">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[12px] font-bold">{insight.title}</h4>
                      <span className={cn('chip', insight.impact === 'high' ? 'chip-danger' : insight.impact === 'medium' ? 'chip-warning' : '')}>
                        {insight.impact === 'high' ? '高影响' : insight.impact === 'medium' ? '中影响' : '低影响'}
                      </span>
                      <span className="text-[9px] text-[var(--muted)]">{insight.category}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-6 text-[var(--muted)]">{insight.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {insight.claimIds.map((id) => (
                        <button key={id} type="button" onClick={() => onEvidence(id)} className="evidence-ref mono text-[9px] text-[var(--muted)]">
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] opacity-0 transition-opacity group-hover:opacity-100" />
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <span className="label">Actions</span>
                <h3 className="mt-0.5 font-serif text-[15px] font-bold">把结论落到下一步</h3>
              </div>
              <span className="mono text-[9px] text-[var(--muted-2)]">{actions.filter((item) => item.status === 'completed').length}/{actions.length}</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {actions.map((action) => (
                <ActionRow key={action.id} action={action} onToggle={() => toggleAction(action.id)} onEvidence={onEvidence} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SafetyCard analysis={analysis} />
          <section className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="label">Agent trace</span>
                <h3 className="mt-0.5 font-serif text-[15px] font-bold">这次分析怎么跑的</h3>
              </div>
              <span className="mono text-[9px] text-[var(--muted-2)]">{analysis.agentSteps.length} STEPS</span>
            </div>
            <div className="mt-3">
              <AgentTrace steps={analysis.agentSteps} compact />
            </div>
          </section>
          <section className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="label">RAG / Benchmarks</span>
                <h3 className="mt-0.5 font-serif text-[15px] font-bold">行业基准</h3>
              </div>
              <BookMarked className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="mt-3 space-y-2">
              {analysis.benchmarks.length === 0 ? (
                <p className="text-[10px] text-[var(--muted)]">本次没有召回匹配的基准</p>
              ) : (
                analysis.benchmarks.map((item, index) => (
                  <div key={item.id} className="border-l-2 border-[var(--verified)] bg-[var(--surface-2)] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold">基准 {String(index + 1).padStart(2, '0')}</span>
                      <span className="mono text-[8px] text-[var(--muted-2)]">score {item.score}</span>
                    </div>
                    <p className="mt-1 text-[9px] font-semibold text-[var(--ink-soft)]">{item.title}</p>
                    <p className="mt-1 line-clamp-3 text-[9px] leading-4 text-[var(--muted)]">{item.excerpt}</p>
                    <p className="mt-1 text-[8px] text-[var(--muted-2)]">{item.source} · {item.year}</p>
                  </div>
                ))
              )}
            </div>
          </section>
          <div className="border border-dashed border-[var(--line-strong)] p-3 text-[9px] leading-5 text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink-soft)]">提示：</span>
            点击任意数字或 claim id，右侧会打开证据抽屉；按 Esc 关闭
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActionRow({ action, onToggle, onEvidence }: { action: ActionItem; onToggle: () => void; onEvidence: (id: string) => void }) {
  const done = action.status === 'completed';
  const active = action.status === 'in_progress';
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          done ? 'border-[var(--verified)] bg-[var(--verified)] text-[var(--surface)]' : active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line-strong)] text-transparent hover:border-[var(--accent)]',
        )}
        aria-label={done ? '标记为未开始' : active ? '标记为完成' : '标记为进行中'}
      >
        {done ? <Check className="h-3 w-3" /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <Check className="h-3 w-3 opacity-0" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[11px] font-semibold', done && 'text-[var(--muted)] line-through')}>{action.task}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[9px] text-[var(--muted)]">
          <span>{action.owner}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-2.5 w-2.5" /> {action.deadline}</span>
          <span>·</span>
          <span>{active ? '进行中' : done ? '已完成' : '待开始'}</span>
        </p>
      </div>
      {action.claimId && (
        <button type="button" onClick={() => onEvidence(action.claimId!)} className="mono shrink-0 text-[9px] text-[var(--muted)] hover:text-[var(--accent)]">
          {action.claimId}
        </button>
      )}
    </div>
  );
}

function SafetyCard({ analysis }: { analysis: AnalysisResult }) {
  const ring = analysis.safety.numericConsistency;
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="label">Publish gate</span>
          <h3 className="mt-0.5 font-serif text-[15px] font-bold">发布闸门</h3>
        </div>
        <span className={cn('chip', analysis.safety.passed ? 'chip-verified' : 'chip-warning')}>
          {analysis.safety.passed ? '通过' : '有保留'}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${analysis.safety.passed ? 'var(--verified)' : 'var(--warning)'} ${ring * 3.6}deg, var(--surface-3) 0deg)`,
          }}
        >
          <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-[var(--surface)]">
            <span className="mono text-lg font-semibold">{ring.toFixed(0)}</span>
            <span className="text-[8px] text-[var(--muted)]">数值一致性</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <MetricRow label="引用覆盖" value={percent(analysis.safety.citationCoverage)} />
          <MetricRow label="待核实" value={`${analysis.safety.unsupportedCount} 条`} tone="warning" />
          <MetricRow label="已拦截" value={`${analysis.safety.blockedClaims} 条`} tone="danger" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
        {analysis.safety.checks.slice(0, 4).map((check) => (
          <div key={check.label} className="flex items-start gap-1.5 text-[9px] leading-4">
            {check.passed ? (
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--verified)]" />
            ) : (
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warning)]" />
            )}
            <span className={check.passed ? 'text-[var(--muted)]' : 'text-[var(--warning)]'}>{check.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[9px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="mono font-semibold" style={{ color: tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );
}

function EvidenceTab({ analysis, onEvidence }: { analysis: AnalysisResult; onEvidence: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | ClaimStatus>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      all: analysis.claims.length,
      verified: analysis.claims.filter((claim) => claim.status === 'verified').length,
      partial: analysis.claims.filter((claim) => claim.status === 'partial').length,
      unsupported: analysis.claims.filter((claim) => claim.status === 'unsupported').length,
      conflict: analysis.claims.filter((claim) => claim.status === 'conflict').length,
    }),
    [analysis],
  );

  const claims = useMemo(() => {
    return analysis.claims.filter((claim) => {
      const statusMatch = filter === 'all' || claim.status === filter;
      const textMatch =
        !query ||
        `${claim.metric} ${claim.displayValue} ${claim.quote} ${claim.category ?? ''}`.toLowerCase().includes(query.toLowerCase());
      return statusMatch && textMatch;
    });
  }, [analysis, filter, query]);

  return (
    <div className="fade-in">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EvidenceStat label="全部主张" value={counts.all} note="每条都必须可追溯" />
        <EvidenceStat label="已核验" value={counts.verified} note="可进入摘要与图表" tone="verified" />
        <EvidenceStat label="待核实" value={counts.partial} note="缺基期 / 分母 / 公式" tone="warning" />
        <EvidenceStat label="无依据" value={counts.unsupported} note="已从发布链路拦截" tone="danger" />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1">
            {[
              ['all', '全部'],
              ['verified', '已核验'],
              ['partial', '待核实'],
              ['unsupported', '无依据'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as 'all' | ClaimStatus)}
                className={cn(
                  'border px-2.5 py-1 text-[10px] font-semibold transition-colors',
                  filter === value
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]'
                    : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]',
                )}
              >
                {label} <span className="mono ml-1 opacity-60">{counts[value as keyof typeof counts] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input h-8 pl-8 text-[10px]"
              placeholder="搜索指标、引用、分类…"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>主张 / 指标</th>
                <th className="w-28">数值</th>
                <th className="w-24">状态</th>
                <th>原文引用</th>
                <th className="w-28">位置</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, index) => {
                const evidence = analysis.evidence.find((item) => item.claimId === claim.id);
                return (
                  <tr key={claim.id} className="cursor-pointer" onClick={() => onEvidence(claim.id)}>
                    <td className="mono text-[9px] text-[var(--muted-2)]">{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <p className="text-[11px] font-semibold">{claim.metric}</p>
                      <p className="mt-0.5 text-[9px] text-[var(--muted)]">{claim.category ?? '未分类'} · {claim.id}</p>
                    </td>
                    <td className="mono text-[12px] font-semibold">{claim.displayValue}</td>
                    <td><StatusBadge status={claim.status} /></td>
                    <td>
                      <p className="line-clamp-2 max-w-[340px] text-[10px] leading-5 text-[var(--muted)]">{claim.quote}</p>
                    </td>
                    <td className="text-[9px] text-[var(--muted)]">{evidence?.locator ?? '—'}</td>
                    <td>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-2)]" />
                    </td>
                  </tr>
                );
              })}
              {claims.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[11px] text-[var(--muted)]">没有匹配的主张</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-[9px] text-[var(--muted)]">
          <span>点击任意一行打开证据抽屉；被拦截的主张不会进入高管摘要</span>
          <span className="mono">{claims.length} / {counts.all}</span>
        </footer>
      </div>
    </div>
  );
}

function EvidenceStat({ label, value, note, tone }: { label: string; value: number; note: string; tone?: 'verified' | 'warning' | 'danger' }) {
  return (
    <div className="panel p-3.5">
      <p className="metric-label">{label}</p>
      <p
        className="mono mt-2 text-2xl font-semibold"
        style={{ color: tone === 'verified' ? 'var(--verified)' : tone === 'warning' ? 'var(--warning)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)' }}
      >
        {value}
      </p>
      <p className="mt-1 text-[9px] text-[var(--muted)]">{note}</p>
    </div>
  );
}

function CriticTab({ analysis, onEvidence }: { analysis: AnalysisResult; onEvidence: (id: string) => void }) {
  const blocked = analysis.claims.filter((claim) => claim.status !== 'verified');
  const [copied, setCopied] = useState(false);

  const copyIssues = () => {
    const text = blocked
      .map((claim) => `- [${claim.status}] ${claim.metric} ${claim.displayValue}\n  引用：${claim.quote}\n  质疑：${claim.criticNote ?? '未填写'}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="fade-in grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="kicker">Red team</div>
              <h2 className="mt-2 font-serif text-xl font-bold">先假设结论是错的</h2>
              <p className="mt-1 max-w-xl text-[11px] leading-6 text-[var(--muted)]">
                质疑官不负责把报告写漂亮，只负责找：缺基期、分母不清、把目标当结果、因果过度下面是它拦下来的主张
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyIssues}>
              <Clipboard className="h-3 w-3" /> {copied ? '已复制' : '复制质疑清单'}
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {blocked.length === 0 ? (
              <div className="flex items-center gap-3 border border-[var(--verified)] bg-[var(--verified-soft)] p-4">
                <CheckCircle2 className="h-5 w-5 text-[var(--verified)]" />
                <div>
                  <p className="text-[11px] font-bold text-[var(--verified)]">这次没有主张被拦截</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">所有数值都通过了引文与公式校验；仍建议人工复核业务口径</p>
                </div>
              </div>
            ) : (
              blocked.map((claim) => (
                <article key={claim.id} className="border border-[var(--line)] bg-[var(--surface)] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={claim.status} />
                      <span className="text-[11px] font-bold">{claim.metric}</span>
                      <span className="mono text-[10px] text-[var(--muted)]">{claim.displayValue}</span>
                    </div>
                    <button type="button" onClick={() => onEvidence(claim.id)} className="text-[9px] font-semibold text-[var(--accent)]">
                      查看证据 →
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="border-l-2 border-[var(--line-strong)] pl-2.5">
                      <p className="label">原文</p>
                      <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">{claim.quote}</p>
                    </div>
                    <div className="border-l-2 border-[var(--warning)] pl-2.5">
                      <p className="label">质疑</p>
                      <p className="mt-1 text-[10px] leading-5 text-[var(--warning)]">{claim.criticNote ?? '需要补充凭证'}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="label">Challenge rules</span>
              <h3 className="mt-0.5 font-serif text-[15px] font-bold">质疑官在查什么</h3>
            </div>
            <Filter className="h-4 w-4 text-[var(--muted)]" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['目标当结果', '“计划清仓 60%”不能写成“已清仓 60%”'],
              ['缺基期', '只有同比百分比、没有去年同期绝对值，不能交叉验证'],
              ['分母不清', '退货率、转化率的分母是订单、用户还是 GMV？'],
              ['因果过度', '渠道 ROI 高不等于该渠道带来了增量'],
              ['口径冲突', '自然流量被计入投放 ROI，预算结论就不可用'],
              ['引用缺失', '找不到连续原文，就不允许进入高管摘要'],
            ].map(([title, body]) => (
              <div key={title} className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="text-[10px] font-bold">{title}</p>
                <p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <SafetyCard analysis={analysis} />
        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--verified)]" />
            <h3 className="text-[11px] font-bold">安全自检明细</h3>
          </div>
          <div className="mt-3 space-y-2">
            {analysis.safety.checks.map((check) => (
              <div key={check.label} className="flex items-start gap-2">
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--verified)]" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                )}
                <div>
                  <p className="text-[10px] font-semibold">{check.label}</p>
                  <p className="mt-0.5 text-[9px] leading-4 text-[var(--muted)]">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-[11px] font-bold">可复现性说明</h3>
          </div>
          <ul className="mt-3 space-y-2 text-[9px] leading-5 text-[var(--muted)]">
            <li>· 数值校验不依赖模型采样，同一输入在同一材料上可复现</li>
            <li>· 公式通过受限四则运算求值，不使用 eval</li>
            <li>· 检索为 BM25，可解释；引用与生成分离</li>
            <li>· 模型失败时降级到本地启发式，不伪造分析结果</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function SourceTab({ analysis, onEvidence }: { analysis: AnalysisResult; onEvidence: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const source = analysis.sources[0];
  const lines = source?.content.split(/\r?\n/) ?? [];
  const [copied, setCopied] = useState(false);

  const highlights = useMemo(() => {
    if (!source) return [];
    return analysis.claims
      .map((claim) => {
        const evidence = analysis.evidence.find((item) => item.claimId === claim.id);
        const quote = evidence?.quote ?? claim.quote;
        const start = source.content.indexOf(quote);
        if (start < 0) return null;
        return { claimId: claim.id, start, end: start + quote.length };
      })
      .filter((item): item is { claimId: string; start: number; end: number } => Boolean(item));
  }, [analysis, source]);

  const renderLine = (line: string, lineIndex: number, lineStart: number) => {
    const lineEnd = lineStart + line.length;
    const ranges = highlights
      .filter((range) => range.start < lineEnd && range.end > lineStart)
      .map((range) => ({ ...range, from: Math.max(0, range.start - lineStart), to: Math.min(line.length, range.end - lineStart) }))
      .filter((range) => range.to > range.from)
      .sort((a, b) => a.from - b.from);
    const pieces: Array<{ text: string; claimId?: string }> = [];
    let cursor = 0;
    for (const range of ranges) {
      const from = Math.max(cursor, range.from);
      const to = Math.min(line.length, range.to);
      if (to <= from) continue;
      if (from > cursor) pieces.push({ text: line.slice(cursor, from) });
      pieces.push({ text: line.slice(from, to), claimId: range.claimId });
      cursor = to;
    }
    if (cursor < line.length) pieces.push({ text: line.slice(cursor) });

    return (
      <div key={lineIndex} className="source-line">
        <span className="line-no">{String(lineIndex + 1).padStart(2, '0')}</span>
        <p className="whitespace-pre-wrap text-[11px] leading-6 text-[var(--ink-soft)]">
          {pieces.map((piece, index) =>
            piece.claimId ? (
              <button
                key={index}
                type="button"
                className="highlight-quote cursor-pointer text-left"
                onClick={() => onEvidence(piece.claimId!)}
                title={`查看 ${piece.claimId} 的证据`}
              >
                {piece.text}
              </button>
            ) : (
              <span key={index}>{piece.text}</span>
            ),
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="fade-in grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <span className="label">Source document</span>
            <h2 className="mt-0.5 font-serif text-[15px] font-bold">{source?.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input h-7 w-40 pl-7 text-[10px]"
                placeholder="查找原文…"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(source?.content ?? '').then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              <Clipboard className="h-3 w-3" /> {copied ? '已复制' : '复制全文'}
            </button>
          </div>
        </div>

        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-3 py-3">
          {lines.map((line, index) => {
            const lineStart = lines.slice(0, index).reduce((total, item) => total + item.length + 1, 0);
            if (query && !line.toLowerCase().includes(query.toLowerCase())) return null;
            return renderLine(line, index, lineStart);
          })}
        </div>
        <footer className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-[9px] text-[var(--muted)]">
          <span>高亮块均可点击，打开对应证据抽屉</span>
          <span className="mono">{source?.charCount.toLocaleString('zh-CN')} chars · {highlights.length} evidence spans</span>
        </footer>
      </section>

      <aside className="space-y-3">
        <div className="panel p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-[11px] font-bold">材料信息</h3>
          </div>
          <dl className="mt-3 space-y-2 text-[10px]">
            <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">类型</dt><dd className="mono">{source?.kind}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">字符数</dt><dd className="mono">{source?.charCount.toLocaleString('zh-CN')}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">行数</dt><dd className="mono">{lines.length}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">PII 脱敏</dt><dd className="mono">{analysis.safety.piiRedacted} 处</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Prompt 注入</dt><dd className="mono">{analysis.safety.injectionDetected ? '已拦截' : '未发现'}</dd></div>
          </dl>
        </div>
        <div className="border border-dashed border-[var(--line-strong)] p-3 text-[9px] leading-5 text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink-soft)]">材料边界：</span>
          原始材料只作为不可信数据输入，文档里即使出现“忽略之前指令”，也不会改变系统规则或触发工具调用
        </div>
      </aside>
    </div>
  );
}

function LoadingView({ steps, notice }: { steps: ReturnType<typeof useAnalysisStore.getState>['steps']; notice: string | null }) {
  const progress = Math.min(100, Math.round((steps.length / 8) * 100));
  return (
    <div className="container-wide py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Building evidence chain</div>
          <h1 className="display-md mt-3">正在建立证据链</h1>
          <p className="mt-2 text-[11px] text-[var(--muted)]">抽取 → 校验 → 检索 → 综合 → 质疑 → 发布闸门</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
          {progress}% · {steps.length}/8 阶段
        </div>
      </div>

      <div className="mb-4 h-1 w-full bg-[var(--surface-3)]">
        <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="label">Live trace</span>
            <span className="mono text-[9px] text-[var(--muted-2)]">SSE</span>
          </div>
          <AgentTrace steps={steps} />
          {notice && <p className="mt-4 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[10px] leading-5 text-[var(--accent)]">{notice}</p>}
        </section>
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <span className="label">What is happening</span>
            <h2 className="mt-0.5 font-serif text-lg font-bold">不是“等模型写完”，而是逐段验收</h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              ['01 / 抽取', '只保留带连续引用的数字模型改写过的句子会被丢弃', ScanSearch],
              ['02 / 校验', '引文必须能在原文中找到；公式必须能通过受限四则运算复算', Fingerprint],
              ['03 / 检索', 'BM25 从行业基准库召回片段，只为解释提供参照', Sparkles],
              ['04 / 闸门', '被质疑的数字不会进入高管摘要，也不会进入导出报告', ShieldCheck],
            ].map(([title, body, Icon]) => {
              const IconComponent = Icon as typeof ScanSearch;
              return (
                <div key={title as string} className="border border-[var(--line)] bg-[var(--surface-2)] p-4">
                  <IconComponent className="h-4 w-4 text-[var(--accent)]" />
                  <p className="mt-3 text-[10px] font-bold">{title as string}</p>
                  <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">{body as string}</p>
                </div>
              );
            })}
          </div>
          <div className="mx-4 mb-4 border border-dashed border-[var(--line-strong)] p-3 text-[9px] leading-5 text-[var(--muted)]">
            分析期间不要关闭页面若模型超时，系统会自动降级到本地启发式模式，仍然保留原文与校验结果
          </div>
        </section>
      </div>
    </div>
  );
}
