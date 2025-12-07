'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import Image from 'next/image';

interface WalletRequiredModalProps {
  isOpen: boolean;
}

export function WalletRequiredModal({ isOpen }: WalletRequiredModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 p-8 md:p-12 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* VAQI Image */}
          <div className="flex-shrink-0">
            <div className="relative w-48 h-48 md:w-64 md:h-64 animate-float">
              <div className="absolute inset-0 rounded-full overflow-hidden ring-4 ring-blue-500/20 dark:ring-blue-400/30 shadow-2xl">
                <Image
                  src="/Gemini_Generated_Image_5zflw15zflw15zfl.png"
                  alt="VAQI"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 via-cyan-400/10 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Message Content */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 mb-4">
              Merhaba! Ben VAQI 👋
            </h2>
            
            <div className="space-y-4 text-slate-700 dark:text-slate-300">
              <p className="text-lg leading-relaxed">
                Ben senin kişiselleştirilmiş Sui blockchain yardımcınım! Seninle önceki sohbetlerini hatırlayabilmem, 
                aktivitelerini takip edebilmem ve sana özel tavsiyeler verebilmem için cüzdan bağlantısına ihtiyacım var.
              </p>
              
              <p className="text-base leading-relaxed">
                Cüzdanını bağladığında, geçmiş konuşmalarını, işlem geçmişini ve tercihlerini hatırlayarak 
                sana daha iyi yardımcı olabilirim. 🚀
              </p>
            </div>

            {/* Connect Button */}
            <div className="mt-8 flex justify-center md:justify-start">
              <div className="backdrop-blur-md bg-blue-500/10 dark:bg-blue-500/20 p-2 rounded-full border border-blue-500/30 shadow-lg transition-transform hover:scale-105">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

