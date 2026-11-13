import { useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Circle,
  FileSearch,
  Filter,
  GitBranch,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Timer,
  Wrench,
} from 'lucide-react';
import type { AgentStep } from '@shared/types';
import { cn, formatDuration } from '../lib/format';

const STAGE_ICON: Record<AgentStep['stage'], typeof BrainCircuit> = {
  plan: GitBranch,
  parse: FileSearch,
  extract: ScanSearch,
  verify: Filter,
  retrieve: Sparkles,
  analyze: BrainCircuit,
  critic: ShieldCheck,
  guard: ShieldCheck,
};

export function AgentTrace({ steps, compact = false }: { steps: AgentStep[]; compact?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (steps.length === 0) {
    return <p className="text-[10px] text-[var(--muted)]">等待分析开始…</p>;
  }

  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const Icon = STAGE_ICON[step.stage] ?? Circle;
        const isOpen = expanded === step.id;
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative pl-7">
            {!isLast && <span className="absolute left-[9px] top-5 h-[calc(100%-8px)] w-px bg-[var(--line)]" />}
            <span
              className={cn(
                'absolute left-0 top-1.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border bg-[var(--surface)]',
                step.status === 'completed'
                  ? 'border-[var(--verified)] text-[var(--verified)]'
                  : step.status === 'running'
                    ? 'border-[var(--accent)] text-[var(--accent)] pulse-soft'
                    : 'border-[var(--line-strong)] text-[var(--muted)]',
              )}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : step.id)}
              className="group w-full py-1 text-left"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[11px] font-semibold', step.status === 'completed' ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}>
                  {step.title}
                </span>
                <span className="mono ml-auto flex items-center gap-1 text-[8px] text-[var(--muted-2)]">
                  <Timer className="h-2.5 w-2.5" />
                  {formatDuration(step.durationMs)}
                </span>
                {isOpen ? <ChevronDown className="h-3 w-3 text-[var(--muted)]" /> : <ChevronRight className="h-3 w-3 text-[var(--muted-2)]" />}
              </div>
              {!compact && <p className="mt-0.5 line-clamp-2 text-[9px] leading-5 text-[var(--muted)]">{step.detail}</p>}
              {compact && <p className="mt-0.5 line-clamp-1 text-[9px] text-[var(--muted)]">{step.detail}</p>}
            </button>

            {isOpen && (
              <div className="mb-2 mt-1 space-y-2 border-l border-[var(--line)] pl-3">
                <p className="text-[10px] leading-5 text-[var(--muted)]">{step.detail}</p>
                {step.tools.map((tool) => (
                  <div key={tool.id} className="border border-[var(--line)] bg-[var(--surface-2)] p-2">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="h-3 w-3 text-[var(--accent)]" />
                      <span className="mono text-[9px] font-semibold text-[var(--ink-soft)]">{tool.name}</span>
                      <span className={cn('ml-auto text-[10px]', tool.status === 'success' ? 'text-[var(--verified)]' : 'text-[var(--danger)]')}>
                        {tool.status} · {formatDuration(tool.durationMs)}
                      </span>
                    </div>
                    <pre className="mono mt-1.5 max-h-20 overflow-auto whitespace-pre-wrap text-[8px] leading-4 text-[var(--muted)]">
                      {JSON.stringify(tool.args, null, 2)}
                    </pre>
                    <p className="mt-1 border-t border-[var(--line)] pt-1 text-[8px] leading-4 text-[var(--muted)]">{tool.result}</p>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
