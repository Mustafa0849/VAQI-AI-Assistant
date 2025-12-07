export type TransactionResponse = {
  type: 'CHAT' | 'TRANSACTION';
  data: {
    summary: string;
    action_type: 'TRANSFER' | 'SWAP' | 'STAKE' | 'NONE';
    params: {
      amount?: string | null;
      token?: string | null;
      recipient?: string | null;
      target_token?: string | null;
    };
  };
};

// Legacy type for backward compatibility
export type TransactionIntent = TransactionResponse;

// Chat Message for memory
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Activity Log Entry
export interface ActivityLogEntry {
  type: 'TRANSFER' | 'BATCH_TRANSFER' | 'DEFI_SUPPLY' | 'SWAP' | 'STAKE';
  digest: string;
  amount?: string;
  recipient?: string;
  recipients?: string[];
  timestamp: number;
  status: 'success' | 'failed';
}

// Contact for Address Book
export interface Contact {
  name: string;
  address: string;
}

// Wallet Memory - stored on Walrus
export interface WalletMemory {
  walletAddress: string;
  chatHistory: ChatMessage[];
  aiSummary: string;
  activityLogs: ActivityLogEntry[];
  contacts: Contact[];
  lastUpdated: number;
  blobId?: string;
}

// Walrus blob response
export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      blobId: string;
    };
  };
  alreadyCertified?: {
    blobId: string;
  };
}


