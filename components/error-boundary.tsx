'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 區塊名稱，顯示在錯誤訊息中方便回報 */
  label?: string;
  /** 自訂錯誤畫面；未提供時使用預設卡片 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 錯誤邊界。
 *
 * 專案先前沒有任何 error boundary，任一元件在 render 期間拋錯就是整頁白畫面
 * （React 18+ 的預設行為是卸載整棵樹）。外部資料格式變動、
 * 圖示載入失敗等情況都可能觸發，這裡把爆炸範圍限制在單一區塊內。
 *
 * 注意：error boundary 只攔截 render / lifecycle 期間的例外，
 * 攔不到事件處理器與非同步 callback 中的錯誤，那些仍需各自 try/catch。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, errorInfo.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <p className="font-semibold text-red-700 dark:text-red-300 mb-1">
          {this.props.label ? `${this.props.label} 載入失敗` : '此區塊載入失敗'}
        </p>
        <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4 break-all">
          {error.message}
        </p>
        <button
          onClick={this.reset}
          className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          重試
        </button>
      </div>
    );
  }
}
