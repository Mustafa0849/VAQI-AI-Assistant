'use client';

import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css'; // Cüzdan stillerini ekle
import { WalletErrorBoundary } from '@/components/WalletErrorBoundary';
import { useEffect } from 'react';

// Ağ ayarları (Mainnet, Testnet, Devnet)
const { networkConfig } = createNetworkConfig({
	localnet: { url: getFullnodeUrl('localnet') },
	devnet: { url: getFullnodeUrl('devnet') },
	testnet: { url: getFullnodeUrl('testnet') },
	mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
	// Global error handler to catch and ignore MetaMask errors
	useEffect(() => {
		const handleError = (event: ErrorEvent) => {
			const error = event.error || event.message || '';
			const errorString = String(error).toLowerCase();
			const errorStack = event.error?.stack?.toLowerCase() || '';

			// Check if error is related to MetaMask
			const isMetaMaskError = 
				errorString.includes('metamask') ||
				errorString.includes('failed to connect') ||
				errorStack.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn') ||
				errorStack.includes('nkbihfbeogaeaoehlefnkodbefgpgknn');

			if (isMetaMaskError) {
				console.warn('⚠️ MetaMask error ignored (not a Sui wallet):', event.error?.message || event.message);
				event.preventDefault(); // Prevent error from showing in console
				return false;
			}
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			const reason = event.reason || '';
			const reasonString = String(reason).toLowerCase();
			const reasonStack = reason?.stack?.toLowerCase() || '';

			// Check if rejection is related to MetaMask
			const isMetaMaskError = 
				reasonString.includes('metamask') ||
				reasonString.includes('failed to connect') ||
				reasonStack.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn') ||
				reasonStack.includes('nkbihfbeogaeaoehlefnkodbefgpgknn');

			if (isMetaMaskError) {
				console.warn('⚠️ MetaMask promise rejection ignored:', reason);
				event.preventDefault(); // Prevent unhandled rejection
			}
		};

		window.addEventListener('error', handleError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	}, []);

	return (
		<WalletErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
					<WalletProvider autoConnect={false}>
						{children}
					</WalletProvider>
				</SuiClientProvider>
			</QueryClientProvider>
		</WalletErrorBoundary>
	);
}

