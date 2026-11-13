import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { getAiVariant } from './lib/aiVariant';
import { Landing } from './pages/Landing';
import { Workspace } from './pages/Workspace';
import { Login } from './pages/Login';
import { About } from './pages/About';

const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function LazyFallback() {
  return (
    <div className="container-wide py-8" aria-busy="true" aria-label="正在加载页面">
      <div className="mb-4 h-5 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
      <div className="mb-6 h-9 w-2/3 animate-pulse rounded bg-[var(--surface-3)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="mt-4 h-40 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface-2)]" />
    </div>
  );
}

function AiVariantBadge() {
  const location = useLocation();
  const queryVariant = new URLSearchParams(location.search).get('ai');
  const [variant, setVariant] = useState(() => {
    return getAiVariant() || '';
  });

  useEffect(() => {
    if (!queryVariant) return;
    const value = queryVariant.toUpperCase();
    setVariant(value);
    try { sessionStorage.setItem('evidenceflow-ai-variant', value); } catch {}
  }, [queryVariant]);

  useEffect(() => {
    document.documentElement.dataset.ai = variant;
    return () => { delete document.documentElement.dataset.ai; };
  }, [variant]);

  if (!variant) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[70] flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 text-[var(--accent-ink)] shadow-[var(--shadow-lg)]">
      <span className="mono text-[9px] font-bold opacity-70">AI</span>
      <span className="text-[11px] font-black tracking-[0.16em]">{variant}</span>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AiVariantBadge />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/app" element={<Workspace />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<LazyFallback />}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
        <Route path="/workspace" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="mono text-[10px] tracking-[0.2em] text-[var(--muted)]">404 / 页面不存在</p>
        <h1 className="display-md mt-3">这条证据链不存在</h1>
        <p className="mt-3 text-[12px] leading-6 text-[var(--muted)]">链接可能已过期，或者你访问了一个还没有被创建的分析</p>
        <a href="/app" className="btn btn-primary mt-5">
          回到工作台
        </a>
      </div>
    </div>
  );
}
