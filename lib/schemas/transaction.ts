import { z } from 'zod';

export const TransactionParamsSchema = z.object({
  amount: z.string().nullable().optional(),
  token: z.string().nullable().optional(),
  recipient: z.string().nullable().optional(),
  recipients: z.array(z.string()).nullable().optional(), // For batch transfers
  target_token: z.string().nullable().optional(),
  isMax: z.boolean().nullable().optional(), // Flag for "all my SUI" transfers
});

export const TransactionDataSchema = z.object({
  summary: z.string(),
  action_type: z.enum(['TRANSFER', 'BATCH_TRANSFER', 'SWAP', 'STAKE', 'DEFI_SUPPLY', 'NONE']),
  params: TransactionParamsSchema,
});

export const TransactionResponseSchema = z.object({
  type: z.enum(['CHAT', 'TRANSACTION']),
  data: TransactionDataSchema,
});

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
export type TransactionData = z.infer<typeof TransactionDataSchema>;
export type TransactionParams = z.infer<typeof TransactionParamsSchema>;

// Legacy type for backward compatibility during migration
export type TransactionIntent = TransactionResponse;


