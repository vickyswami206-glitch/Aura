/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import VoiceAssistant from './components/VoiceAssistant';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0502] text-white flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-orange-500">Something went wrong</h1>
          <p className="text-white/60 mb-6 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred in the assistant.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <VoiceAssistant />
    </ErrorBoundary>
  );
}

