import { useId, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { ChartSpec } from '@shared/types';
import { formatNumber } from '../lib/format';

interface ChartRendererProps {
  chart: ChartSpec;
  onEvidence?: (claimId: string) => void;
  onExpand?: (chart: ChartSpec) => void;
}

const PALETTE = ['var(--accent)', 'var(--verified)', 'var(--info)', 'var(--warning)', 'var(--muted-2)'];

export function ChartRenderer({ chart, onEvidence, onExpand }: ChartRendererProps) {
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);

  const max = useMemo(() => {
    const values = chart.series.flatMap((series) => series.data).filter((value) => Number.isFinite(value));
    return Math.max(1, ...values);
  }, [chart]);

  const allZero = chart.series.every((series) => series.data.every((value) => !Number.isFinite(value) || value === 0));

  const clickClaim = (index: number) => {
    const claimId = chart.claimIds[index] ?? chart.claimIds[0];
    if (claimId) onEvidence?.(claimId);
  };

  return (
    <section
      className="panel overflow-hidden"
      onClick={(event) => {
        if (!onExpand) return;
        const target = event.target as Element;
        // 点柱子/折线仍然回证据；点空白区域放大图表
        if (target.closest('rect, circle, path, button')) return;
        onExpand(chart);
      }}
      onDoubleClick={() => onExpand?.(chart)}
      onContextMenu={(event) => {
        if (!onExpand) return;
        event.preventDefault();
        onExpand(chart);
      }}
      title={onExpand ? '点击空白、双击或右键放大图表' : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight">{chart.title}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{chart.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip mono">{chart.type.toUpperCase()}</span>
          {onExpand && (
            <button
              type="button"
              className="btn btn-icon btn-quiet"
              onClick={(event) => {
                event.stopPropagation();
                onExpand(chart);
              }}
              aria-label={`放大图表：${chart.title}`}
              title="放大图表"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="px-3 pb-3 pt-4">
        {allZero ? (
          <div className="flex h-52 items-center justify-center text-[11px] text-[var(--muted)]">暂无可绘制的数值</div>
        ) : chart.type === 'bar' ? (
          <BarChart chart={chart} max={max} active={active} onHover={setActive} onClick={clickClaim} />
        ) : chart.type === 'line' ? (
          <LineChart chart={chart} max={max} id={id} active={active} onHover={setActive} onClick={clickClaim} />
        ) : chart.type === 'pie' ? (
          <PieChart chart={chart} id={id} onEvidence={onEvidence} />
        ) : (
          <FunnelChart chart={chart} onEvidence={onEvidence} />
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] px-4 py-2.5">
        {chart.series.map((series, index) => (
          <span key={series.name} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span
              className="inline-block h-1.5 w-4"
              style={{ backgroundColor: series.color ?? PALETTE[index % PALETTE.length] }}
            />
            {series.name}
          </span>
        ))}
        {chart.claimIds.length > 0 && (
          <button
            type="button"
            onClick={() => onEvidence?.(chart.claimIds[0])}
            className="ml-auto text-[10px] text-[var(--accent)] underline decoration-dotted underline-offset-2"
          >
            查看图表证据
          </button>
        )}
      </footer>
    </section>
  );
}

function BarChart({
  chart,
  max,
  active,
  onHover,
  onClick,
}: {
  chart: ChartSpec;
  max: number;
  active: number | null;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}) {
  const width = 620;
  const height = 238;
  const padding = { top: 14, right: 10, bottom: 44, left: 38 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const categories = chart.categories.length;
  const groupWidth = plotW / Math.max(1, categories);
  const barWidth = Math.min(30, (groupWidth * 0.62) / Math.max(1, chart.series.length));
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title} className="w-full">
      {Array.from({ length: ticks + 1 }, (_, index) => {
        const y = padding.top + (plotH / ticks) * index;
        const label = max - (max / ticks) * index;
        return (
          <g key={index}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padding.left - 7} y={y + 3} textAnchor="end" fontSize={8.5} fill="var(--muted-2)" fontFamily="var(--font-mono)">
              {formatAxis(label)}
            </text>
          </g>
        );
      })}

      {chart.categories.map((category, categoryIndex) => {
        const groupX = padding.left + groupWidth * categoryIndex + groupWidth / 2;
        return (
          <g key={category}>
            {chart.series.map((series, seriesIndex) => {
              const value = series.data[categoryIndex] ?? 0;
              const barH = Math.max(0, (value / max) * plotH);
              const x = groupX - (barWidth * chart.series.length) / 2 + seriesIndex * barWidth;
              const y = padding.top + plotH - barH;
              return (
                <rect
                  key={series.name}
                  x={x + 1}
                  y={y}
                  width={Math.max(2, barWidth - 2)}
                  height={barH}
                  fill={series.color ?? PALETTE[seriesIndex % PALETTE.length]}
                  opacity={active === categoryIndex ? 1 : 0.86}
                  onMouseEnter={() => onHover(categoryIndex)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onClick(categoryIndex)}
                  className="chart-bar cursor-pointer transition-opacity"
                  style={{ animationDelay: `${categoryIndex * 55}ms` }}
                >
                  <title>{`${category} · ${series.name}：${formatNumber(value, 2)}`}</title>
                </rect>
              );
            })}
            <text
              x={groupX}
              y={height - 18}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted)"
              fontFamily="var(--font-sans)"
            >
              {truncateLabel(category)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({
  chart,
  max,
  id,
  active,
  onHover,
  onClick,
}: {
  chart: ChartSpec;
  max: number;
  id: string;
  active: number | null;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}) {
  const width = 620;
  const height = 238;
  const padding = { top: 16, right: 18, bottom: 40, left: 42 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const count = Math.max(1, chart.categories.length);
  const step = count === 1 ? 0 : plotW / (count - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title} className="w-full">
      <defs>
        <linearGradient id={`line-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }, (_, index) => {
        const y = padding.top + (plotH / 4) * index;
        return (
          <g key={index}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padding.left - 7} y={y + 3} textAnchor="end" fontSize={8.5} fill="var(--muted-2)" fontFamily="var(--font-mono)">
              {formatAxis(max - (max / 4) * index)}
            </text>
          </g>
        );
      })}

      {chart.series.map((series, seriesIndex) => {
        const points = series.data.map((value, index) => ({
          x: padding.left + step * index,
          y: padding.top + plotH - (Math.max(0, value) / max) * plotH,
          value,
        }));
        const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
        const area = `${line} L${points[points.length - 1]?.x ?? padding.left},${padding.top + plotH} L${padding.left},${padding.top + plotH} Z`;
        return (
          <g key={series.name}>
            {seriesIndex === 0 && <path d={area} fill={`url(#line-${id})`} />}
            <path className="chart-line" d={line} fill="none" stroke={series.color ?? PALETTE[seriesIndex % PALETTE.length]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => (
              <g key={index} onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)} onClick={() => onClick(index)} className="cursor-pointer">
                <circle className="chart-dot" cx={point.x} cy={point.y} r={active === index ? 5 : 3.2} fill="var(--surface)" stroke={series.color ?? PALETTE[seriesIndex % PALETTE.length]} strokeWidth={2} />
                <title>{`${chart.categories[index]} · ${series.name}：${formatNumber(point.value, 2)}`}</title>
              </g>
            ))}
          </g>
        );
      })}

      {chart.categories.map((category, index) => (
        <text
          key={category}
          x={padding.left + step * index}
          y={height - 16}
          textAnchor="middle"
          fontSize={9}
          fill="var(--muted)"
          fontFamily="var(--font-sans)"
        >
          {truncateLabel(category)}
        </text>
      ))}
    </svg>
  );
}

function PieChart({ chart, id, onEvidence }: { chart: ChartSpec; id: string; onEvidence?: (claimId: string) => void }) {
  const series = chart.series[0];
  const values = series?.data ?? [];
  const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) || 1;
  const size = 220;
  const radius = 78;
  const inner = 48;
  const center = size / 2;

  let angle = -Math.PI / 2;
  const arcs = values.map((value, index) => {
    const ratio = (Number.isFinite(value) ? value : 0) / total;
    const start = angle;
    const end = angle + ratio * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    const ix2 = center + inner * Math.cos(end);
    const iy2 = center + inner * Math.sin(end);
    const ix1 = center + inner * Math.cos(start);
    const iy1 = center + inner * Math.sin(start);
    return {
      path: `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${inner},${inner} 0 ${large} 0 ${ix1},${iy1} Z`,
      ratio,
      index,
    };
  });

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={chart.title} className="h-52 w-52 shrink-0">
        <defs>
          <filter id={`pie-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.12" />
          </filter>
        </defs>
        {arcs.map((arc) => (
          <path
            key={arc.index}
            d={arc.path}
            fill={PALETTE[arc.index % PALETTE.length]}
            opacity={0.9}
            filter={`url(#pie-shadow-${id})`}
            onClick={() => chart.claimIds[arc.index] && onEvidence?.(chart.claimIds[arc.index])}
            className="cursor-pointer transition-opacity hover:opacity-100"
          >
            <title>{`${chart.categories[arc.index]}：${formatNumber(values[arc.index], 2)}（${(arc.ratio * 100).toFixed(1)}%）`}</title>
          </path>
        ))}
        <text x={center} y={center - 3} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="var(--font-sans)">
          {Math.abs(total - 100) < 0.1 ? '占比' : '合计'}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" fontSize={17} fill="var(--ink)" fontFamily="var(--font-mono)" fontWeight="600">
          {Math.abs(total - 100) < 0.1 ? '100%' : formatNumber(total, 1)}
        </text>
      </svg>
      <ul className="w-full max-w-[240px] space-y-1.5">
        {chart.categories.map((category, index) => (
          <li key={category} className="flex items-center justify-between gap-3 text-[10px]">
            <span className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
              <span className="h-2 w-2 shrink-0" style={{ backgroundColor: PALETTE[index % PALETTE.length] }} />
              <span className="truncate">{category}</span>
            </span>
            <span className="mono shrink-0 text-[var(--ink-soft)]">{((values[index] / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FunnelChart({ chart, onEvidence }: { chart: ChartSpec; onEvidence?: (claimId: string) => void }) {
  const values = chart.series[0]?.data ?? [];
  const max = Math.max(1, ...values);
  const width = 620;
  const height = 232;
  const rowH = 38;
  const gap = 9;
  const top = 16;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title} className="w-full">
      {chart.categories.map((category, index) => {
        const value = values[index] ?? 0;
        const ratio = value / max;
        const barW = Math.max(44, (width - 160) * ratio);
        const x = (width - barW) / 2;
        const y = top + index * (rowH + gap);
        return (
          <g key={category} className="cursor-pointer" onClick={() => chart.claimIds[index] && onEvidence?.(chart.claimIds[index])}>
            <rect x={x} y={y} width={barW} height={rowH} fill={PALETTE[index % PALETTE.length]} opacity={0.88} rx={2}>
              <title>{`${category}：${formatNumber(value, 2)}`}</title>
            </rect>
            <text x={width / 2} y={y + rowH / 2 + 3} textAnchor="middle" fontSize={10} fill="var(--surface)" fontFamily="var(--font-sans)" fontWeight="600">
              {category}
            </text>
            <text x={width / 2 + barW / 2 + 10} y={y + rowH / 2 + 3} fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
              {formatNumber(value, 1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}w`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return formatNumber(value, 0);
}

function truncateLabel(value: string): string {
  return value.length > 8 ? `${value.slice(0, 7)}…` : value;
}
