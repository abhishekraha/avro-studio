import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught React render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 font-mono">
          <div className="max-w-xl w-full bg-gray-900 border border-rose-800 rounded-xl p-6 shadow-2xl">
            <h1 className="text-xl font-bold text-rose-400 mb-2">Application Render Error</h1>
            <p className="text-sm text-gray-300 mb-4">
              An error occurred during client-side rendering:
            </p>
            <pre className="bg-black/60 p-4 rounded text-xs text-rose-300 overflow-auto whitespace-pre-wrap mb-4 border border-rose-950">
              {this.state.error?.message || String(this.state.error)}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => {
                window.localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded font-sans text-xs transition"
            >
              Reset Local Storage & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
