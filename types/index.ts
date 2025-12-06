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


