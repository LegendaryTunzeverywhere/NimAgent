'use client';

import { useState, useEffect } from 'react';
import { openExternalUrl } from '@/lib/external-links';

const NIMIQ_PAY_DOWNLOAD_URL = 'https://www.nimiq.com/nimiq-pay/';
const X_URL = 'https://x.com/nimiqagent';

export default function NimiqPayRequired() {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://nimagent.online');

  // Capture the full current URL (including any ?to= or ?ref= params)
  // so users can copy the exact link and open it in Nimiq Pay's browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = currentUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasParams = currentUrl.includes('?');

  return (
    <main className="min-h-screen bg-white dark:bg-background-primary px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-[2rem] border border-amber-200/80 dark:border-gold/20 bg-white/90 dark:bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">

          <div className="inline-flex rounded-full border border-amber-300 dark:border-gold/30 bg-amber-100 dark:bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800 dark:text-gold">
            Nimiq Pay Required
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            Open NimAgent in Nimiq Pay
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-white/65">
            {hasParams
              ? 'You have a payment or referral link. Open it inside Nimiq Pay\'s browser to continue.'
              : 'NimAgent runs inside Nimiq Pay\'s built-in browser. Follow the steps below to get started.'}
          </p>

          {/* Steps */}
          <div className="mt-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">
              How To Access
            </p>
            {[
              { n: '1', text: <>Install or open the <strong className="text-gray-900 dark:text-white">Nimiq Pay</strong> app.</> },
              { n: '2', text: <>Tap the <strong className="text-gray-900 dark:text-white">buttom right corner</strong> inside Nimiq Pay.</> },
              { n: '3', text: hasParams
                ? <>Paste the link you just copied into the address bar.</>
                : <>Navigate to <strong className="text-amber-700 dark:text-gold font-mono text-xs">nimagent.online</strong> — or copy the link below.</> },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* URL display */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-3 py-2.5">
            <p className="flex-1 text-xs font-mono text-gray-700 dark:text-white/70 truncate">{currentUrl}</p>
            <button
              type="button"
              onClick={copyLink}
              className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                copied
                  ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                  : 'bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold hover:bg-amber-200 dark:hover:bg-gold/25'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => openExternalUrl(NIMIQ_PAY_DOWNLOAD_URL)}
              className="btn-gold w-full rounded-2xl py-3 text-sm font-bold"
            >
              Get Nimiq Pay
            </button>
            <button
              type="button"
              onClick={() => openExternalUrl(X_URL)}
              className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] py-3 text-sm font-semibold text-gray-900 dark:text-white"
            >
              Follow @nimiqagent on X
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-white/40 text-center">
            NimAgent will be available as a registered Nimiq Pay mini app soon.
          </p>
        </div>
      </div>
    </main>
  );
}
