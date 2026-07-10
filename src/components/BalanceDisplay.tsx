'use client';

import { useEffect, useState } from 'react';
import { formatBalanceForUi, getBalancesWithFallback } from '@/lib/balance';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface BalanceDisplayProps {
  walletAddress: string;
}

interface BalanceData {
  nim: {
    balanceFormatted: string;
    balanceUSD: string;
    error?: string;
  };
  totalUSD: string;
}

export default function BalanceDisplay({ walletAddress }: BalanceDisplayProps) {
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sendMessageToAI } = useAppStore();

  useEffect(() => {
    if (!walletAddress) { setError('Wallet address missing'); setLoading(false); return; }

    getBalancesWithFallback(walletAddress)
      .then((data) => {
        const formatted = formatBalanceForUi(data);
        setBalances({
          nim: {
            balanceFormatted: formatted.nim.balanceFormatted,
            balanceUSD: formatted.nim.balanceUSD,
          },
          totalUSD: formatted.totalUSD,
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = (err instanceof Error && err.name === 'NimiqSyncingError')
          ? 'Nimiq Pay is syncing with the Nimiq network.'
          : "Couldn't load your balance";
        setError(message);
        setLoading(false);
      });
  }, [walletAddress]);

  const handleSend = () => sendMessageToAI('I want to send NIM', walletAddress || undefined);
  const handleShowQR = () => sendMessageToAI('Show my address', walletAddress || undefined);

  if (loading) {
    return (
      <div className="card-premium rounded-2xl p-6 max-w-sm">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-5 h-5 border-2 border-amber-600 dark:border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-[#1F2348]/60 dark:text-white/50 text-sm">Loading balance…</span>
        </div>
      </div>
    );
  }

  if (error || !balances) {
    return (
      <div className="card-premium rounded-2xl p-6 space-y-3 max-w-sm text-center">
        <div className="w-11 h-11 mx-auto rounded-xl bg-red-50 dark:bg-error/10 border border-red-200 dark:border-error/20 text-red-600 dark:text-error flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </div>
        <p className="text-[#1F2348]/60 dark:text-white/70 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-[#1F2348] dark:text-white text-sm hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card-premium rounded-2xl p-5 space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-[#E9B213]/20 dark:bg-gold/15 border border-amber-200 dark:border-gold/25 text-[#E9B213] dark:text-gold flex items-center justify-center">
          <Icon name="wallet" size={15} />
        </span>
        <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Wallet Balance</h3>
      </div>

      {/* NIM Balance */}
      {balances.nim && !balances.nim.error && (
        <div className="bg-[#E9B213]/10 dark:bg-gold/[0.06] border border-amber-200 dark:border-gold/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#E9B213]/20 dark:bg-gold/15 text-[#E9B213] dark:text-gold flex items-center justify-center font-bold text-sm">N</span>
              <span className="text-gray-900 dark:text-white font-semibold">NIM</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#E9B213]/20 dark:bg-gold/15 text-[#E9B213] dark:text-gold text-[10px] font-bold uppercase tracking-wide">
              Nimiq
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
              {balances.nim.balanceFormatted}
            </div>
            <div className="text-[#1F2348]/60 dark:text-white/45 text-sm font-mono mt-0.5">
              ≈ ${balances.nim.balanceUSD} USD
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              className="btn-gold flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5"
            >
              <Icon name="send" size={14} strokeWidth={2.2} /> Send
            </button>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="pt-3 border-t border-gray-100 dark:border-white/[0.07] flex items-center justify-between">
        <span className="text-[#1F2348]/60 dark:text-white/50 text-sm">Total Balance</span>
        <span className="text-gray-900 dark:text-white font-bold text-xl tabular-nums">${balances.totalUSD}</span>
      </div>

      <button
        onClick={handleShowQR}
        className="w-full py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-[#1F2348] dark:text-white/80 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="qr-code" size={15} strokeWidth={2} /> Show QR Code
      </button>
    </div>
  );
}
