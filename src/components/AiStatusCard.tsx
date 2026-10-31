import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Cpu, Settings2, XCircle } from 'lucide-react';
import type { AnalysisResult } from '@shared/types';

const MODE_LABEL: Record<string, string> = {
  demo: '示例模式',
  local: '本地模式',
  live: '实时模型',
};

export function AiStatusCard({ analysis }: { analysis: AnalysisResult }) {
  const navigate = useNavigate();
  const ai = analysis.ai;
  const called = Boolean(ai?.called);
  const calls = ai?.calls ?? [];
  const failed = calls.filter((call) => call.status === 'failed').length;

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="label">AI runtime</span>
          <h3 className="mt-0.5 text-[15px] font-bold">AI 在哪里工作</h3>
        </div>
        <span className={`chip ${called ? 'chip-verified' : 'chip-warning'}`}>
          {called ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
          {called ? `已调用 ${calls.length} 次` : '未调用模型'}
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-5 text-[var(--muted)]">
        {ai?.note ?? '本次分析没有记录 AI 调用信息。示例模式不调用大模型。'}
      </p>

      <dl className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3 text-[10px]">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">运行模式</dt>
          <dd className="font-semibold">{MODE_LABEL[ai?.mode ?? analysis.mode] ?? analysis.mode}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">提供方</dt>
          <dd className="text-right">{ai?.provider ?? '内置示例引擎'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">模型</dt>
          <dd className="mono text-right text-[9px]">{ai?.model ?? analysis.model}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">调用耗时</dt>
          <dd className="mono">{calls.reduce((total, call) => total + call.durationMs, 0)}ms</dd>
        </div>
      </dl>

      {calls.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
          {calls.map((call, index) => (
            <div key={`${call.stage}-${index}`} className="flex items-center gap-2 text-[9px]">
              {call.status === 'success' ? (
                <CheckCircle2 className="h-3 w-3 text-[var(--verified)]" />
              ) : (
                <XCircle className="h-3 w-3 text-[var(--danger)]" />
              )}
              <span className="font-semibold">{call.stage === 'extract' ? '抽取主张' : '综合看板'}</span>
              <span className="ml-auto mono text-[var(--muted)]">{call.durationMs}ms</span>
            </div>
          ))}
          {failed > 0 && <p className="text-[9px] text-[var(--warning)]">有 {failed} 次调用失败，已用本地规则兜底。</p>}
        </div>
      )}

      {!called && (
        <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-2.5">
          <p className="text-[9px] leading-4 text-[var(--muted)]">
            示例使用预置结果，不调用 API。上传自己的材料并配置 Key 后，模型才会参与抽取和综合。
          </p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/settings')}>
              <Settings2 className="h-3 w-3" /> 配置 API
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/app?new=1')}>
              <Cpu className="h-3 w-3" /> 上传材料
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
