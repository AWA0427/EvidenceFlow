import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileSearch, Quote, ScanSearch, ShieldCheck } from 'lucide-react';

export function About() {
  const navigate = useNavigate();

  return (
    <div className="container-read py-8">
      <div className="mb-8">
        <div className="kicker">About</div>
        <h1 className="display-lg mt-4">关于证析</h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-7 text-[var(--muted)]">
          证析是一个查经营数据的工具你把会议纪要、复盘或 CSV 放进来，它先找出数字和原文，再算公式、查行业基准，最后告诉你哪些结论能用、哪些缺证据
        </p>
      </div>

      <section className="panel p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-[18px] font-bold">为什么做</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['AI 会编数字', '材料里没有的数，它也可能写出来'],
            ['口径容易错', '同比、退货率、ROI，分母不同，结论就不同'],
            ['错了找不到', '报告发出去以后，没人知道数字从哪来'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-[var(--surface-2)] p-4">
              <p className="text-[12px] font-bold">{title}</p>
              <p className="mt-1 text-[11px] leading-6 text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-6 text-[var(--ink-soft)]">
          所以证析不直接让 AI 写报告，而是让它先交证据：原文、公式、状态没有证据的结论，不进摘要
        </p>
      </section>

      <section className="panel mt-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-[18px] font-bold">怎么工作</h2>
        </div>
        <ol className="mt-4 space-y-3">
          {[
            ['找数字', '从材料里找出指标、数值和原文句子，不改写'],
            ['算一遍', '回到原文核对，再用计算器复算公式'],
            ['查基准', '用 BM25 找行业参照，只解释，不替代你的数据'],
            ['拦错误', '缺基期、分母不清、把目标当结果，都会被标出来'],
          ].map(([title, body], index) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-[var(--line)] p-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-[12px] font-bold">{title}</p>
                <p className="mt-1 text-[11px] leading-6 text-[var(--muted)]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel mt-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-[18px] font-bold">示例在哪</h2>
        </div>
        <p className="mt-3 text-[12px] leading-6 text-[var(--muted)]">
          三个示例已经放进工作台，不在这里重复打开工作台就能看到，点一个案例直接跑
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app?demo=consumer-q3')}>
            打开工作台看示例 <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="panel mt-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--verified)]" />
          <h2 className="text-[18px] font-bold">边界</h2>
        </div>
        <ul className="mt-3 space-y-2 text-[11px] leading-6 text-[var(--muted)]">
          {[
            '示例企业、人物、数据都是虚构的，只用于演示',
            '输出不构成审计、法律或投资建议，正式使用要人工复核',
            '公式目前只支持四则运算，复杂指标还需要补函数',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--verified)]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
