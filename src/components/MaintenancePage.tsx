'use client';

import Logo from '@/components/Logo';

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-background-primary flex items-center justify-center px-5 py-8">
      <div className="mx-auto max-w-md w-full">
        <div className="rounded-[2rem] border border-amber-200/80 dark:border-gold/20 bg-white/90 dark:bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] text-center">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo size={64} glow />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 dark:border-gold/30 bg-amber-100 dark:bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800 dark:text-gold mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-gold animate-pulse" />
            Under Maintenance
          </div>

          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
            NimAgent is being updated
          </h1>

          <p className="text-sm leading-6 text-gray-600 dark:text-white/65 mb-6">
            We&apos;re making improvements to give you a better experience.
            NimAgent will be back shortly — check back in a few minutes.
          </p>

          {/* Status card */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4 mb-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 mb-3">
              What&apos;s happening
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-white/70">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold flex items-center justify-center text-[10px] flex-shrink-0">🔧</span>
                Scheduled maintenance in progress
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold flex items-center justify-center text-[10px] flex-shrink-0">💎</span>
                Your wallet and funds are safe
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold flex items-center justify-center text-[10px] flex-shrink-0">⚡</span>
                We&apos;ll be back online soon
              </li>
            </ul>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-gold w-full rounded-2xl py-3 text-sm font-bold"
          >
            Check Again
          </button>

          <p className="mt-4 text-xs text-gray-500 dark:text-white/45">
            Follow{' '}
            <a
              href="https://x.com/nimiqagent"
              className="text-amber-600 dark:text-gold underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              @nimiqagent
            </a>{' '}
            for status updates.
          </p>
        </div>
      </div>
    </main>
  );
}
