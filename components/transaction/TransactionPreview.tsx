'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowRightLeft, Send, Lock, Loader2 } from 'lucide-react';
import type { TransactionResponse } from '@/lib/schemas/transaction';

interface Contact {
  name: string;
  address: string;
}

interface TransactionPreviewProps {
  intent: TransactionResponse | null;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'SWAP':
      return <ArrowRightLeft className="h-5 w-5" />;
    case 'TRANSFER':
      return <Send className="h-5 w-5" />;
    case 'STAKE':
      return <Lock className="h-5 w-5" />;
    default:
      return null;
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case 'SWAP':
      return 'Token Swap';
    case 'TRANSFER':
      return 'Transfer';
    case 'STAKE':
      return 'Staking';
    case 'NONE':
      return 'No Action';
    default:
      return action;
  }
};

export function TransactionPreview({ intent }: TransactionPreviewProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Load contacts from localStorage
  useEffect(() => {
    const savedContacts = localStorage.getItem('sui-address-book');
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error('Failed to load contacts from localStorage:', e);
      }
    }
  }, []);

  // Helper function to resolve address to name and format display
  const formatRecipient = (recipient: string): string => {
    if (!recipient) return '';
    
    // If it's already an address (starts with 0x), look up the name
    if (recipient.startsWith('0x')) {
      const contact = contacts.find(c => c.address.toLowerCase() === recipient.toLowerCase());
      if (contact) {
        // Show: "Name (0x12...Ab)"
        const maskedAddress = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
        return `${contact.name} (${maskedAddress})`;
      }
      // Just show masked address if not in contacts
      return `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
    }
    
    // If it's a name, try to find the address
    const contact = contacts.find(c => c.name.toLowerCase() === recipient.toLowerCase());
    if (contact) {
      const maskedAddress = `${contact.address.slice(0, 6)}...${contact.address.slice(-4)}`;
      return `${contact.name} (${maskedAddress})`;
    }
    
    // Fallback: show as-is
    return recipient;
  };

  if (!intent) {
    return (
      <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Transaction Preview</CardTitle>
        <CardDescription>
          Write a transaction request in the chat to see its preview here
        </CardDescription>
      </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">No transaction created yet</p>
            <p className="text-sm">
              Write a transaction request in natural language in the chat interface
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleExecute = async () => {
    setIsExecuting(true);
    // TODO: Create Sui PTB and send transaction
    setTimeout(() => {
      setIsExecuting(false);
      alert('Transaction execution not yet implemented. Sui PTB structure will be added.');
    }, 1000);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Transaction Preview</CardTitle>
        <CardDescription>
          {getActionLabel(intent.data.action_type)} transaction
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {getActionIcon(intent.data.action_type)}
                  <CardTitle className="text-lg">
                    {getActionLabel(intent.data.action_type)}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {intent.data.params.amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-semibold">{intent.data.params.amount}</span>
                  </div>
                )}
                
                {intent.data.action_type === 'SWAP' && (
                  <>
                    {intent.data.params.token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">From Token:</span>
                        <span className="font-medium">{intent.data.params.token}</span>
                      </div>
                    )}
                    
                    {intent.data.params.target_token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">To Token:</span>
                        <span className="font-medium">{intent.data.params.target_token}</span>
                      </div>
                    )}
                  </>
                )}
                
                {intent.data.action_type === 'TRANSFER' && (
                  <>
                    {intent.data.params.token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Token:</span>
                        <span className="font-medium">{intent.data.params.token}</span>
                      </div>
                    )}
                    
                    {(intent.data.params.recipient || (intent.data.params as any).to_address) && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Recipient:</span>
                        <span className="text-xs font-medium max-w-[200px] text-right">
                          {formatRecipient(intent.data.params.recipient || (intent.data.params as any).to_address || '')}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {intent.data.action_type === 'STAKE' && (
                  <>
                    {intent.data.params.token && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Token:</span>
                        <span className="font-medium">{intent.data.params.token}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <Separator />
        
        <div className="p-4">
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full"
            size="lg"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Transaction...
              </>
            ) : (
              'Confirm and Send Transaction'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

