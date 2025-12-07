'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import type { WalletMemory, ChatMessage, ActivityLogEntry, Contact } from '@/types';
import {
  uploadToWalrus,
  downloadFromWalrus,
  createEmptyMemory,
  saveBlobIdLocally,
  loadBlobIdLocally,
} from '@/lib/walrus/service';

interface UseWalletMemoryReturn {
  memory: WalletMemory | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  addChatMessage: (message: ChatMessage) => void;
  addActivityLog: (activity: ActivityLogEntry) => void;
  updateAiSummary: (summary: string) => void;
  updateContacts: (contacts: Contact[]) => void;
  saveToWalrus: () => Promise<void>;
  clearMemory: () => void;
}

// Debounce time for auto-save (ms)
const AUTO_SAVE_DELAY = 3000;

export function useWalletMemory(): UseWalletMemoryReturn {
  const currentAccount = useCurrentAccount();
  const [memory, setMemory] = useState<WalletMemory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track pending changes for auto-save
  const pendingChangesRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load memory when wallet connects
  useEffect(() => {
    async function loadMemory() {
      if (!currentAccount?.address) {
        setMemory(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // First, check localStorage for existing blobId
        const savedBlobId = loadBlobIdLocally(currentAccount.address);
        
        if (savedBlobId) {
          // Try to download from Walrus
          const walrusMemory = await downloadFromWalrus(savedBlobId);
          
          if (walrusMemory && walrusMemory.walletAddress === currentAccount.address) {
            console.log('✅ Loaded memory from Walrus');
            setMemory({ ...walrusMemory, blobId: savedBlobId });
            setIsLoading(false);
            return;
          }
        }

        // No existing memory found, create new
        console.log('📝 Creating new memory for wallet:', currentAccount.address);
        const newMemory = createEmptyMemory(currentAccount.address);
        setMemory(newMemory);
      } catch (err) {
        console.error('❌ Failed to load memory:', err);
        setError('Failed to load memory from Walrus');
        // Create empty memory as fallback
        setMemory(createEmptyMemory(currentAccount.address));
      } finally {
        setIsLoading(false);
      }
    }

    loadMemory();
  }, [currentAccount?.address]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save with debounce
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    pendingChangesRef.current = true;

    saveTimeoutRef.current = setTimeout(async () => {
      if (pendingChangesRef.current && memory && currentAccount?.address) {
        await saveToWalrusInternal(memory);
        pendingChangesRef.current = false;
      }
    }, AUTO_SAVE_DELAY);
  }, [memory, currentAccount?.address]);

  // Internal save function
  const saveToWalrusInternal = async (memoryToSave: WalletMemory) => {
    if (!memoryToSave || !currentAccount?.address) return;

    setIsSaving(true);
    setError(null);

    try {
      const updatedMemory = {
        ...memoryToSave,
        lastUpdated: Date.now(),
      };

      const blobId = await uploadToWalrus(updatedMemory);
      
      if (blobId) {
        saveBlobIdLocally(currentAccount.address, blobId);
        setMemory(prev => prev ? { ...prev, blobId, lastUpdated: updatedMemory.lastUpdated } : null);
        console.log('✅ Memory saved to Walrus');
      } else {
        setError('Failed to save to Walrus');
      }
    } catch (err) {
      console.error('❌ Save to Walrus failed:', err);
      setError('Failed to save to Walrus');
    } finally {
      setIsSaving(false);
    }
  };

  // Add chat message
  const addChatMessage = useCallback((message: ChatMessage) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        chatHistory: [...prev.chatHistory, message],
        lastUpdated: Date.now(),
      };
      
      return updated;
    });
    
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Add activity log
  const addActivityLog = useCallback((activity: ActivityLogEntry) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        activityLogs: [...prev.activityLogs, activity],
        lastUpdated: Date.now(),
      };
      
      return updated;
    });
    
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update AI summary
  const updateAiSummary = useCallback((summary: string) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        aiSummary: summary,
        lastUpdated: Date.now(),
      };
      
      return updated;
    });
    
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update contacts
  const updateContacts = useCallback((contacts: Contact[]) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        contacts,
        lastUpdated: Date.now(),
      };
      
      return updated;
    });
    
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Manual save to Walrus
  const saveToWalrus = useCallback(async () => {
    if (memory) {
      await saveToWalrusInternal(memory);
    }
  }, [memory, currentAccount?.address]);

  // Clear memory
  const clearMemory = useCallback(() => {
    if (!currentAccount?.address) return;
    
    const emptyMemory = createEmptyMemory(currentAccount.address);
    setMemory(emptyMemory);
    scheduleAutoSave();
  }, [currentAccount?.address, scheduleAutoSave]);

  return {
    memory,
    isLoading,
    isSaving,
    error,
    addChatMessage,
    addActivityLog,
    updateAiSummary,
    updateContacts,
    saveToWalrus,
    clearMemory,
  };
}

