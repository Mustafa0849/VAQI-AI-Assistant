'use client';

import { useState, useEffect } from 'react';
import { useSuiClientQuery, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, ExternalLink, Wallet, Send, Loader2, Coins } from 'lucide-react';
import type { TransactionResponse } from '@/lib/schemas/transaction';
import toast from 'react-hot-toast';

interface Contact {
  name: string;
  address: string;
}

interface DashboardPanelProps {
  intent: TransactionResponse | null;
  onClearIntent?: () => void;
  transactionDigest?: string | null;
  onTransactionSuccess?: (digest: string) => void;
}

type PanelState = 'IDLE' | 'PREVIEW' | 'SUCCESS';

export function DashboardPanel({ intent, onClearIntent, transactionDigest, onTransactionSuccess }: DashboardPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('IDLE');
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; type: string; description: string; timestamp: Date; digest?: string }>>([]);
  const [optimisticBalanceAdjustment, setOptimisticBalanceAdjustment] = useState<number>(0);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction, isPending: isTransactionPending } = useSignAndExecuteTransaction();

  // Fetch balance using useSuiClientQuery
  const { data: balanceData, isLoading: balanceLoading } = useSuiClientQuery(
    'getBalance',
    account?.address ? { owner: account.address } : { owner: '' },
    {
      enabled: !!account?.address,
    }
  );

  // Get wallet-specific storage key
  const getStorageKey = (): string | null => {
    if (!account?.address) return null;
    return `sui_address_book_${account.address}`;
  };

  // Load contacts from localStorage when wallet connects or changes
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) {
      // No wallet connected, clear contacts
      setContacts([]);
      return;
    }

    const savedContacts = localStorage.getItem(storageKey);
    if (savedContacts) {
      try {
        const parsedContacts = JSON.parse(savedContacts);
        setContacts(parsedContacts);
        if (account?.address) {
          console.log(`✅ Loaded ${parsedContacts.length} contacts for wallet ${account.address.slice(0, 6)}...`);
        }
      } catch (e) {
        console.error('Failed to load contacts from localStorage:', e);
        setContacts([]);
      }
    } else {
      // No saved contacts for this wallet, start with empty list
      setContacts([]);
    }
  }, [account?.address]); // Reload when wallet address changes

  // Update panel state based on props
  useEffect(() => {
    if (transactionDigest) {
      setPanelState('SUCCESS');
      
      // Add DEFI_SUPPLY transactions to recent activity
      if (intent && intent.type === 'TRANSACTION' && intent.data.action_type === 'DEFI_SUPPLY') {
        const amount = intent.data.params.amount || '0';
        const activityEntry = {
          id: Date.now().toString(),
          type: 'DEFI_SUPPLY',
          description: `Supplied ${amount} SUI to Scallop Protocol (Simulated)`,
          timestamp: new Date(),
          digest: transactionDigest,
        };
        setRecentActivity((prev) => [activityEntry, ...prev].slice(0, 10));
        
        // Update balance optimistically
        setOptimisticBalanceAdjustment((prev) => prev - parseFloat(amount));
        setTimeout(() => {
          setOptimisticBalanceAdjustment(0);
        }, 5000);
      }
    } else if (intent && intent.type === 'TRANSACTION') {
      setPanelState('PREVIEW');
    } else {
      setPanelState('IDLE');
    }
  }, [intent, transactionDigest]);

  // Format SUI balance from MIST with optimistic adjustment
  const formatBalance = (mist: string | undefined): string => {
    if (!mist) return '0.00';
    const sui = BigInt(mist) / BigInt(1_000_000_000);
    const remainder = BigInt(mist) % BigInt(1_000_000_000);
    const decimals = Number(remainder) / 1_000_000_000;
    const baseBalance = Number(sui) + decimals;
    // Apply optimistic adjustment for instant UI feedback
    const adjustedBalance = baseBalance + optimisticBalanceAdjustment;
    return Math.max(0, adjustedBalance).toFixed(2);
  };

  // Format address
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format recipient for display
  const formatRecipient = (recipient: string): { name: string | null; address: string } => {
    if (!recipient) return { name: null, address: '' };
    
    if (recipient.startsWith('0x')) {
      const contact = contacts.find(c => c.address.toLowerCase() === recipient.toLowerCase());
      return { name: contact?.name || null, address: recipient };
    }
    
    const contact = contacts.find(c => c.name.toLowerCase() === recipient.toLowerCase());
    return { name: contact?.name || null, address: contact?.address || recipient };
  };

  // Handle cancel
  const handleCancel = () => {
    if (onClearIntent) {
      onClearIntent();
    }
    setPanelState('IDLE');
  };

  // Handle done (after success)
  const handleDone = () => {
    if (onClearIntent) {
      onClearIntent();
    }
    setPanelState('IDLE');
  };

  // IDLE State - Wallet Dashboard
  if (panelState === 'IDLE') {
    return (
      <Card className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 space-y-6">
          {account ? (
            <>
              {/* Wallet Address */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Connected Wallet</p>
                <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <code className="flex-1 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {formatAddress(account.address)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(account.address)}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* SUI Balance */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">SUI Balance</p>
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  {balanceLoading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                      {formatBalance(balanceData?.totalBalance)} SUI
                    </p>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent Activity</p>
                <div className="flex-1 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-48">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No recent transactions</p>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 flex items-start gap-2">
                              {activity.type === 'DEFI_SUPPLY' && (
                                <Coins className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                  {activity.description}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {activity.timestamp.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                            {activity.digest && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const url = `https://suiscan.xyz/testnet/tx/${activity.digest}`;
                                  window.open(url, '_blank');
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Wallet className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Connect your wallet to view dashboard</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }


  // Handle Transfer Transaction
  const handleTransferTransaction = async () => {
    if (!intent || !account) {
      console.error('Transfer Transaction Error: Missing intent or account');
      toast.error('Please connect your wallet to execute the transfer.');
      return;
    }

    const recipient = intent.data.params.recipient || (intent.data.params as any).to_address || '';
    const amount = intent.data.params.amount || '0';

    // Validate recipient and amount
    if (!recipient) {
      console.error('Transfer Transaction Error: Missing recipient address');
      toast.error('Missing recipient address. Please provide a valid address or contact name.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Transfer Transaction Error: Invalid transfer amount', amount);
      toast.error('Invalid transfer amount. Please enter a valid amount.');
      return;
    }

    const { name, address } = formatRecipient(recipient);
    if (!address) {
      console.error('Transfer Transaction Error: Recipient address could not be resolved', recipient);
      toast.error(`Contact '${recipient}' not found. Please add them to your address book first.`);
      return;
    }

    // Show loading toast while waiting for wallet approval
    const loadingToast = toast.loading('Waiting for wallet approval...');

    try {
      console.log('🔄 Building transfer transaction...', { to: address, amount });

      // Convert SUI amount to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));
      console.log('💰 Amount in MIST:', amountInMist.toString());

      // Create a new transaction
      const tx = new Transaction();

      // Split coins from gas to create the amount to transfer
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);

      // Transfer the coin to the recipient
      tx.transferObjects([coin], address);

      console.log('📝 Transaction built successfully, requesting wallet approval...');

      // Execute the transaction
      signAndExecuteTransaction(
        {
          transaction: tx as any,
        },
        {
          onSuccess: (result) => {
            toast.dismiss(loadingToast);

            const digest = result.digest;
            const suiscanUrl = `https://suiscan.xyz/testnet/tx/${digest}`;

            console.log('✅ Transfer Transaction Submitted! Digest:', digest);
            console.log(`📊 SuiScan Testnet Explorer: ${suiscanUrl}`);

            // OPTIMISTIC UI UPDATES (IMMEDIATE - Synchronous)
            const activityEntry = {
              id: Date.now().toString(),
              type: 'TRANSFER',
              description: `Sent ${amount} SUI to ${name || formatAddress(address)}`,
              timestamp: new Date(),
              digest: digest,
            };
            setRecentActivity((prev) => [activityEntry, ...prev].slice(0, 10));

            setOptimisticBalanceAdjustment((prev) => prev - parseFloat(amount));
            setTimeout(() => {
              setOptimisticBalanceAdjustment(0);
            }, 5000);

            toast.success(`Transfer Successful! Transaction sent.`);

            if (onClearIntent) {
              onClearIntent();
            }
            setPanelState('IDLE');

            if (onTransactionSuccess) {
              onTransactionSuccess(digest);
            }

            // BACKGROUND FINALITY CHECK (For Logging Only)
            client.waitForTransaction({
              digest: digest,
              options: {
                showEffects: true,
                showEvents: true,
              },
            }).then(() => {
              console.log(`Transaction Confirmed on Chain: https://suiscan.xyz/testnet/tx/${digest}`);
            }).catch((waitError: unknown) => {
              console.error('Background finality check failed (non-critical):', waitError);
            });
          },
          onError: (error) => {
            toast.dismiss(loadingToast);
            console.error('Transfer Transaction Error: Transaction execution failed', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const isUserRejection = errorMessage.toLowerCase().includes('reject') ||
                                   errorMessage.toLowerCase().includes('cancel') ||
                                   errorMessage.toLowerCase().includes('denied') ||
                                   errorMessage.toLowerCase().includes('user');

            if (isUserRejection) {
              toast.error('User rejected the transaction');
            } else {
              toast.error(`Transaction Failed: ${errorMessage}`);
            }
          },
        }
      );
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Transfer Transaction Error: Failed to build transaction', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  // Handle Batch Transfer Transaction
  const handleBatchTransferTransaction = async () => {
    if (!intent || !account) {
      console.error('Batch Transfer Error: Missing intent or account');
      toast.error('Please connect your wallet to execute the batch transfer.');
      return;
    }

    const recipients = intent.data.params.recipients || [];
    const totalAmount = intent.data.params.amount;
    const isMax = intent.data.params.isMax === true;

    // Validate recipients
    if (!recipients || recipients.length === 0) {
      console.error('Batch Transfer Error: Missing recipients');
      toast.error('Missing recipient addresses. Please provide at least one recipient.');
      return;
    }

    // Resolve all recipients
    const resolvedRecipients = recipients.map((recipient: string) => {
      const { name, address } = formatRecipient(recipient);
      return { name, address, original: recipient };
    });

    // Check if all recipients are valid
    const invalidRecipients = resolvedRecipients.filter(r => !r.address);
    if (invalidRecipients.length > 0) {
      const invalidNames = invalidRecipients.map(r => r.original).join(', ');
      toast.error(`Invalid recipients: ${invalidNames}. Please add them to your address book first.`);
      return;
    }

    // Calculate amount per recipient
    let amountPerRecipient: number;
    let totalAmountToSend: number;

    if (isMax) {
      // Get current balance
      const currentBalance = balanceData?.totalBalance 
        ? Number(balanceData.totalBalance) / 1_000_000_000 
        : 0;
      
      // Reserve 0.1 SUI for gas
      const gasReserve = 0.1;
      totalAmountToSend = Math.max(0, currentBalance - gasReserve);
      amountPerRecipient = totalAmountToSend / recipients.length;
    } else {
      if (!totalAmount || parseFloat(totalAmount) <= 0) {
        toast.error('Invalid total amount. Please provide a valid amount.');
        return;
      }
      totalAmountToSend = parseFloat(totalAmount);
      amountPerRecipient = totalAmountToSend / recipients.length;
    }

    if (amountPerRecipient <= 0) {
      toast.error('Amount per recipient must be greater than 0.');
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('Preparing batch transfer...');

    try {
      console.log('🔄 Building batch transfer transaction...', {
        recipients: resolvedRecipients.map(r => r.address),
        amountPerRecipient,
        totalAmountToSend,
        isMax,
      });

      // Convert to MIST
      const amountPerRecipientMist = BigInt(Math.floor(amountPerRecipient * 1_000_000_000));

      // Create transaction
      const tx = new Transaction();

      // Split coins from gas - create one coin per recipient
      // This is the PTB magic: split once, transfer multiple times in the same block!
      // splitCoins returns an array of coin references
      const coinAmounts = new Array(recipients.length).fill(amountPerRecipientMist);
      const coins = tx.splitCoins(
        tx.gas,
        coinAmounts.map(amt => tx.pure.u64(amt))
      );

      // Transfer each coin to its recipient in the same transaction block
      resolvedRecipients.forEach((recipient, index) => {
        tx.transferObjects([coins[index]], recipient.address);
      });

      console.log('📝 Batch transfer transaction built successfully, requesting wallet approval...');

      // Execute the transaction
      signAndExecuteTransaction(
        {
          transaction: tx as any,
        },
        {
          onSuccess: (result) => {
            toast.dismiss(loadingToast);

            const digest = result.digest;
            const suiscanUrl = `https://suiscan.xyz/testnet/tx/${digest}`;

            console.log('✅ Batch Transfer Transaction Submitted! Digest:', digest);
            console.log(`📊 SuiScan Testnet Explorer: ${suiscanUrl}`);

            // OPTIMISTIC UI UPDATES
            const recipientList = resolvedRecipients
              .map(r => r.name || formatAddress(r.address))
              .join(', ');
            
            const activityEntry = {
              id: Date.now().toString(),
              type: 'BATCH_TRANSFER',
              description: `Sent ${amountPerRecipient.toFixed(4)} SUI each to ${recipients.length} recipients (${recipientList})`,
              timestamp: new Date(),
              digest: digest,
            };
            setRecentActivity((prev) => [activityEntry, ...prev].slice(0, 10));

            setOptimisticBalanceAdjustment((prev) => prev - totalAmountToSend);
            setTimeout(() => {
              setOptimisticBalanceAdjustment(0);
            }, 5000);

            toast.success(`Batch Transfer Successful! Sent ${amountPerRecipient.toFixed(4)} SUI to ${recipients.length} recipients.`);

            if (onClearIntent) {
              onClearIntent();
            }
            setPanelState('IDLE');

            if (onTransactionSuccess) {
              onTransactionSuccess(digest);
            }

            // BACKGROUND FINALITY CHECK
            client.waitForTransaction({
              digest: digest,
              options: {
                showEffects: true,
                showEvents: true,
              },
            }).then(() => {
              console.log(`Batch Transfer Confirmed on Chain: https://suiscan.xyz/testnet/tx/${digest}`);
            }).catch((waitError: unknown) => {
              console.error('Background finality check failed (non-critical):', waitError);
            });
          },
          onError: (error) => {
            toast.dismiss(loadingToast);
            console.error('Batch Transfer Error: Transaction execution failed', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const isUserRejection = errorMessage.toLowerCase().includes('reject') ||
                                   errorMessage.toLowerCase().includes('cancel') ||
                                   errorMessage.toLowerCase().includes('denied') ||
                                   errorMessage.toLowerCase().includes('user');

            if (isUserRejection) {
              toast.error('User rejected the transaction');
            } else {
              toast.error(`Batch Transfer Failed: ${errorMessage}`);
            }
          },
        }
      );
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Batch Transfer Error: Failed to build transaction', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  // PREVIEW State - Transfer Transaction Ticket
  if (panelState === 'PREVIEW' && intent) {
    // Get action type
    const actionType = intent.data?.action_type;
    
    // Handle BATCH_TRANSFER
    if (actionType === 'BATCH_TRANSFER') {
      const recipients = intent.data.params.recipients || [];
      const totalAmount = intent.data.params.amount;
      const isMax = intent.data.params.isMax === true;

      // Resolve all recipients for display
      const resolvedRecipients = recipients.map((recipient: string) => {
        const { name, address } = formatRecipient(recipient);
        return { name, address, original: recipient };
      });

      // Calculate amount per recipient
      let amountPerRecipient: number;
      let totalAmountToSend: number;

      if (isMax) {
        const currentBalance = balanceData?.totalBalance 
          ? Number(balanceData.totalBalance) / 1_000_000_000 
          : 0;
        const gasReserve = 0.1;
        totalAmountToSend = Math.max(0, currentBalance - gasReserve);
        amountPerRecipient = recipients.length > 0 ? totalAmountToSend / recipients.length : 0;
      } else {
        totalAmountToSend = totalAmount ? parseFloat(totalAmount) : 0;
        amountPerRecipient = recipients.length > 0 ? totalAmountToSend / recipients.length : 0;
      }

      return (
        <Card className="h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-2 border-purple-200 dark:border-purple-800 shadow-lg">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <CardTitle className="text-xl flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-600" />
              Batch Transfer Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
            {/* Summary */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Summary</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isMax ? (
                  <>Sending all available SUI (reserving 0.1 SUI for gas)</>
                ) : (
                  <>Sending {totalAmountToSend.toFixed(4)} SUI total</>
                )}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {amountPerRecipient.toFixed(4)} SUI per recipient × {recipients.length} recipients
              </p>
            </div>

            {/* Recipients List */}
            <div className="space-y-2 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recipients</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {resolvedRecipients.map((recipient, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {recipient.name ? (
                          <>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{recipient.name}</p>
                            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatAddress(recipient.address)}</p>
                          </>
                        ) : (
                          <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{formatAddress(recipient.address)}</p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                        {amountPerRecipient.toFixed(4)} SUI
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={handleBatchTransferTransaction}
                disabled={isTransactionPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {isTransactionPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Confirm Batch Transfer
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isTransactionPending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Only show preview for TRANSFER actions
    if (actionType !== 'TRANSFER') {
      // For SWAP, STAKE, or other actions, return to IDLE
      return null;
    }

    const recipient = intent.data.params.recipient || (intent.data.params as any).to_address || '';
    const { name, address } = formatRecipient(recipient);
    const amount = intent.data.params.amount || '0';
    const estimatedGas = '0.001'; // Placeholder for estimated gas

    return (
      <Card className="h-full flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardTitle className="text-xl flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Transaction Ticket
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 space-y-4">
          {/* Ticket-like design */}
          <div className="space-y-4 flex-1">
            {/* From */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">From</p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {account ? formatAddress(account.address) : 'Not connected'}
              </p>
            </div>

            {/* To */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">To</p>
              {name ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatAddress(address)}</p>
                </div>
              ) : (
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{formatAddress(address || recipient)}</p>
              )}
            </div>

            {/* Amount */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{amount} SUI</p>
            </div>

            {/* Estimated Gas */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated Gas</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{estimatedGas} SUI</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleTransferTransaction}
              disabled={isTransactionPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isTransactionPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirm Transfer
                </>
              )}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="w-full"
              size="lg"
              disabled={isTransactionPending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // SUCCESS State - Success Card
  if (panelState === 'SUCCESS' && transactionDigest) {
    const suiscanUrl = `https://suiscan.xyz/testnet/tx/${transactionDigest}`;

    return (
      <Card className="h-full flex flex-col bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 shadow-lg">
        <CardHeader className="border-b border-green-200 dark:border-green-800">
          <CardTitle className="text-xl flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5 animate-pulse" />
            Transaction Successful
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          {/* Success Animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-green-500 rounded-full p-6">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
          </div>

          {/* Transaction Digest */}
          <div className="w-full space-y-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">Transaction Digest</p>
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <code className="flex-1 text-xs font-mono text-gray-900 dark:text-gray-100 break-all">
                {transactionDigest}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(suiscanUrl, '_blank')}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Done Button */}
          <Button
            onClick={handleDone}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Fallback to IDLE
  return null;
}

