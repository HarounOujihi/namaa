import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Last line of defence: an unexpected render error (e.g. a browser missing a
 * feature) shows a calm recovery screen instead of an empty page. Lives
 * outside the router, so its actions are plain page loads.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("App crashed", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <main className="screen crash-screen" role="alert">
        <span className="crash-owl" aria-hidden="true">
          🦉
        </span>
        <h1 className="crash-title">حدث خطأ غير متوقّع</h1>
        <p className="crash-text">لا تقلق، أعد المحاولة. إذا تكرّر الأمر فافتح الرابط في متصفح Chrome أو Safari بعد تحديثه.</p>
        <div className="crash-actions">
          <button type="button" className="big-button confirm" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </button>
          <a className="big-button neutral" href="/">
            الصفحة الرئيسية
          </a>
        </div>
      </main>
    );
  }
}
