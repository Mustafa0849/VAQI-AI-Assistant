'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { useEffect, useState } from 'react';
import type { TransactionResponse } from '@/lib/schemas/transaction';
import { Moon, Sun } from 'lucide-react';

export default function Home() {
  const [transactionIntent, setTransactionIntent] = useState<TransactionResponse | null>(null);
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load theme from localStorage or system preference
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('vaqi-theme') : null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      if (stored === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      if (prefersDark) document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (next === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      if (typeof window !== 'undefined') {
        localStorage.setItem('vaqi-theme', next);
      }
      return next;
    });
  };

  const handleClearIntent = () => {
    setTransactionIntent(null);
    setTransactionDigest(null);
  };

  const handleTransactionSuccess = (digest: string) => {
    setTransactionDigest(digest);
    // Intent'i hemen temizlemiyoruz, success ekranı görünüyor
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 lg:p-12 relative">
      
      {/* Arka Plan Süslemeleri (Blur Efektleri) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-400/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Alanı */}
      <div className="z-10 w-full max-w-7xl flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3">
            {/* Buraya küçük bir logo ikonu eklenebilir */}
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
                VAQI Interface
            </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg backdrop-blur-md text-slate-700 dark:text-slate-100 hover:shadow-xl transition"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <div className="backdrop-blur-md bg-white/30 dark:bg-black/30 p-1 rounded-full border border-white/20 shadow-lg transition-transform hover:scale-105">
              <ConnectButton />
          </div>
        </div>
      </div>

      {/* Ana Grid Yapısı */}
      <div className="z-10 w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[75vh]">
        
        {/* Sol Panel: Chat (Daha Geniş - 8 birim) */}
        <div className="lg:col-span-8 h-full shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden border border-white/40 dark:border-white/10 backdrop-blur-2xl bg-white/35 dark:bg-slate-900/55 transition-all duration-300 hover:shadow-blue-500/10">
          <ChatInterface 
             onTransactionGenerated={setTransactionIntent}
             onTransactionSuccess={handleTransactionSuccess}
          />
        </div>

        {/* Sağ Panel: Dashboard (4 birim) */}
        <div className="lg:col-span-4 h-full">
           <DashboardPanel 
              intent={transactionIntent}
              transactionDigest={transactionDigest}
              onClearIntent={handleClearIntent}
              onTransactionSuccess={handleTransactionSuccess}
           />
        </div>
      </div>
    </main>
  );
}
