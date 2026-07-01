'use client';

import { useAppStore } from '@/store/useAppStore';
import Icon from '@/components/Icon';

export default function WalletSessionBanner() {
  const {
    wallet,
    walletSessionExpired,
    walletSessionError,
  } = useAppStore();

  if (!wallet.connected || !wallet.address || !walletSessionExpired) {
    return null;
  }

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
          <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-gold/80">
            Open Settings to reconnect and refresh protected data.
          </p>
        </div>
      </div>
    </div>
  );
}
