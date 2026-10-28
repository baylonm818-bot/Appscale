import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center bg-white rounded-2xl border-2 border-red-100 shadow-sm mx-auto max-w-xl my-8">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 ring-8 ring-red-50/50">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            Something went wrong loading this module
          </h2>
          <p className="text-sm text-gray-600 mt-2 max-w-md leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred. Please try again or return to dashboard.'}
          </p>

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-[#1b5e20] to-[#2e7d32] text-white font-bold text-xs shadow-sm hover:from-[#154a1a] hover:to-[#256427] transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Try Again</span>
            </button>
            <a
              href="/admin/dashboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition cursor-pointer"
            >
              <Home size={14} />
              <span>Back to Dashboard</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
