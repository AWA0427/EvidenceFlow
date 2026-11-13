import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  MousePointerClick,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AuthCard } from '../components/AuthCard';
import { useScrollReveal } from '../hooks/useScrollReveal';

export function Landing() {
  const navigate = useNavigate();
  const [heroProgress, setHeroProgress] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  useScrollReveal();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = Math.max(420, window.innerHeight * 0.82);
      setHeroProgress(Math.min(1, window.scrollY / distance));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen">
      <header
        className="glass sticky top-0 z-40"
        style={{
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          borderTop: 0,
          borderBottom: '1px solid color-mix(in srgb, var(--line) 55%, transparent)',
          background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
          boxShadow: 'none',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="container-wide flex h-[72px] items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 rounded-full border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-2 py-1 text-[12px] font-semibold text-[var(--muted)] md:flex">
            <button type="button" onClick={() => navigate('/app')} className="rounded-full px-3 py-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">工作台</button>
            <button type="button" onClick={() => scrollTo('about')} className="rounded-full px-3 py-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">技术说明</button>
            <button type="button" onClick={() => scrollTo('login')} className="rounded-full px-3 py-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">登录</button>
          </nav>
        </div>
      </header>

      <main>
        <section
          className="relative flex min-h-[calc(100svh-72px)] items-center overflow-hidden py-10 lg:py-14"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPointer({ x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 });
          }}
          onMouseLeave={() => setPointer({ x: 0, y: 0 })}
        >
          <span className="hero-mesh" />
          <span className="hero-dots" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ transform: `translate3d(${pointer.x * 16}px, ${pointer.y * 12}px, 0)`, transition: 'transform 300ms ease-out' }}
          >
            <span className="hero-ring one" />
            <span className="hero-ring two" />
            <span className="hero-orb one" />
            <span className="hero-orb two" />
            <span className="hero-orb three" />
            <span className="hero-orb four" />
            <span className="hero-orb five" />
            <span className="hero-orb six" />
            <span className="hero-orb seven" />
          </div>
          <div
            className="container-wide relative z-10 grid items-center gap-10 transition-[opacity,transform] duration-150 ease-out lg:grid-cols-[1.05fr_0.95fr]"
            style={{
              opacity: 1 - heroProgress,
              transform: `translateY(${heroProgress * 28}px)`,
              pointerEvents: heroProgress > 0.92 ? 'none' : 'auto',
            }}
          >
            <div className="fade-up">
              <div className="kicker">可审计的经营分析</div>
              <h1 className="display-xl mt-4">
                把经营材料，
                <br />
                变成一份
                <br />
                <span className="text-[var(--accent)]">能查证据的报告</span>
              </h1>
              <p className="mt-5 max-w-lg text-[13px] leading-7 text-[var(--muted)]">
                上传会议纪要、复盘或 CSV证析先找数字和原文，再算公式、查行业基准，最后告诉你哪些结论能用
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>
                  进入工作台 <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" className="btn btn-ghost btn-lg" onClick={() => scrollTo('login')}>
                  登录
                </button>
              </div>
              <p className="mt-3 text-[10px] text-[var(--muted)]">不用登录也能看三个示例登录后可以上传自己的材料</p>
            </div>

            <div
              className="relative fade-up [animation-delay:120ms]"
              style={{ transform: `translate3d(${pointer.x * -10}px, ${pointer.y * -7}px, 0)`, transition: 'transform 300ms ease-out' }}
            >
              <EvidencePreview />
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--bg)_62%,transparent)] to-[var(--bg)]"
            style={{ opacity: 1 - heroProgress }}
          />

          <div
            className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[9px] tracking-[0.18em] text-[var(--muted)] transition-opacity"
            style={{ opacity: 1 - heroProgress }}
          >
            <span>向下滑动</span>
            <span className="h-6 w-px animate-pulse bg-[var(--line-strong)]" />
          </div>
        </section>

        <section id="about" data-reveal className="border-y border-[var(--line)] bg-[var(--surface)]">
          <div className="container-wide pb-2 pt-10">
            <div className="kicker">关于</div>
            <h2 className="display-lg mt-3">先看证据，再信结论</h2>
            <p className="mt-3 max-w-xl text-[12px] leading-6 text-[var(--muted)]">
              证析不是直接让 AI 写报告它先找数字和原文，再算公式、查基准，最后把没证据的结论拦下来
            </p>
          </div>
          <div className="container-wide grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)] md:grid-cols-4">
            {[
              { value: '27', label: '示例主张', note: '每条带原文' },
              { value: '96.3%', label: '引用覆盖', note: '26 条通过' },
              { value: '1', label: '被拦截', note: '同比缺基期' },
              { value: '8', label: '处理步骤', note: '全程可看' },
            ].map((item) => (
              <div key={item.label} className="px-5 py-5">
                <p className="mono text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-[11px] font-semibold">{item.label}</p>
                <p className="mt-0.5 text-[9px] text-[var(--muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-reveal className="container-wide py-14 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="kicker">三步</div>
              <h2 className="display-lg mt-3">怎么用</h2>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/about')}>
              看完整说明 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: FileUp, step: '01', title: '放材料', body: '粘贴文本，或上传 .txt / .md / .csv也可以直接选一个示例' },
              { icon: ScanSearch, step: '02', title: '看结论', body: '看板给出 KPI、图表、问题和待办每个数字都能点开' },
              { icon: MousePointerClick, step: '03', title: '点数字', body: '点开后看到原文、公式和状态没证据的结论会被标出来' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.step} className="panel hover-lift fade-up p-5" style={{ animationDelay: `${Number(item.step) * 80}ms` }}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mono text-[10px] text-[var(--muted-2)]">{item.step}</span>
                  </div>
                  <h3 className="mt-5 text-[18px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">{item.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-[11px] text-[var(--muted)]">三个示例已经在工作台里，不用在这里找</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/app')}>
              打开示例 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        <section data-reveal className="container-wide pb-16 text-center lg:pb-24">
          <span className="seal mx-auto">证</span>
          <h2 className="display-lg mt-5">先看证据，再信结论</h2>
          <p className="mt-3 text-[12px] text-[var(--muted)]">打开工作台，点任意数字试试</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>
              开始 <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/about')}>
              关于证析
            </button>
          </div>
        </section>

        <section id="login" data-reveal className="relative border-t border-[var(--line)] py-14 lg:py-20">
          <span className="hero-orb three" />
          <span className="hero-orb four" />
          <div className="container-wide grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="kicker">账号</div>
              <h2 className="display-lg mt-3">登录后，上传自己的材料</h2>
              <p className="mt-3 max-w-lg text-[12px] leading-6 text-[var(--muted)]">
                登录/注册在首页下方慢慢浮现，不用跳来跳去只看三个示例，仍然不用登录
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>
                  先看示例 <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/login')}>
                  单独打开登录页
                </button>
              </div>
            </div>
            <AuthCard className="mx-auto" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="container-wide flex flex-col items-start justify-between gap-3 py-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Logo compact />
            <div>
              <p className="text-[11px] font-semibold">证析 EvidenceFlow</p>
              <p className="mt-0.5 text-[9px] text-[var(--muted)]">可审计的 AI 经营分析台</p>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] text-[var(--muted)]">
            <button type="button" onClick={() => scrollTo('about')} className="rounded-full px-3 py-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">关于</button>
            <button type="button" onClick={() => scrollTo('login')} className="rounded-full px-3 py-1.5 hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">登录</button>
            <span>2026 AI Web 挑战赛</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EvidencePreview() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mx-auto max-w-[520px]">
      <div className="absolute -inset-3 rotate-2 rounded-[34px] border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]" />
      <div className="absolute -inset-6 -rotate-1 rounded-[42px] border border-[var(--line)] opacity-60" />
      <div className="glass float-slow absolute -left-5 top-8 z-20 hidden items-center gap-2 px-3 py-2 sm:flex">
        <span className="status-dot text-[var(--verified)]" />
        <span className="text-[10px] font-semibold">27 条主张</span>
      </div>
      <div className="glass float-slow delay absolute -right-4 bottom-16 z-20 hidden px-3 py-2 sm:block">
        <p className="mono text-[13px] font-semibold text-[var(--verified)]">96.3%</p>
        <p className="text-[10px] text-[var(--muted)]">引用覆盖</p>
      </div>

      <div className="glass relative z-10 overflow-hidden p-4 shadow-[var(--shadow-lg)] sm:p-5">
        <span className="scan-line" />
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--verified)]" />
            <span className="text-[11px] font-bold text-[var(--verified)]">已核对</span>
          </div>
          <span className="chip">证据卡</span>
        </div>

        <p className="mt-4 text-[11px] font-semibold text-[var(--muted)]">Q3 全渠道 GMV</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group/metric mt-1 flex items-baseline gap-1.5 text-left"
          aria-label="查看 1,840 万元 GMV 的原文证据"
        >
          <span className="metric text-[46px] underline decoration-[var(--accent)]/30 decoration-dotted underline-offset-8 transition-colors group-hover/metric:text-[var(--accent)]">1,840</span>
          <span className="text-[11px] font-semibold text-[var(--muted)]">万元</span>
          <span className="ml-1 text-[9px] font-semibold text-[var(--accent)] opacity-70">查看原文 ↗</span>
        </button>

        <div className="mt-4 rounded-2xl bg-[var(--surface-2)] px-3 py-2.5">
          <p className="text-[12px] leading-6 text-[var(--ink-soft)]">
            “Q3 全渠道 GMV 完成 <span className="highlight-quote">1,840 万元</span>，季度目标 1,600 万元”
          </p>
          <p className="mono mt-2 text-[10px] text-[var(--muted-2)]">澄野生活_Q3经营复盘纪要.txt · 第 4 段</p>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2">
          <span className="mono text-[11px] text-[var(--muted)]">1,840 ÷ 1,600</span>
          <span className="mono text-[12px] font-semibold text-[var(--verified)]">= 115.0%</span>
        </div>
      </div>

      <div className="relative z-20 ml-auto mt-3 w-[92%] rounded-2xl border border-[var(--warning)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--warning)]">
            <TriangleAlert className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">待核实</span>
          </div>
          <span className="mono text-[10px] text-[var(--muted-2)]">+28.4%</span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
          同比有引用，但材料没给去年同期绝对值已从摘要里拦掉
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-transparent"
            onClick={() => setOpen(false)}
            aria-label="关闭证据预览"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="GMV 原文证据"
            className="relative w-full max-w-lg rounded-3xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[var(--verified)]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[11px] font-bold">已核对 · 可回原文</span>
                </div>
                <h3 className="mt-3 text-[24px] font-bold tracking-tight">1,840 <span className="text-[12px] font-semibold text-[var(--muted)]">万元</span></h3>
              </div>
              <button type="button" className="btn btn-icon btn-quiet" onClick={() => setOpen(false)} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 border-l-2 border-[var(--accent)] pl-3 text-[13px] leading-7 text-[var(--ink-soft)]">
              “Q3 全渠道 GMV 完成 <span className="highlight-quote">1,840 万元</span>，季度目标 1,600 万元”
            </p>
            <p className="mono mt-2 text-[10px] text-[var(--muted-2)]">澄野生活_Q3经营复盘纪要.txt · 第 4 段</p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2.5">
              <span className="mono text-[11px] text-[var(--muted)]">1,840 ÷ 1,600</span>
              <span className="mono text-[13px] font-semibold text-[var(--verified)]">= 115.0%</span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">公式由本地计算器复算，不是模型心算；分母和基期都留在原文里</p>
          </div>
        </div>
      )}

      <div className="absolute -left-3 top-24 hidden sm:block">
        <Sparkles className="h-5 w-5 text-[var(--accent)] opacity-60" />
      </div>
    </div>
  );
}
