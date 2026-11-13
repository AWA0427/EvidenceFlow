import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ChartSpec } from '@shared/types';
import { ChartRenderer } from './ChartRenderer';

export function ChartZoomModal({
  chart,
  onClose,
  onEvidence,
}: {
  chart: ChartSpec | null;
  onClose: () => void;
  onEvidence?: (claimId: string) => void;
}) {
  useEffect(() => {
    if (!chart) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [chart, onClose]);

  if (!chart) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(1100px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-[var(--line-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        aria-label={`放大图表：${chart.title}`}
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <div>
            <span className="label">Chart detail</span>
            <h2 className="mt-0.5 text-[18px] font-bold">{chart.title}</h2>
            <p className="mt-1 text-[11px] text-[var(--muted)]">{chart.description}</p>
          </div>
          <button type="button" className="btn btn-icon btn-quiet" onClick={onClose} aria-label="关闭放大图表">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4">
          <ChartRenderer chart={chart} onEvidence={onEvidence} />
        </div>
        <footer className="flex items-center justify-between border-t border-[var(--line)] px-5 py-2.5 text-[9px] text-[var(--muted)]">
          <span>双击图表也可以再次打开；点击柱子查看对应证据</span>
          <span className="mono">{chart.claimIds.length} claims</span>
        </footer>
      </div>
    </>
  );
}
