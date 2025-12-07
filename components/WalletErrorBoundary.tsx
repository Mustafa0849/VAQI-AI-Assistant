'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if error is related to MetaMask
    const isMetaMaskError = 
      error?.message?.toLowerCase().includes('metamask') ||
      error?.message?.toLowerCase().includes('failed to connect') ||
      error?.stack?.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn');

    // If it's a MetaMask error, ignore it and don't show error boundary
    if (isMetaMaskError) {
      console.warn('⚠️ MetaMask error ignored (not a Sui wallet):', error.message);
      return { hasError: false, error: null };
    }

    // For other errors, show error boundary
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Check if error is related to MetaMask
    const isMetaMaskError = 
      error?.message?.toLowerCase().includes('metamask') ||
      error?.message?.toLowerCase().includes('failed to connect') ||
      error?.stack?.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn');

    if (isMetaMaskError) {
      console.warn('⚠️ MetaMask connection attempt ignored:', error.message);
      // Reset error state to allow app to continue
      this.setState({ hasError: false, error: null });
      return;
    }

    console.error('❌ Wallet Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Only show error UI for non-MetaMask errors
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Wallet Connection Error</h2>
            <p className="text-gray-400 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

