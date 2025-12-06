'use client';

import { useEffect, useRef, useState } from 'react';

export type ModelType = 'gemini-2.5-flash' | 'gemini-1.5-pro';

interface ModelSelectorProps {
  value: ModelType;
  onChange: (model: ModelType) => void;
  className?: string;
}

export function ModelSelector({ value, onChange, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options: Array<{ value: ModelType; label: string; icon: string }> = [
    { value: 'gemini-2.5-flash', label: 'Hızlı VAQI', icon: '⚡' },
    { value: 'gemini-1.5-pro', label: 'Düşünen VAQI', icon: '🧠' },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={containerRef} className={`relative flex items-center gap-3 ${className || ''}`}>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
        Model:
      </span>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="min-w-[220px] h-11 rounded-full bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-lg backdrop-blur-md px-4 pr-10 ring-1 ring-slate-900/5 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-0 transition-all flex items-center gap-2 justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{current.icon}</span>
          {current.label}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 min-w-[220px] rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-white/50 dark:border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden z-50">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition hover:bg-blue-50/80 dark:hover:bg-slate-800/80 ${
                opt.value === value ? 'bg-blue-500/10 text-blue-700 dark:text-blue-200 font-semibold' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              <span className="text-base">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

