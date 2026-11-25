import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage =
        'Something went wrong while loading or saving your workspace. Please reload the page and try again.';

      if (this.state.message.includes('Quota exceeded')) {
        friendlyMessage =
          'Daily database quota has been reached. Your local data remains safe in this browser, and cloud quota resets tomorrow.';
      } else if (this.state.message.includes('Missing or insufficient permissions')) {
        friendlyMessage =
          'Unable to access this cloud workspace with the current account. Please sign out and sign back in with your Google account.';
      }

      return (
        <div className="min-h-screen bg-lemonade text-charcoal flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-stone-200 p-8 space-y-4">
            <h1 className="font-display text-2xl font-bold text-charcoal">
              Unable to Complete Action
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">{friendlyMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-mango hover:bg-orange-600 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
