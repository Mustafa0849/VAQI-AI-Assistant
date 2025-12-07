'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import toast from 'react-hot-toast';
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

// Debounce time for auto-save (ms) - minimum 2000ms as per requirements
const AUTO_SAVE_DELAY = 2000;

// Toast throttling - minimum time between error toasts (ms)
const TOAST_THROTTLE_MS = 10000; // 10 seconds

// Backoff configuration
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_DURATION_MS = 30000; // 30 seconds

export function useWalletMemory(): UseWalletMemoryReturn {
  const currentAccount = useCurrentAccount();
  const [memory, setMemory] = useState<WalletMemory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track pending changes for auto-save
  const pendingChangesRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Toast throttling and backoff tracking
  const lastErrorToastTimeRef = useRef<number>(0);
  const consecutiveFailuresRef = useRef<number>(0);
  const backoffUntilRef = useRef<number>(0);
  const lastErrorToastIdRef = useRef<string | null>(null);

  // Load memory when wallet connects
  useEffect(() => {
    async function loadMemory() {
      if (!currentAccount?.address) {
        setMemory(null);
        // Reset failure tracking when wallet disconnects
        consecutiveFailuresRef.current = 0;
        backoffUntilRef.current = 0;
        return;
      }

      // Reset failure tracking when wallet changes
      consecutiveFailuresRef.current = 0;
      backoffUntilRef.current = 0;
      lastErrorToastTimeRef.current = 0;
      lastErrorToastIdRef.current = null;

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

  // Helper function to show throttled error toast
  // Only shows toast for manual saves, not background auto-saves
  const showThrottledErrorToast = useCallback((isManualSave: boolean = false) => {
    // Do NOT show toast for background auto-saves - fail silently
    if (!isManualSave) {
      console.log('🔇 [Memory] Background save failed, suppressing toast (silent failure)');
      return;
    }
    
    const now = Date.now();
    const timeSinceLastToast = now - lastErrorToastTimeRef.current;
    
    // If we're in backoff, don't show toast at all
    if (now < backoffUntilRef.current) {
      console.log('🔇 [Memory] In backoff period, suppressing toast');
      return;
    }
    
    // Throttle: only show toast if enough time has passed
    if (timeSinceLastToast < TOAST_THROTTLE_MS) {
      console.log('🔇 [Memory] Toast throttled, last shown', timeSinceLastToast, 'ms ago');
      return;
    }
    
    // Dismiss previous toast if exists
    if (lastErrorToastIdRef.current) {
      toast.dismiss(lastErrorToastIdRef.current);
    }
    
    // Show new toast only for manual saves
    const toastId = toast.error('Could not save to Walrus', {
      duration: 3000,
      icon: '⚠️',
    });
    
    lastErrorToastIdRef.current = toastId;
    lastErrorToastTimeRef.current = now;
  }, []);

  // Internal save function (defined first to be used by scheduleAutoSave)
  const saveToWalrusInternal = useCallback(async (memoryToSave: WalletMemory) => {
    if (!memoryToSave || !currentAccount?.address) {
      setIsSaving(false);
      return;
    }

    // Check if we're in backoff period
    const now = Date.now();
    if (now < backoffUntilRef.current) {
      const remainingMs = backoffUntilRef.current - now;
      console.log('⏸️ [Memory] In backoff period, skipping save attempt. Resumes in', Math.ceil(remainingMs / 1000), 'seconds');
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedMemory = {
        ...memoryToSave,
        lastUpdated: Date.now(),
      };

      console.log('💾 [Memory] Attempting to save to Walrus...');
      const blobId = await uploadToWalrus(updatedMemory);
      
      if (blobId) {
        // Success - reset failure tracking
        consecutiveFailuresRef.current = 0;
        backoffUntilRef.current = 0;
        
        saveBlobIdLocally(currentAccount.address, blobId);
        setMemory(prev => prev ? { ...prev, blobId, lastUpdated: updatedMemory.lastUpdated } : null);
        console.log('✅ [Memory] Saved to Walrus successfully, blobId:', blobId);
        // Don't show success toast for auto-saves, only for manual saves
      } else {
        // Failure - increment counter and check for backoff
        consecutiveFailuresRef.current += 1;
        console.error('❌ [Memory] Failed to get blobId from Walrus. Consecutive failures:', consecutiveFailuresRef.current);
        
        const errorMsg = 'Could not save to Walrus (connection failed or timeout)';
        setError(errorMsg);
        
        // If we've hit the threshold, enter backoff
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          backoffUntilRef.current = now + BACKOFF_DURATION_MS;
          console.warn('⏸️ [Memory] Entering backoff period for', BACKOFF_DURATION_MS / 1000, 'seconds after', consecutiveFailuresRef.current, 'consecutive failures');
        }
        
        // Show throttled error toast (silent for background saves)
        showThrottledErrorToast(false);
      }
    } catch (err: any) {
      // Failure - increment counter and check for backoff
      consecutiveFailuresRef.current += 1;
      console.error('❌ [Memory] Save to Walrus exception:', err, 'Consecutive failures:', consecutiveFailuresRef.current);
      
      const errorMsg = err?.message || 'Failed to save to Walrus';
      setError(errorMsg);
      
      // If we've hit the threshold, enter backoff
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        backoffUntilRef.current = now + BACKOFF_DURATION_MS;
        console.warn('⏸️ [Memory] Entering backoff period for', BACKOFF_DURATION_MS / 1000, 'seconds after', consecutiveFailuresRef.current, 'consecutive failures');
      }
      
      // Show throttled error toast (silent for background saves)
      showThrottledErrorToast(false);
    } finally {
      // Always clear saving state, even on error
      setIsSaving(false);
      console.log('💾 [Memory] Save operation completed, isSaving set to false');
    }
  }, [currentAccount?.address, showThrottledErrorToast]);

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
  }, [memory, currentAccount?.address, saveToWalrusInternal]);

  // Add chat message
  const addChatMessage = useCallback((message: ChatMessage) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        chatHistory: [...prev.chatHistory, message],
        lastUpdated: Date.now(),
      };
      
      // If no blobId yet, save immediately (first message)
      if (!prev.blobId && currentAccount?.address) {
        console.log('🚀 First message detected, saving to Walrus immediately...');
        // Save immediately without debounce
        setTimeout(() => {
          saveToWalrusInternal(updated);
        }, 100);
      } else {
        // Otherwise use debounced save
        scheduleAutoSave();
      }
      
      return updated;
    });
  }, [scheduleAutoSave, currentAccount?.address, saveToWalrusInternal]);

  // Add activity log
  const addActivityLog = useCallback((activity: ActivityLogEntry) => {
    setMemory(prev => {
      if (!prev) return null;
      
      const updated = {
        ...prev,
        activityLogs: [...prev.activityLogs, activity],
        lastUpdated: Date.now(),
      };
      
      // If no blobId yet, save immediately
      if (!prev.blobId && currentAccount?.address) {
        setTimeout(() => {
          saveToWalrusInternal(updated);
        }, 100);
      } else {
        scheduleAutoSave();
      }
      
      return updated;
    });
  }, [scheduleAutoSave, currentAccount?.address, saveToWalrusInternal]);

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
      
      // If no blobId yet, save immediately
      if (!prev.blobId && currentAccount?.address) {
        setTimeout(() => {
          saveToWalrusInternal(updated);
        }, 100);
      } else {
        scheduleAutoSave();
      }
      
      return updated;
    });
  }, [scheduleAutoSave, currentAccount?.address, saveToWalrusInternal]);

  // Manual save to Walrus (shows toast on error)
  const saveToWalrus = useCallback(async () => {
    if (!memory || !currentAccount?.address) {
      toast.error('No data to save');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedMemory = {
        ...memory,
        lastUpdated: Date.now(),
      };

      console.log('💾 [Memory] Manual save to Walrus...');
      const blobId = await uploadToWalrus(updatedMemory);
      
      if (blobId) {
        // Success - reset failure tracking
        consecutiveFailuresRef.current = 0;
        backoffUntilRef.current = 0;
        
        saveBlobIdLocally(currentAccount.address, blobId);
        setMemory(prev => prev ? { ...prev, blobId, lastUpdated: updatedMemory.lastUpdated } : null);
        console.log('✅ [Memory] Manual save successful, blobId:', blobId);
        toast.success('Saved to Walrus successfully');
      } else {
        console.error('❌ [Memory] Manual save failed');
        const errorMsg = 'Could not save to Walrus (connection failed or timeout)';
        setError(errorMsg);
        // Show toast for manual saves
        showThrottledErrorToast(true);
      }
    } catch (err: any) {
      console.error('❌ [Memory] Manual save exception:', err);
      const errorMsg = err?.message || 'Failed to save to Walrus';
      setError(errorMsg);
      // Show toast for manual saves
      showThrottledErrorToast(true);
    } finally {
      setIsSaving(false);
    }
  }, [memory, currentAccount?.address, showThrottledErrorToast]);

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

