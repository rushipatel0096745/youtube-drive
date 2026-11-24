import React from "react";
import { RefreshCw } from "lucide-react";

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6">
          <div className="text-center space-y-3 max-w-sm">
            <p className="text-red-400 text-lg font-semibold">Something went wrong</p>
            <p className="text-zinc-400 text-sm font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
