import { useEffect, useMemo } from 'react';
import { ArrowUpRight, Clipboard, FileText, FunctionSquare, ShieldCheck, X } from 'lucide-react';
import type { AnalysisResult } from '@shared/types';
import { StatusBadge } from './StatusBadge';
import { formatNumber } from '../lib/format';

interface EvidenceDrawerProps {
  analysis: AnalysisResult;
  claimId: string | null;
  onClose: () => void;
  onOpenSource?: () => void;
}

export function EvidenceDrawer({ analysis, claimId, onClose, onOpenSource }: EvidenceDrawerProps) {
  const claim = useMemo(() => analysis.claims.find((item) => item.id === claimId) ?? null, [analysis, claimId]);
  const evidence = useMemo(
    () => analysis.evidence.find((item) => item.claimId === claimId) ?? null,
    [analysis, claimId],
  );
  const relatedInsights = useMemo(
    () => analysis.insights.filter((item) => item.claimIds.includes(claimId ?? '')),
    [analysis, claimId],
  );
  const relatedActions = useMemo(
    () => analysis.actions.filter((item) => item.claimId === claimId),
    [analysis, claimId],
  );

  useEffect(() => {
    if (!claimId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [claimId, onClose]);

  if (!claimId || !claim) return null;

  const confidence = Math.round(claim.confidence * 100);

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`证据：${claim.metric}`}>
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label">Evidence / 证据</span>
              <StatusBadge status={claim.status} />
            </div>
            <h2 className="mt-2 truncate font-serif text-xl font-bold tracking-tight">{claim.metric}</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="metric-sm text-[var(--ink)]">{claim.displayValue}</span>
              {claim.formula && <span className="mono text-[10px] text-[var(--muted)]">公式可复算</span>}
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-quiet shrink-0" onClick={onClose} aria-label="关闭证据抽屉">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">原文引用</span>
              <span className="mono text-[9px] text-[var(--muted-2)]">{evidence?.locator ?? '未定位'}</span>
            </div>
            <div className="panel-2 relative p-4 pl-5">
              <span className="quote-mark absolute left-2 top-2" aria-hidden="true">
                “
              </span>
              <p className="text-[12px] leading-7 text-[var(--ink-soft)]">
                {evidence?.quote ?? claim.quote}
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3">
                <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
                <span className="text-[10px] text-[var(--muted)]">{evidence?.sourceName ?? analysis.sources[0]?.name}</span>
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--accent)]"
                  onClick={() => {
                    navigator.clipboard.writeText(evidence?.quote ?? claim.quote).catch(() => undefined);
                  }}
                >
                  <Clipboard className="h-3 w-3" /> 复制
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <FunctionSquare className="h-3.5 w-3.5 text-[var(--muted)]" />
              <span className="label">计算过程</span>
            </div>
            {claim.formula ? (
              <div className="panel-2 p-4">
                <pre className="mono whitespace-pre-wrap text-[12px] leading-6 text-[var(--ink-soft)]">{claim.formula}</pre>
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--muted)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--verified)]" />
                  由确定性计算器复算，不经过大模型自由生成
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-[var(--line-strong)] p-4 text-[11px] leading-relaxed text-[var(--muted)]">
                该主张为原文直接引用，没有经过二次计算系统已比对引文与数值是否一致
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">可信度</span>
              <span className="mono text-[10px] text-[var(--muted)]">{confidence}%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--surface-3)]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${confidence}%`,
                  backgroundColor:
                    claim.status === 'verified' ? 'var(--verified)' : claim.status === 'partial' ? 'var(--warning)' : 'var(--danger)',
                }}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              {claim.status === 'verified'
                ? '引文与数值通过确定性校验；公式类主张同时通过复算'
                : claim.criticNote ?? '该主张需要补充原始凭证后再发布'}
            </p>
          </section>

          {relatedInsights.length > 0 && (
            <section>
              <span className="label">关联洞察</span>
              <div className="mt-2 space-y-2">
                {relatedInsights.map((insight) => (
                  <div key={insight.id} className="border-l-2 border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2">
                    <p className="text-[11px] font-bold">{insight.title}</p>
                    <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-[var(--muted)]">{insight.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {relatedActions.length > 0 && (
            <section>
              <span className="label">关联待办</span>
              <div className="mt-2 space-y-2">
                {relatedActions.map((action) => (
                  <div key={action.id} className="flex items-start justify-between gap-3 border border-[var(--line)] p-3">
                    <div>
                      <p className="text-[11px] font-semibold">{action.task}</p>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {action.owner} · {action.deadline}
                      </p>
                    </div>
                    <span className={`chip ${action.priority === 'urgent' ? 'chip-danger' : action.priority === 'high' ? 'chip-warning' : ''}`}>
                      {action.priority === 'urgent' ? '紧急' : action.priority === 'high' ? '高' : '普通'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel-2 p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--verified)]" />
              <div>
                <p className="text-[11px] font-bold">发布闸门</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
                  {claim.status === 'verified'
                    ? '该数字可以进入高管摘要、图表和导出报告'
                    : '该数字已被排除出高管摘要；导出报告时会保留「待核实」标记，避免误用'}
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
          <span className="mono text-[9px] text-[var(--muted-2)]">ID {claim.id}</span>
          {onOpenSource && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSource}>
              <ArrowUpRight className="h-3 w-3" /> 在原文中定位
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
