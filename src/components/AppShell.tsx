import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CircleHelp,
  Command,
  FileSearch,
  History,
  Info,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAnalysisStore } from '../store/analysis';
import { useSettingsStore } from '../store/settings';
import { useAuthStore } from '../store/auth';
import { cn, relativeTime } from '../lib/format';

const NAV = [
  { to: '/app?new=1', label: '工作台', icon: FileSearch, hint: '上传材料 / 查看证据' },
  { to: '/about', label: '关于', icon: Info, hint: '为什么做 / 怎么工作' },
  { to: '/settings', label: '外观与 API', icon: Settings, hint: '主题 / 模型 / 隐私' },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('evidenceflow-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const history = useAnalysisStore((state) => state.history);
  const loadHistory = useAnalysisStore((state) => state.loadHistory);
  const mode = useSettingsStore((state) => state.mode);
  const setMode = useSettingsStore((state) => state.setMode);
  const user = useAuthStore((state) => state.user);
  const check = useAuthStore((state) => state.check);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    try {
      localStorage.setItem('evidenceflow-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // localStorage 可能被隐私模式禁用
    }
  }, [sidebarCollapsed]);

  const title =
    location.pathname.startsWith('/settings')
      ? '外观与 API'
      : location.pathname.startsWith('/about')
        ? '关于'
        : '工作台';

  const toggleTheme = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <div className={cn('app-shell', sidebarCollapsed && 'sidebar-collapsed')}>
      {menuOpen && <div className="overlay z-40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside className={cn('sidebar', menuOpen && 'open', sidebarCollapsed && 'collapsed')}>
        <div className="flex h-[var(--header)] items-center justify-between border-b border-[var(--line)] px-5">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-icon btn-quiet hidden lg:inline-flex"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="收起侧栏"
              title="收起侧栏"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-icon btn-quiet lg:hidden" onClick={() => setMenuOpen(false)} aria-label="关闭菜单">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="py-3" />

        <nav className="space-y-0.5 px-2" aria-label="主导航">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-3 w-3 opacity-40" />
              </NavLink>
            );
          })}
        </nav>

        <div className="mx-3 my-4 h-px bg-[var(--line)]" />

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="label">最近分析</span>
            <History className="h-3 w-3 text-[var(--muted-2)]" />
          </div>
          {history.length === 0 ? (
            <p className="px-1 text-[10px] leading-relaxed text-[var(--muted-2)]">还没有记录载入一个示例，或上传你的会议纪要</p>
          ) : (
            <ul className="space-y-1">
              {history.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      loadHistory(item.id);
                      navigate('/app');
                      setMenuOpen(false);
                    }}
                    className="w-full border border-transparent px-2 py-2 text-left transition-colors hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
                  >
                    <p className="truncate text-[11px] font-semibold">{item.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
                      <span>{item.mode === 'demo' ? '示例' : item.mode === 'local' ? '本地' : '实时'}</span>
                      <span>·</span>
                      <span>{relativeTime(item.createdAt)}</span>
                      {item.safety.blockedClaims > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--warning)]">拦截 {item.safety.blockedClaims}</span>
                        </>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]">
            <span className="status-dot text-[var(--verified)]" />
            {user ? `已登录 · ${user.username}` : '游客 · 可离线演示'}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="mono text-[8px] tracking-wider text-[var(--muted-2)]">v0.1 / BUILD 2026.10</span>
            <button type="button" onClick={() => navigate('/about')} className="text-[9px] text-[var(--muted)] hover:text-[var(--ink)]" aria-label="关于">
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            {sidebarCollapsed && <span className="hidden lg:inline-flex"><Logo compact /></span>}
            <button
              type="button"
              className="btn btn-icon btn-quiet hidden lg:inline-flex"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
              title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button type="button" className="btn btn-icon btn-quiet lg:hidden" onClick={() => setMenuOpen(true)} aria-label="打开菜单">
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 text-[11px] text-[var(--muted)] sm:flex">
              <span>工作区</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-[var(--ink)]">{title}</span>
            </div>
            <span className="mono rounded border border-[var(--line)] px-1.5 py-0.5 text-[8px] text-[var(--muted)] sm:hidden">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 md:flex">
              <Command className="h-3 w-3 text-[var(--muted)]" />
              <span className="mono text-[9px] text-[var(--muted)]">K</span>
              <span className="text-[9px] text-[var(--muted)]">快速开始</span>
            </div>
            <button type="button" className="btn btn-icon btn-quiet" onClick={toggleTheme} aria-label="切换深浅色">
              {mode === 'dark' || (mode === 'system' && document.documentElement.dataset.theme === 'dark') ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button type="button" className="btn btn-icon btn-quiet" onClick={() => navigate('/settings')} aria-label="打开设置">
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/login')}
              aria-label={user ? `已登录 ${user.username}` : '登录'}
            >
              {user ? <UserRound className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{user ? user.username : '登录'}</span>
            </button>

          </div>
        </header>

        <main className="min-h-[calc(100vh-var(--header))] pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
