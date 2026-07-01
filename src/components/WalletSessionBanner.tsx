'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from '@/components/Icon';

interface WalletSessionBannerProps {
  onReconnect?: () => Promise<void> | void;
}

export default function WalletSessionBanner({ onReconnect }: WalletSessionBannerProps) {
  const {
    wallet,
    walletSessionExpired,
    walletSessionError,
    refreshWalletSession,
  } = useAppStore();
  const [reconnecting, setReconnecting] = useState(false);

  if (!wallet.connected || !wallet.address || !walletSessionExpired) {
    return null;
  }

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const refreshed = await refreshWalletSession();
      if (refreshed) {
        await onReconnect?.();
      }
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 dark:border-gold/25 bg-amber-50 dark:bg-gold/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold">
          <Icon name="wallet" size={16} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-gold">Reconnect required</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-gold/85">
            {walletSessionError || 'Reconnect your wallet to refresh protected data.'}
          </p>
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400 dark:border-gold/35 px-4 py-2 text-xs font-semibold text-amber-800 dark:text-gold hover:bg-amber-100 dark:hover:bg-gold/12 transition-colors disabled:opacity-60"
          >
            {reconnecting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-700/30 dark:border-gold/30 border-t-amber-700 dark:border-t-gold animate-spin" />
                Reconnecting
              </>
            ) : (
              <>
                <Icon name="refresh" size={14} strokeWidth={2.2} />
                Reconnect to Refresh
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
