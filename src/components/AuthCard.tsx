import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Loader2, LockKeyhole, UserPlus, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/format';

type Tab = 'login' | 'register';

export function AuthCard({ className, onSuccess }: { className?: string; onSuccess?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const clearError = useAuthStore((state) => state.clearError);
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    if (tab === 'register' && password !== confirm) {
      useAuthStore.setState({ error: '两次输入的密码不一样。' });
      return;
    }
    const ok = tab === 'login'
      ? await login(username, password)
      : await register(username, password, displayName);
    if (ok) {
      if (onSuccess) onSuccess();
      else navigate('/app');
    }
  };

  return (
    <section className={cn('glass w-full max-w-md p-6 sm:p-8', className)}>
      {user ? (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[12px] text-[var(--muted)]">当前已登录</p>
              <p className="text-[16px] font-bold">{user.displayName || user.username}</p>
              <p className="mono text-[9px] text-[var(--muted)]">@{user.username}</p>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button type="button" className="btn btn-primary btn-lg flex-1" onClick={() => navigate('/app')}>
              进入工作台 <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              退出
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <div className="flex rounded-full bg-[var(--surface-2)] p-1">
            <button
              type="button"
              onClick={() => { setTab('login'); clearError(); }}
              className={cn('flex-1 rounded-full px-3 py-2 text-[12px] font-semibold', tab === 'login' ? 'bg-[var(--surface)] shadow-sm' : 'text-[var(--muted)]')}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); clearError(); }}
              className={cn('flex-1 rounded-full px-3 py-2 text-[12px] font-semibold', tab === 'register' ? 'bg-[var(--surface)] shadow-sm' : 'text-[var(--muted)]')}
            >
              注册
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {tab === 'login' ? <LockKeyhole className="h-5 w-5 text-[var(--accent)]" /> : <UserPlus className="h-5 w-5 text-[var(--accent)]" />}
            <h2 className="text-[18px] font-bold">{tab === 'login' ? '输入手机号或评审账号' : '创建账号'}</h2>
          </div>

          {tab === 'register' && (
            <>
              <label className="field-label mt-5" htmlFor="login-name">昵称</label>
              <input
                id="login-name"
                className="input"
                value={displayName}
                onChange={(event) => { setDisplayName(event.target.value); clearError(); }}
                placeholder="输入昵称"
                autoComplete="nickname"
              />
            </>
          )}

          <label className="field-label mt-4" htmlFor="login-user">{tab === 'login' ? '手机号 / 评审账号' : '手机号'}</label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              id="login-user"
              type={tab === 'login' ? 'text' : 'tel'}
              className="input pl-10"
              value={username}
              onChange={(event) => { setUsername(event.target.value); clearError(); }}
              placeholder={tab === 'login' ? '手机号或 review@evidenceflow.local' : '输入手机号'}
              autoComplete={tab === 'login' ? 'username' : 'tel'}
              maxLength={tab === 'register' ? 11 : undefined}
            />
          </div>

          <label className="field-label mt-4" htmlFor="login-pass">密码</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              id="login-pass"
              type="password"
              className="input pl-10"
              value={password}
              onChange={(event) => { setPassword(event.target.value); clearError(); }}
              placeholder={tab === 'register' ? '6–64 位' : '输入密码'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' && (
            <>
              <label className="field-label mt-4" htmlFor="login-confirm">再输一次密码</label>
              <input
                id="login-confirm"
                type="password"
                className="input"
                value={confirm}
                onChange={(event) => { setConfirm(event.target.value); clearError(); }}
                autoComplete="new-password"
              />
            </>
          )}

          {error && <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[11px] text-[var(--danger)]">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg mt-6 w-full" disabled={loading || !username || !password || (tab === 'register' && !confirm)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? '处理中' : tab === 'login' ? '登录' : '注册并登录'}
          </button>

          <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => navigate('/app')}>
            不登录，先看示例
          </button>
        </form>
      )}
    </section>
  );
}
