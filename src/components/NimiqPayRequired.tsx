'use client';

import { openExternalUrl } from '@/lib/external-links';

const NIMIQ_PAY_URL = 'https://www.nimiq.com/nimiq-pay/';
const X_URL = 'https://x.com/nimiqagent';

export default function NimiqPayRequired() {
  return (
    <main className="min-h-screen bg-white dark:bg-background-primary px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-[2rem] border border-amber-200/80 dark:border-gold/20 bg-white/90 dark:bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="inline-flex rounded-full border border-amber-300 dark:border-gold/30 bg-amber-100 dark:bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800 dark:text-gold">
            Nimiq Pay Only
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            Open NimAgent inside Nimiq Pay
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-white/65">
            NimAgent now runs as a Nimiq Pay mini app only. Wallet connection, signing, and checkout are enforced through the Nimiq Pay app for a single supported transaction flow.
          </p>

          <div className="mt-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">How To Access</p>
            <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-white/70">
              <li>1. Install or open the Nimiq Pay app.</li>
              <li>2. Launch NimAgent from the mini apps area.</li>
              <li>3. Connect your wallet in-app to view balances and complete transactions.</li>
            </ol>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => openExternalUrl(NIMIQ_PAY_URL)}
              className="btn-gold w-full rounded-2xl py-3 text-sm font-bold"
            >
              Get Nimiq Pay
            </button>
            <button
              type="button"
              onClick={() => openExternalUrl(X_URL)}
              className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] py-3 text-sm font-semibold text-gray-900 dark:text-white"
            >
              Contact Support On X
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-white/45">
            Browser access is disabled intentionally so every wallet action uses the same supported Nimiq Pay mini-app environment.
          </p>
        </div>
      </div>
    </main>
  );
}
