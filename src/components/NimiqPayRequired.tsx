'use client';

import { useState, useEffect } from 'react';
import { openExternalUrl } from '@/lib/external-links';
import Icon from './Icon';

const NIMIQ_PAY_DOWNLOAD_URL = 'https://www.nimiq.com/nimiq-pay/';
const X_URL = 'https://x.com/nimiqagent';

export default function NimiqPayRequired() {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://nimagent.online');
  const [hasPaymentParams, setHasPaymentParams] = useState(false);
  const [hasReferralParams, setHasReferralParams] = useState(false);

  // Capture the full current URL (including any ?to= or ?ref= params)
  // so users can copy the exact link and open it in Nimiq Pay's browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      setCurrentUrl(url);
      
      const params = new URLSearchParams(window.location.search);
      setHasPaymentParams(params.has('to'));
      setHasReferralParams(params.has('ref'));
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

  const hasParams = hasPaymentParams || hasReferralParams;

  return (
    <main className="min-h-screen bg-white dark:bg-[#0F1219] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-[2rem] border border-[#E9B213]/20 dark:border-gold/20 bg-white/90 dark:bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">

          <div className="inline-flex rounded-full border border-[#E9B213]/30 dark:border-gold/30 bg-[#E9B213]/10 dark:bg-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#E9B213] dark:text-gold">
            Nimiq Pay Required
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#1F2348] dark:text-white">
            {hasParams ? (hasPaymentParams ? 'Complete Payment' : 'Claim Referral') : 'Open NimAgent'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#1F2348]/80 dark:text-white/65">
            {hasParams
              ? hasPaymentParams 
                ? 'You received a payment request. Copy the link below and paste it into Nimiq Pay\'s browser to complete the payment.'
                : 'You received a referral link. Copy the link below and paste it into Nimiq Pay\'s browser to claim your rewards.'
              : 'NimAgent runs inside Nimiq Pay\'s built-in browser. Follow the steps below to get started.'}
          </p>

          {/* Primary CTA for payment/referral links: Copy Link */}
          {hasParams && (
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={copyLink}
                className={`w-full rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  copied
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'btn-gold'
                }`}
              >
                {copied ? (
                  <>
                    <Icon name="check" size={16} strokeWidth={2.5} />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Icon name="copy" size={16} strokeWidth={2.5} />
                    Copy {hasPaymentParams ? 'Payment' : 'Referral'} Link
                  </>
                )}
              </button>
              
              {/* URL display */}
              <div className="rounded-xl border border-[#1F2348]/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5">
                <p className="text-xs font-mono text-[#1F2348] dark:text-white/80 break-all leading-relaxed">{currentUrl}</p>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className={`${hasParams ? 'mt-5' : 'mt-5'} rounded-2xl border border-[#1F2348]/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F2348]/60 dark:text-white/65">
              How To Access
            </p>
            {[
              { 
                n: '1', 
                text: <>Install or open the <strong className="text-[#1F2348] dark:text-white">Nimiq Pay</strong> app.</> 
              },
              { 
                n: '2', 
                text: <>Tap the <strong className="text-[#1F2348] dark:text-white">browser icon</strong> (bottom right corner) inside Nimiq Pay.</> 
              },
              { 
                n: '3', 
                text: hasParams
                  ? <>Paste the link you copied into the address bar and press Enter.</>
                  : <>Navigate to <strong className="text-[#E9B213] dark:text-gold font-mono text-xs">nimagent.online</strong> in the browser.</> 
              },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#E9B213]/10 dark:bg-gold/15 text-[#E9B213] dark:text-gold text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                <p className="text-sm text-[#1F2348] dark:text-white/75 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Secondary actions */}
          <div className={`${hasParams ? 'mt-4' : 'mt-5'} space-y-3`}>
            {!hasParams && (
              <button
                type="button"
                onClick={copyLink}
                className={`w-full rounded-2xl border border-[#1F2348]/10 dark:border-white/10 bg-white dark:bg-white/[0.02] py-3 text-sm font-semibold text-[#1F2348] dark:text-white flex items-center justify-center gap-2 ${
                  copied ? 'opacity-50' : 'hover:bg-white/50 dark:hover:bg-white/[0.05]'
                }`}
              >
                {copied ? (
                  <>
                    <Icon name="check" size={14} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Icon name="copy" size={14} />
                    Copy Link
                  </>
                )}
              </button>
            )}
            
            <button
              type="button"
              onClick={() => openExternalUrl(NIMIQ_PAY_DOWNLOAD_URL)}
              className={`w-full rounded-2xl border border-[#1F2348]/10 dark:border-white/10 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
                hasParams 
                  ? 'bg-white dark:bg-white/[0.02] text-[#1F2348] dark:text-white hover:bg-white/50 dark:hover:bg-white/[0.05]'
                  : 'btn-gold'
              }`}
            >
              <Icon name="download" size={16} strokeWidth={2} />
              {hasParams ? 'Get Nimiq Pay' : 'Download Nimiq Pay'}
            </button>
            
            <button
              type="button"
              onClick={() => openExternalUrl(X_URL)}
              className="w-full rounded-2xl border border-[#1F2348]/10 dark:border-white/10 bg-white dark:bg-white/[0.02] py-3 text-sm font-semibold text-[#1F2348] dark:text-white flex items-center justify-center gap-2 hover:bg-white/50 dark:hover:bg-white/[0.05] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow @nimiqagent
            </button>
          </div>

          {hasParams && (
            <div className="mt-4 rounded-xl border border-amber-300/30 dark:border-gold/20 bg-amber-50/50 dark:bg-gold/5 p-3">
              <div className="flex items-start gap-2">
                <Icon name="info" size={14} className="text-amber-600 dark:text-gold mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[#1F2348]/70 dark:text-white/70 leading-relaxed">
                  <strong className="font-semibold">Why this extra step?</strong> NimAgent only works inside Nimiq Pay's secure browser for your protection. Links from WhatsApp, X, or other apps open in their own browsers, which can't access your wallet.
                </p>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-[#1F2348]/60 dark:text-white/60 text-center">
            NimAgent is a Nimiq Pay mini app — secure, self-custodial payments.
          </p>
        </div>
      </div>
    </main>
  );
}

