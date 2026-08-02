'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches React rendering errors and displays
 * a professional fallback UI instead of crashing the entire page.
 *
 * Usage in layout:
 * ```tsx
 * <ErrorBoundary>
 *   <YourApp />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log the error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    // Call custom error handler (e.g., Sentry)
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default professional fallback UI
      return (
        <div className="flex min-h-[400px] items-center justify-center bg-paper">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-soft">
                <AlertTriangle size={32} className="text-danger" />
              </div>
            </div>

            <h2 className="mb-2 font-serif text-2xl font-semibold text-ink">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-ink-soft">
              An unexpected error occurred. Our team has been notified.
              You can try reloading the page or going back to the dashboard.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-hover active:scale-95"
              >
                <RefreshCw size={16} />
                Try again
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-paper active:scale-95"
              >
                <Home size={16} />
                Go to Dashboard
              </a>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 rounded-xl border border-danger/20 bg-danger-soft/50 p-4 text-left">
                <p className="mb-1 text-xs font-semibold text-danger">Error Details (Dev Only)</p>
                <p className="font-mono text-xs text-danger/80">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
