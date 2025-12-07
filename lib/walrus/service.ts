import type { WalletMemory, WalrusUploadResponse } from '@/types';

// Walrus Testnet Endpoints
const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

// Storage duration in epochs (1 epoch ≈ 1 day on testnet)
const DEFAULT_EPOCHS = 5;

/**
 * Upload data to Walrus
 * @param data - The data to upload (will be JSON stringified)
 * @param epochs - Number of epochs to store (default: 5)
 * @returns The blob ID if successful
 */
export async function uploadToWalrus(
  data: WalletMemory,
  epochs: number = DEFAULT_EPOCHS
): Promise<string | null> {
  try {
    const jsonData = JSON.stringify(data);
    const blob = new Blob([jsonData], { type: 'application/json' });

    console.log('📤 Uploading to Walrus...', {
      walletAddress: data.walletAddress,
      chatHistoryLength: data.chatHistory.length,
      activityLogsLength: data.activityLogs.length,
      contactsLength: data.contacts?.length || 0,
      blobSize: blob.size,
    });

    const response = await fetch(`${WALRUS_PUBLISHER}/v1/store?epochs=${epochs}`, {
      method: 'PUT',
      body: blob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Walrus upload failed:', response.status, errorText);
      return null;
    }

    const result: WalrusUploadResponse = await response.json();
    
    // Handle both newly created and already certified responses
    const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId;
    
    if (blobId) {
      console.log('✅ Walrus upload successful! BlobId:', blobId);
      return blobId;
    }

    console.error('❌ Walrus response missing blobId:', result);
    return null;
  } catch (error) {
    console.error('❌ Walrus upload error:', error);
    return null;
  }
}

/**
 * Download data from Walrus
 * @param blobId - The blob ID to download
 * @returns The wallet memory data if successful
 */
export async function downloadFromWalrus(blobId: string): Promise<WalletMemory | null> {
  try {
    console.log('📥 Downloading from Walrus...', { blobId });

    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);

    if (!response.ok) {
      // 404 means blob doesn't exist or expired
      if (response.status === 404) {
        console.log('ℹ️ Blob not found (may have expired):', blobId);
        return null;
      }
      const errorText = await response.text();
      console.error('❌ Walrus download failed:', response.status, errorText);
      return null;
    }

    const data: WalletMemory = await response.json();
    console.log('✅ Walrus download successful!', {
      walletAddress: data.walletAddress,
      chatHistoryLength: data.chatHistory.length,
      activityLogsLength: data.activityLogs.length,
      contactsLength: data.contacts?.length || 0,
    });

    return data;
  } catch (error) {
    console.error('❌ Walrus download error:', error);
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

