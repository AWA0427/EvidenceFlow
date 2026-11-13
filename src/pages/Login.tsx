import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { AuthCard } from '../components/AuthCard';

export function Login() {
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
        <div className="container-wide flex h-16 items-center justify-between">
          <Logo />
          <Link to="/" className="btn btn-quiet btn-sm">
            返回首页
          </Link>
        </div>
      </header>

      <main className="container-wide grid min-h-[calc(100vh-64px)] items-center gap-10 py-10 lg:grid-cols-2">
        <section className="max-w-lg">
          <div className="kicker">Account</div>
          <h1 className="display-lg mt-4">登录 / 注册</h1>
          <p className="mt-4 text-[13px] leading-7 text-[var(--muted)]">
            登录后可以上传自己的材料只看三个示例，不用登录
          </p>
          <div className="mt-6 space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[12px] leading-6">
            <p>账号会保存到本机 data 目录，密码只存哈希，不存明文</p>
            <p className="text-[var(--muted)]">没有账号可以直接注册；只看示例不用登录</p>
          </div>
        </section>

        <AuthCard className="fade-up mx-auto" />
      </main>
    </div>
  );
}
