import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { KPI } from '@shared/types';

export function KpiCard({ kpi, index, onEvidence }: { kpi: KPI; index: number; onEvidence?: (claimId: string) => void }) {
  const TrendIcon = kpi.trend === 'up' ? ArrowUpRight : kpi.trend === 'down' ? ArrowDownRight : ArrowRight;
  const trendColor = kpi.trend === 'up' ? 'var(--verified)' : kpi.trend === 'down' ? 'var(--danger)' : 'var(--muted)';

  return (
    <article
      className="panel hover-lift fade-up group relative overflow-hidden p-4"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="absolute right-3 top-3 mono text-[9px] text-[var(--muted-2)]">{String(index + 1).padStart(2, '0')}</div>
      <p className="metric-label pr-8">{kpi.label}</p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="metric">{kpi.value}</span>
        {kpi.unit && <span className="mb-1 text-[11px] font-semibold text-[var(--muted)]">{kpi.unit}</span>}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px]" style={{ color: trendColor }}>
        <TrendIcon className="h-3.5 w-3.5" />
        <span className="font-semibold">{kpi.change ?? '—'}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[var(--muted)]">{kpi.description}</p>
      {kpi.claimId && (
        <button
          type="button"
          onClick={() => onEvidence?.(kpi.claimId!)}
          className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          查看证据 <span aria-hidden="true">↗</span>
        </button>
      )}
    </article>
  );
}
