import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * 错误边界：AI 应用最常见的翻车不是接口报错，而是某条结构化数据缺字段导致整页白屏
 * 这里兜住渲染错误，给评审一个可恢复的出口
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="panel max-w-lg p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-[var(--line-strong)] text-[var(--warning)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="display-md">这一页的证据链断了</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              渲染时遇到一个未处理的异常你的本地历史记录不会丢失，可以刷新或回到工作台重新开始
            </p>
            <pre className="mono mt-4 max-h-28 overflow-auto border border-[var(--line)] bg-[var(--surface-2)] p-3 text-left text-[10px] text-[var(--muted)]">
              {this.state.message}
            </pre>
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                <RotateCcw className="h-3.5 w-3.5" /> 刷新页面
              </button>
              <a href="/app" className="btn btn-ghost">
                回到工作台
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
