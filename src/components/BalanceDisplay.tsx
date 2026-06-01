'use client';

import { useEffect, useState } from 'react';
import { getBalances } from '@/lib/api-client';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface BalanceDisplayProps {
  walletAddress: string;
}

interface BalanceData {
  nim: {
    balance: number;
    balanceFormatted: string;
    balanceUSD: string;
    error?: string;
  };
  usdt?: {
    balance: number;
    balanceFormatted: string;
    balanceUSD: string;
    network: string;
    error?: string;
  };
  totalUSD: string;
}

export default function BalanceDisplay({ walletAddress }: BalanceDisplayProps) {
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { sendMessageToAI, addMessage } = useAppStore();

  useEffect(() => {
    if (!walletAddress) {
      setError(true);
      setLoading(false);
      return;
    }

    getBalances(walletAddress)
      .then((data) => {
        setBalances({
          nim: {
            balance: data.nim.balance,
            balanceFormatted: data.nim.balance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            balanceUSD: data.nim.balanceUSD.toFixed(2),
          },
          usdt: data.reloadly ? {
            balance: data.reloadly.balance,
            balanceFormatted: data.reloadly.balance.toFixed(2),
            balanceUSD: data.reloadly.balance.toFixed(2),
            network: 'Polygon',
          } : undefined,
          totalUSD: data.totalUSD.toFixed(2),
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Balance fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, [walletAddress]);

  const handleSend = () => {
    sendMessageToAI('I want to send NIM', walletAddress || undefined);
  };

  const handleSwap = () => {
    addMessage({
      role: 'ai',
      content: 'Here\'s the swap interface — exchange NIM for BTC at live rates.',
      action: { type: 'crypto-swap' },
    });
  };

  const handleShowQR = () => {
    sendMessageToAI('Show my address', walletAddress || undefined);
  };

  if (loading) {
    return (
      <div className="card-premium rounded-2xl p-6 max-w-sm">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Loading balances…</span>
        </div>
      </div>
    );
  }

  if (error || !balances) {
    return (
      <div className="card-premium rounded-2xl p-6 space-y-3 max-w-sm text-center">
        <div className="w-11 h-11 mx-auto rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </div>
        <p className="text-white/70 text-sm">Couldn't load your balance</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm hover:bg-white/[0.08] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card-premium rounded-2xl p-5 space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/25 text-gold flex items-center justify-center">
          <Icon name="wallet" size={15} />
        </span>
        <h3 className="text-white font-semibold text-sm">Wallet Balance</h3>
      </div>

      {/* NIM Balance — gold (NIM-native) */}
      {balances.nim && !balances.nim.error && (
        <div className="bg-gold/[0.06] border border-gold/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center font-bold text-sm">N</span>
              <span className="text-white font-semibold">NIM</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-gold/15 text-gold text-[10px] font-bold uppercase tracking-wide">
              Nimiq
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-white tabular-nums tracking-tight">
              {balances.nim.balanceFormatted}
            </div>
            <div className="text-white/45 text-sm font-mono mt-0.5">
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
            <button
              onClick={handleSwap}
              className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm font-semibold hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="swap" size={14} strokeWidth={2.2} /> Swap
            </button>
          </div>
        </div>
      )}

      {/* USDT Balance — blue (commerce) */}
      {balances.usdt && !balances.usdt.error && (
        <div className="bg-brand-blue/[0.06] border border-brand-blue/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand-blue/15 text-brand-blue-light flex items-center justify-center font-bold text-sm">₮</span>
              <span className="text-white font-semibold">USDT</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-brand-blue/15 text-brand-blue-light text-[10px] font-bold uppercase tracking-wide">
              Polygon
            </span>
          </div>
          <div className="text-2xl font-black text-white tabular-nums">
            {balances.usdt.balanceFormatted}
          </div>
          <div className="text-white/45 text-sm font-mono">
            ${balances.usdt.balanceUSD} USD
          </div>
        </div>
      )}

      {/* Total Portfolio */}
      <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between">
        <span className="text-white/50 text-sm">Total Portfolio</span>
        <span className="text-white font-bold text-xl tabular-nums">${balances.totalUSD}</span>
      </div>

      {/* Show QR */}
      <button
        onClick={handleShowQR}
        className="w-full py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 text-sm font-semibold hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="qr-code" size={15} strokeWidth={2} /> Show QR Code
      </button>
    </div>
  );
}
