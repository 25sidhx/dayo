"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">😓</div>
            <h2 className="font-heading text-2xl text-[#1A1A2E] mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-2 text-sm">Don&apos;t worry — your data is safe.</p>
            <p className="text-gray-400 mb-6 text-xs font-mono break-all">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#6366F1] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#4F46E5] transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
