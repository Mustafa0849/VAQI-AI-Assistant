import type { WalletMemory, WalrusUploadResponse } from '@/types';

// Walrus Testnet Endpoints - can be overridden via environment variables
const WALRUS_PUBLISHER = 
  (typeof window !== 'undefined' ? (window as any).__WALRUS_PUBLISHER__ : null) ||
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ||
  'https://publisher.walrus-testnet.walrus.space';
  
const WALRUS_AGGREGATOR = 
  (typeof window !== 'undefined' ? (window as any).__WALRUS_AGGREGATOR__ : null) ||
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ||
  'https://aggregator.walrus-testnet.walrus.space';

// Storage duration in epochs (1 epoch ≈ 1 day on testnet)
const DEFAULT_EPOCHS = 5;

// Upload timeout in milliseconds (10 seconds)
const UPLOAD_TIMEOUT = 10000;

// Download timeout in milliseconds (10 seconds)
const DOWNLOAD_TIMEOUT = 10000;

/**
 * Create a fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Upload data to Walrus via backend proxy
 * @param data - The data to upload (will be JSON stringified)
 * @param epochs - Number of epochs to store (default: 5)
 * @returns The blob ID if successful, null on error
 */
export async function uploadToWalrus(
  data: WalletMemory,
  epochs: number = DEFAULT_EPOCHS
): Promise<string | null> {
  // Use backend proxy to avoid CORS issues
  const uploadUrl = `/api/walrus/save?epochs=${epochs}`;
  
  try {
    console.log('📤 [Walrus] Starting upload via proxy...', {
      walletAddress: data.walletAddress,
      chatHistoryLength: data.chatHistory.length,
      activityLogsLength: data.activityLogs.length,
      contactsLength: data.contacts?.length || 0,
      epochs,
    });

    const jsonData = JSON.stringify(data);
    
    console.log('📤 [Walrus] Data prepared, size:', jsonData.length, 'bytes');

    const startTime = Date.now();
    const response = await fetchWithTimeout(
      uploadUrl,
      {
        method: 'PUT',
        body: jsonData,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      UPLOAD_TIMEOUT
    );

    const elapsed = Date.now() - startTime;
    console.log('📤 [Walrus] Response received after', elapsed, 'ms, status:', response.status);

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.details || errorData.error || 'Unknown error';
      } catch (e) {
        errorText = 'Could not read error response';
      }
      console.error('❌ [Walrus] Upload failed:', {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    console.log('📤 [Walrus] Parsing response JSON...');
    const result: WalrusUploadResponse = await response.json();
    console.log('📤 [Walrus] Response parsed:', {
      hasNewlyCreated: !!result.newlyCreated,
      hasAlreadyCertified: !!result.alreadyCertified,
    });
    
    // Handle both newly created and already certified responses
    const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId;
    
    if (blobId) {
      console.log('✅ [Walrus] Upload successful! BlobId:', blobId, 'Total time:', elapsed, 'ms');
      return blobId;
    }

    console.error('❌ [Walrus] Response missing blobId:', JSON.stringify(result, null, 2));
    return null;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || error.name === 'AbortError';
    
    console.error('❌ [Walrus] Upload error:', {
      error: errorMessage,
      isTimeout,
    });

    if (isTimeout) {
      console.error('⏱️ [Walrus] Upload timed out after', UPLOAD_TIMEOUT, 'ms');
    }

    return null;
  }
}

/**
 * Download data from Walrus via backend proxy
 * @param blobId - The blob ID to download
 * @returns The wallet memory data if successful
 */
export async function downloadFromWalrus(blobId: string): Promise<WalletMemory | null> {
  // Use backend proxy to avoid CORS issues
  const downloadUrl = `/api/walrus/get?blobId=${encodeURIComponent(blobId)}`;
  
  try {
    console.log('📥 [Walrus] Starting download via proxy...', { blobId });

    const startTime = Date.now();
    const response = await fetchWithTimeout(
      downloadUrl,
      { method: 'GET' },
      DOWNLOAD_TIMEOUT
    );

    const elapsed = Date.now() - startTime;
    console.log('📥 [Walrus] Response received after', elapsed, 'ms, status:', response.status);

    if (!response.ok) {
      // 404 means blob doesn't exist or expired
      if (response.status === 404) {
        console.log('ℹ️ [Walrus] Blob not found (may have expired):', blobId);
        return null;
      }
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.details || errorData.error || 'Unknown error';
      } catch (e) {
        errorText = 'Could not read error response';
      }
      console.error('❌ [Walrus] Download failed:', {
        status: response.status,
        error: errorText,
        blobId,
      });
      return null;
    }

    console.log('📥 [Walrus] Parsing response JSON...');
    const data: WalletMemory = await response.json();
    console.log('✅ [Walrus] Download successful!', {
      walletAddress: data.walletAddress,
      chatHistoryLength: data.chatHistory.length,
      activityLogsLength: data.activityLogs.length,
      contactsLength: data.contacts?.length || 0,
      totalTimeMs: elapsed,
    });

    return data;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || error.name === 'AbortError';
    
    console.error('❌ [Walrus] Download error:', {
      error: errorMessage,
      isTimeout,
      blobId,
    });

    if (isTimeout) {
      console.error('⏱️ [Walrus] Download timed out after', DOWNLOAD_TIMEOUT, 'ms');
    }

    return null;
  }
}

/**
 * Create an empty wallet memory object
 * @param walletAddress - The wallet address
 * @returns A new empty WalletMemory object
 */
export function createEmptyMemory(walletAddress: string): WalletMemory {
  return {
    walletAddress,
    chatHistory: [],
    aiSummary: '',
    activityLogs: [],
    contacts: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Get the localStorage key for storing blobId mapping
 * @param walletAddress - The wallet address
 * @returns The localStorage key
 */
export function getBlobIdStorageKey(walletAddress: string): string {
  return `walrus_blob_${walletAddress}`;
}

/**
 * Save blobId to localStorage for quick lookup
 * @param walletAddress - The wallet address
 * @param blobId - The Walrus blob ID
 */
export function saveBlobIdLocally(walletAddress: string, blobId: string): void {
  try {
    localStorage.setItem(getBlobIdStorageKey(walletAddress), blobId);
    console.log('💾 Saved blobId to localStorage:', blobId);
  } catch (error) {
    console.error('❌ Failed to save blobId to localStorage:', error);
  }
}

/**
 * Load blobId from localStorage
 * @param walletAddress - The wallet address
 * @returns The blob ID if found
 */
export function loadBlobIdLocally(walletAddress: string): string | null {
  try {
    const blobId = localStorage.getItem(getBlobIdStorageKey(walletAddress));
    if (blobId) {
      console.log('📂 Loaded blobId from localStorage:', blobId);
    }
    return blobId;
  } catch (error) {
    console.error('❌ Failed to load blobId from localStorage:', error);
    return null;
  }
}

