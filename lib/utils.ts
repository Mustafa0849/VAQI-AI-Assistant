import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TransactionParams } from "@/lib/schemas/transaction"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Executes a TRANSFER transaction
 * @param params - Transaction parameters (amount, token, recipient)
 */
export function executeTransfer(params: TransactionParams) {
  console.log('Executing TRANSFER:', params);
  
  // TODO: Implement Sui transfer logic
  // 1. Connect to wallet
  // 2. Build transfer transaction
  // 3. Show confirmation modal
  // 4. Execute on user confirmation
  
  return {
    type: 'TRANSFER',
    params,
    status: 'pending',
  };
}

/**
 * Executes a SWAP transaction
 * @param params - Transaction parameters (amount, token, target_token)
 */
export function executeSwap(params: TransactionParams) {
  console.log('Executing SWAP:', params);
  
  // TODO: Implement Sui swap logic
  // 1. Connect to wallet
  // 2. Build swap transaction (e.g., using DEX protocol)
  // 3. Show confirmation modal
  // 4. Execute on user confirmation
  
  return {
    type: 'SWAP',
    params,
    status: 'pending',
  };
}

/**
 * Executes a STAKE transaction
 * @param params - Transaction parameters (amount, token)
 */
export function executeStake(params: TransactionParams) {
  console.log('Executing STAKE:', params);
  
  // TODO: Implement Sui staking logic
  // 1. Connect to wallet
  // 2. Build stake transaction
  // 3. Show confirmation modal
  // 4. Execute on user confirmation
  
  return {
    type: 'STAKE',
    params,
    status: 'pending',
  };
}


