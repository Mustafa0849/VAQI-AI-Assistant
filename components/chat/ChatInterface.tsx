'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Send, Loader2, BookOpen, X, Trash2, Plus, Globe } from 'lucide-react';
import type { TransactionResponse } from '@/lib/schemas/transaction';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ModelSelector, type ModelType } from '@/components/ModelSelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useWalletMemory } from '@/hooks/useWalletMemory';
import type { ChatMessage, ActivityLogEntry } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Contact {
  name: string;
  address: string;
}

interface ChatInterfaceProps {
  onTransactionGenerated: (response: TransactionResponse | null) => void;
  onRecipientResolved?: (name: string | null, address: string) => void;
  onTransactionSuccess?: (digest: string) => void;
}

export function ChatInterface({ onTransactionGenerated, onRecipientResolved, onTransactionSuccess }: ChatInterfaceProps) {
  const { mutate: signAndExecuteTransaction, isPending: isTransactionPending } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  
  // Walrus Memory Hook
  const { 
    memory, 
    isLoading: isMemoryLoading, 
    isSaving: isMemorySaving,
    addChatMessage: addToWalrusMemory,
    addActivityLog,
    updateAiSummary,
    updateContacts: updateWalrusContacts,
  } = useWalletMemory();
  
  // Address Book State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-1.5-pro'); // Default to Thinking (Düşünen)
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const markdownComponents = useMemo(
    () => ({
      code({
        inline,
        className,
        children,
        ...props
      }: {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match?.[1] || 'typescript';
        if (inline) {
          return (
            <code
              className={`rounded border border-blue-500/40 bg-slate-900/70 px-1.5 py-0.5 text-[13px] font-mono text-blue-100 shadow-sm ${className || ''}`}
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <div className="rounded-2xl border border-blue-500/40 bg-slate-950/90 shadow-2xl overflow-hidden ring-1 ring-blue-500/15">
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200/80 bg-blue-500/10 border-b border-blue-500/20">
              Code
            </div>
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              PreTag="div"
              customStyle={{
                borderRadius: 0,
                padding: 16,
                margin: 0,
                background: 'transparent',
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        );
      },
    }),
    []
  );

  // Get wallet-specific storage key
  const getStorageKey = (): string | null => {
    if (!currentAccount?.address) return null;
    return `sui_address_book_${currentAccount.address}`;
  };

  // Load contacts from Walrus (priority) or localStorage (fallback)
  useEffect(() => {
    if (!currentAccount?.address) {
      setContacts([]);
      return;
    }

    // Priority 1: Load from Walrus memory
    if (memory?.contacts && memory.contacts.length > 0) {
      console.log(`✅ Loaded ${memory.contacts.length} contacts from Walrus`);
      setContacts(memory.contacts);
      // Also sync to localStorage for fast access
      const storageKey = getStorageKey();
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(memory.contacts));
        } catch (e) {
          console.error('Failed to sync contacts to localStorage:', e);
        }
      }
      return;
    }

    // Priority 2: Fallback to localStorage
    const storageKey = getStorageKey();
    if (!storageKey) {
      setContacts([]);
      return;
    }

    const savedContacts = localStorage.getItem(storageKey);
    if (savedContacts) {
      try {
        const parsedContacts = JSON.parse(savedContacts);
        setContacts(parsedContacts);
        console.log(`✅ Loaded ${parsedContacts.length} contacts from localStorage`);
        // Sync to Walrus if memory exists
        if (memory) {
          updateWalrusContacts(parsedContacts);
        }
      } catch (e) {
        console.error('Failed to load contacts from localStorage:', e);
        setContacts([]);
      }
    } else {
      setContacts([]);
    }
  }, [currentAccount?.address, memory?.contacts, memory]); // Reload when wallet or memory changes

  // Save contacts to localStorage whenever they change (only if wallet is connected)
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) {
      // No wallet connected, don't save
      return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(contacts));
      if (currentAccount?.address) {
        console.log(`💾 Saved ${contacts.length} contacts for wallet ${currentAccount.address.slice(0, 6)}...`);
      }
    } catch (e) {
      console.error('Failed to save contacts to localStorage:', e);
    }
  }, [contacts, currentAccount?.address]);

  // Smart Address Resolution
  const resolveRecipient = (recipient: string): { address: string; name: string | null } => {
    // If it starts with 0x, it's already an address
    if (recipient.startsWith('0x')) {
      // Check if this address is in our contacts
      const contact = contacts.find(c => c.address.toLowerCase() === recipient.toLowerCase());
      return { address: recipient, name: contact?.name || null };
    }
    
    // Otherwise, it's a name - look it up in contacts
    const contact = contacts.find(c => c.name.toLowerCase() === recipient.toLowerCase());
    if (contact) {
      return { address: contact.address, name: contact.name };
    }
    
    // Not found
    return { address: '', name: null };
  };

  // Mesaj geldiğinde otomatik aşağı kaydır
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessageToChat = (content: string, role: 'user' | 'assistant') => {
    const timestamp = Date.now();
    const message: Message = {
      id: timestamp.toString(),
      role,
      content,
      timestamp: new Date(timestamp),
    };
    setMessages((prev) => [...prev, message]);
    
    // Also save to Walrus memory
    const walrusMessage: ChatMessage = {
      role,
      content,
      timestamp,
    };
    addToWalrusMemory(walrusMessage);
  };

  const formatAssistantContent = (content: string): string => {
    if (!content || content.includes('```')) {
      return content;
    }

    const trimmed = content.trim();
    const looksLikeMove =
      /(module\s+[A-Za-z0-9_]+::[A-Za-z0-9_]+|public\s+entry\s+fun|struct\s+[A-Za-z0-9_]+\s+has\s+)/i.test(trimmed);
    const looksLikeTs =
      /(import\s+{?\s*Transaction\s*}?\s+from\s+['"]@mysten\/sui\/transactions['"]|new\s+Transaction\s*\(|useSignAndExecuteTransaction\s*\(|@mysten\/dapp-kit)/i.test(
        trimmed
      );

    const lang = looksLikeMove ? 'move' : looksLikeTs ? 'typescript' : null;
    if (!lang) {
      return content;
    }

    return `\`\`\`${lang}\n${trimmed}\n\`\`\``;
  };

  const handleAIResponse = (responseData: TransactionResponse | string) => {
    try {
      // Parse the JSON string coming from the AI (if it's a string)
      // or use directly if it's already an object
      const aiData: TransactionResponse =
        typeof responseData === 'string' ? JSON.parse(responseData) : responseData;

      // 1. Önce yapay zekanın mesajını ekrana bas (Hem chat hem işlem için)
      const formattedSummary = formatAssistantContent(aiData.data.summary);
      addMessageToChat(formattedSummary, 'assistant');

      // 2. Eğer türü TRANSACTION ise cüzdan işlemini tetikle
      if (aiData.type === 'TRANSACTION') {
        const { action_type, params } = aiData.data;

        if (action_type === 'TRANSFER') {
          // Validate required parameters
          const amount = params.amount;
          const recipientInput = params.recipient || (params as any).to_address;

          if (!amount || !recipientInput) {
            addMessageToChat(
              'Error: Missing required parameters. Please provide both amount and recipient address.',
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          // Smart Address Resolution
          const { address, name } = resolveRecipient(recipientInput);

          if (!address) {
            addMessageToChat(
              `❌ Contact '${recipientInput}' not found. Please add them to your address book first.`,
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          // Notify parent component about resolved recipient
          if (onRecipientResolved) {
            onRecipientResolved(name, address);
          }

          try {
            // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
            // Use Math.floor to ensure integer, then convert to BigInt
            const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

            // Create a new transaction
            const tx = new Transaction();

            // Split coins from gas to get the amount to transfer
            // Use tx.pure.u64() to explicitly specify the type as unsigned 64-bit integer
            const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);

            // Transfer the coin to the recipient (use resolved address)
            tx.transferObjects([coin], address);

            // Execute the transaction
            signAndExecuteTransaction(
              {
                transaction: tx as any, // Type assertion to handle version mismatch between @mysten/sui and @mysten/dapp-kit
              },
              {
                onSuccess: (result) => {
                  const digest = result.digest;
                  const recipientDisplay = name ? `${name} (${address.slice(0, 6)}...${address.slice(-4)})` : address;
                  addMessageToChat(
                    `✅ Transaction successful! Sent ${amount} SUI to ${recipientDisplay}\nDigest: ${digest}`,
                    'assistant'
                  );
                  // Log activity to Walrus
                  addActivityLog({
                    type: 'TRANSFER',
                    digest,
                    amount,
                    recipient: address,
                    timestamp: Date.now(),
                    status: 'success',
                  });
                  // Notify parent about successful transaction
                  if (onTransactionSuccess) {
                    onTransactionSuccess(digest);
                  }
                  // Clear the transaction preview after successful execution
                  onTransactionGenerated(null);
                },
                onError: (error) => {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                  addMessageToChat(
                    `❌ Transaction failed: ${errorMessage}`,
                    'assistant'
                  );
                  // Log failed activity
                  addActivityLog({
                    type: 'TRANSFER',
                    digest: '',
                    amount,
                    recipient: address,
                    timestamp: Date.now(),
                    status: 'failed',
                  });
                  onTransactionGenerated(null);
                },
              }
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
            addMessageToChat(
              `❌ Error: ${errorMessage}`,
              'assistant'
            );
            onTransactionGenerated(null);
          }
        } else if (action_type === 'BATCH_TRANSFER') {
          // Batch transfer - show preview in DashboardPanel for confirmation
          const recipients = params.recipients || [];
          const totalAmount = params.amount;
          const isMax = params.isMax === true;

          if (!recipients || recipients.length === 0) {
            addMessageToChat(
              'Error: Missing recipient addresses. Please provide at least one recipient for batch transfer.',
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          // Validate recipients can be resolved (but don't execute yet)
          const unresolvedRecipients: string[] = [];
          recipients.forEach((recipient: string) => {
            const { address } = resolveRecipient(recipient);
            if (!address) {
              unresolvedRecipients.push(recipient);
            }
          });

          if (unresolvedRecipients.length > 0) {
            addMessageToChat(
              `❌ Invalid recipients: ${unresolvedRecipients.join(', ')}. Please add them to your address book first.`,
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          // Show batch transfer preview in DashboardPanel
          onTransactionGenerated(aiData);
        } else if (action_type === 'DEFI_SUPPLY') {
          // Scallop Supply - Simulated via self-transfer
          const amount = params.amount;

          if (!amount || parseFloat(amount) <= 0) {
            addMessageToChat(
              'Error: Missing or invalid amount. Please provide a valid amount to supply.',
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          if (!currentAccount?.address) {
            addMessageToChat(
              'Error: Please connect your wallet to supply to Scallop.',
              'assistant'
            );
            onTransactionGenerated(null);
            return;
          }

          // Set intent so DashboardPanel can track it
          onTransactionGenerated(aiData);

          try {
            // Convert SUI to MIST
            const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

            // Create transaction - Simulate Scallop supply by transferring to own address
            const tx = new Transaction();
            const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
            
            // Transfer to own address (simulating Scallop pool deposit)
            tx.transferObjects([coin], currentAccount.address);

            // Execute the transaction
            signAndExecuteTransaction(
              {
                transaction: tx as any,
              },
              {
                onSuccess: (result) => {
                  const digest = result.digest;
                  addMessageToChat(
                    `✅ Successfully Supplied ${amount} SUI to Scallop Protocol (Simulated)\nDigest: ${digest}`,
                    'assistant'
                  );
                  // Log DeFi activity to Walrus
                  addActivityLog({
                    type: 'DEFI_SUPPLY',
                    digest,
                    amount,
                    timestamp: Date.now(),
                    status: 'success',
                  });
                  
                  // Notify parent about successful transaction
                  if (onTransactionSuccess) {
                    onTransactionSuccess(digest);
                  }
                  
                  // Clear the transaction preview after a delay to allow DashboardPanel to process
                  setTimeout(() => {
                    onTransactionGenerated(null);
                  }, 100);
                },
                onError: (error) => {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                  addMessageToChat(
                    `❌ Scallop supply failed: ${errorMessage}`,
                    'assistant'
                  );
                  onTransactionGenerated(null);
                },
              }
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to build transaction';
            addMessageToChat(
              `❌ Error: ${errorMessage}`,
              'assistant'
            );
            onTransactionGenerated(null);
          }
        } else if (action_type === 'SWAP') {
          // Swap feature is not available - inform user
          addMessageToChat(
            `Swap feature is currently under development. I can help you Send SUI to any address.`,
            'assistant'
          );
          onTransactionGenerated(null);
        } else if (action_type === 'STAKE') {
          // TODO: Implement stake logic
          addMessageToChat(
            'Staking functionality is not yet implemented. Coming soon!',
            'assistant'
          );
          onTransactionGenerated(aiData);
        } else {
          // Show transaction preview for other types
          onTransactionGenerated(aiData);
        }
      }

      // 3. Eğer türü CHAT ise başka bir şey yapmana gerek yok, mesaj zaten basıldı.
      // (No additional action needed for CHAT type)
    } catch (e) {
      // Fallback if AI fails to generate valid JSON (Safety Net)
      console.error('Failed to parse AI response as JSON:', responseData);
      console.error(e);
      addMessageToChat(
        'I encountered an error processing your request. Please try again.',
        'assistant'
      );
      onTransactionGenerated(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    addMessageToChat(userMessage.content, 'user');
    setInput('');
    setIsLoading(true);

    try {
      // Performance timing
      console.time('API_Request_Total');
      
      // Prepare chat history (last 10 messages, excluding the current one we just added)
      const historyMessages = messages.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        content: msg.content,
      }));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage.content,
          history: historyMessages,
          model: selectedModel,
          memoryContext: memory ? {
            aiSummary: memory.aiSummary,
            recentActivities: memory.activityLogs.slice(-5), // Last 5 activities
          } : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze transaction');
      }

      // Get response as JSON (API returns parsed JSON)
      const data: TransactionResponse = await response.json();
      console.timeEnd('API_Request_Total');
      handleAIResponse(data);
    } catch (error) {
      console.timeEnd('API_Request_Total');
      console.error('API request failed:', error);
      addMessageToChat(
        `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'assistant'
      );
      onTransactionGenerated(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Address Book Functions
  const handleAddContact = () => {
    if (!currentAccount?.address) {
      addMessageToChat('Please connect your wallet to use the Address Book.', 'assistant');
      return;
    }

    if (!newContactName.trim() || !newContactAddress.trim()) {
      addMessageToChat('Please enter both name and address.', 'assistant');
      return;
    }

    // Basic address validation
    if (!newContactAddress.startsWith('0x')) {
      addMessageToChat('Invalid Sui address. Address must start with 0x.', 'assistant');
      return;
    }

    // Check if name already exists
    if (contacts.some(c => c.name.toLowerCase() === newContactName.toLowerCase())) {
      addMessageToChat(`Contact with name '${newContactName}' already exists.`, 'assistant');
      return;
    }

    // Check if address already exists
    if (contacts.some(c => c.address.toLowerCase() === newContactAddress.toLowerCase())) {
      addMessageToChat('This address is already in your address book.', 'assistant');
      return;
    }

    const newContact = { name: newContactName.trim(), address: newContactAddress.trim() };
    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    setNewContactName('');
    setNewContactAddress('');
    // Update Walrus memory
    updateWalrusContacts(updatedContacts);
    addMessageToChat(`✅ Contact '${newContactName.trim()}' added to address book!`, 'assistant');
  };

  const handleDeleteContact = (name: string) => {
    const updatedContacts = contacts.filter(c => c.name !== name);
    setContacts(updatedContacts);
    // Update Walrus memory
    updateWalrusContacts(updatedContacts);
    addMessageToChat(`✅ Contact '${name}' removed from address book.`, 'assistant');
  };

  return (
    // ANA KAPLAYICI
    <div className="flex flex-col h-full bg-white/75 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/30 dark:border-white/10 shadow-xl relative transition-colors">
      
      {/* 1. HEADER */}
      <div className="flex-none p-6 border-b border-white/20 bg-white/40 dark:bg-gray-900/40 backdrop-blur-lg z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-lg border-2 border-white/50 ring-2 ring-blue-500/20">
                <Image 
                  src="/vaqi-avatar.png" 
                  alt="VAQI" 
                  fill
                  className="object-cover"
                />
             </div>
             <div>
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">VAQI</h2>
                <p className="text-xs font-medium text-blue-600/80 uppercase tracking-wider">Sui Assistant</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ModelSelector 
              value={selectedModel} 
              onChange={setSelectedModel}
              className="hidden sm:flex"
            />
            <Button
              onClick={() => setIsAddressBookOpen(true)}
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 border-white/40 bg-white/50 hover:bg-white/80 text-blue-600 hover:text-blue-700 shadow-sm"
              title="Address Book"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. MESAJ ALANI */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth chat-scroll">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-1000">
            <div className="relative w-40 h-40 mb-8 animate-float rounded-full overflow-hidden border-2 border-white/30 shadow-xl">
              <Image 
                src="/vaqi-avatar.png" 
                alt="VAQI Logo" 
                fill
                className="object-cover drop-shadow-2xl"
                priority
              />
            </div>
            <h3 className="text-4xl font-bold text-gray-800 dark:text-white mb-3 tracking-tight">VAQI</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md text-lg leading-relaxed">
              Your friendly Sui Blockchain companion. <br/>How can I help you today?
            </p>
            
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 px-5 py-2.5 rounded-full border border-white/50 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 cursor-default">
              <Globe className="w-4 h-4 text-blue-500" />
              <span>Supported Languages:</span>
              <span className="font-bold text-blue-600">TR • EN • ES • FR • DE</span>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mr-3 self-end mb-1">
                  <div className="relative h-8 w-8 rounded-full overflow-hidden shadow-sm border border-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <Image
                      src="/vaqi-avatar.png"
                      alt="VAQI"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col max-w-[85%]">
                <div
                  className={`px-6 py-3.5 shadow-sm text-sm leading-relaxed transition-all duration-200 hover:shadow-md
                    ${msg.role === 'user' 
                      ? 'bubble-user text-white rounded-2xl rounded-tr-sm ml-auto' 
                      : 'bubble-ai text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm mr-auto'
                    }
                  `}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <span className={`text-[10px] text-gray-400 mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
           <div className="flex justify-start w-full">
              <div className="flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-white/20">
                <div className="relative h-6 w-6 animate-pulse">
                  <Image src="/vaqi-thinking.png" alt="Thinking" fill className="object-contain" />
                </div>
                <span className="text-sm font-medium text-gray-500 animate-pulse">VAQI is thinking...</span>
              </div>
           </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 3. INPUT ALANI */}
      <div className="flex-none p-6 pt-2">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 pl-4 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 ring-1 ring-gray-900/5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all duration-300 hover:shadow-xl">
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isLoading ? "VAQI is thinking..." : "Ask VAQI anything..."}
              disabled={isLoading}
              className="flex-1 border-none shadow-none bg-transparent focus-visible:ring-0 px-2 py-3 text-base placeholder:text-gray-400"
            />
            
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className={`rounded-full w-11 h-11 p-0 flex items-center justify-center transition-all duration-300 shrink-0 ${
                input.trim() 
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-105 hover:shadow-blue-500/25 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </div>
          <div className="text-center mt-3 flex items-center justify-center gap-3">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest opacity-60">Powered by Sui Blockchain & Gemini AI</span>
              {currentAccount?.address && (
                <span className={`text-[10px] font-medium uppercase tracking-wider flex items-center gap-1 ${
                  isMemorySaving ? 'text-amber-500' : memory?.blobId ? 'text-emerald-500' : 'text-gray-400'
                }`}>
                  {isMemorySaving ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      Walrus'a Kaydediliyor...
                    </>
                  ) : memory?.blobId ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Walrus Senkron
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      Walrus Bekleniyor
                    </>
                  )}
                </span>
              )}
          </div>
        </form>
      </div>

      {/* Address Book Modal */}
      {isAddressBookOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">Address Book</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAddressBookOpen(false)} className="rounded-full w-8 h-8 p-0 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto">
              {!currentAccount?.address ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <BookOpen className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">Please connect wallet</p>
                  <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                    Contacts are saved locally for your specific wallet address.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500">Add New Contact</h4>
                    <div className="space-y-2">
                      <Input
                        placeholder="Name (e.g., Ali)"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      />
                      <Input
                        placeholder="Sui Address (0x...)"
                        value={newContactAddress}
                        onChange={(e) => setNewContactAddress(e.target.value)}
                        className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-mono text-xs"
                      />
                    </div>
                    <Button onClick={handleAddContact} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Save Contact
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500 flex items-center justify-between">
                      <span>Saved Contacts</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">{contacts.length}</span>
                    </h4>
                    {contacts.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                        <p className="text-sm text-gray-400">No contacts yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div key={contact.name} className="group flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-blue-100 transition-all">
                            <div className="flex-1 min-w-0 mr-3">
                              <p className="font-bold text-sm text-gray-800">{contact.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate bg-gray-50 p-1 rounded mt-1">
                                {contact.address}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteContact(contact.name)}
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
