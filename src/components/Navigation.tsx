'use client';

import { useAppStore } from '@/store/useAppStore';
import Logo from './Logo';

export default function Navigation() {
  const { wallet } = useAppStore();

  return (
    <nav className="glass-strong sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-white/[0.07]">
      <div className="flex items-center gap-2.5">
        <Logo size={34} glow />
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-white text-[17px] tracking-tight">
            Nim<span className="text-gradient-gold">Hub</span>
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 mt-0.5">
            AI Payments
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {wallet.connected && wallet.address && (
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-success/10 text-success border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-live" />
            <span className="font-mono">{wallet.address.slice(0, 4)}…{wallet.address.slice(-4)}</span>
          </div>
        )}

        <button
          className="glass rounded-full p-2 text-white/50 hover:text-gold hover:border-gold/30 transition-colors"
          aria-label="Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
