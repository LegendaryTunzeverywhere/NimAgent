'use client';

import { useEffect, useRef, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import ThemeProvider from '@/components/ThemeProvider';
import Navigation from '@/components/Navigation';
import TickerBar from '@/components/TickerBar';
import BottomNav from '@/components/BottomNav';
import HomePage from '@/components/pages/HomePage';
import ChatPage from '@/components/pages/ChatPage';
import HistoryPage from '@/components/pages/HistoryPage';
import NimiqPayRequired from '@/components/NimiqPayRequired';
import MaintenancePage from '@/components/MaintenancePage';
import { isInsideNimiqPay } from '@/lib/wallet/detect';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PendingPayment {
  type: 'payment' | 'referral';
  // payment fields
  to?: string;
  amount?: string | null;
  message?: string | null;
  // referral fields
  ref?: string;
}

// ---------------------------------------------------------------------------
// PaymentLinkHandler
// Parses ?to=&amount=&message= and ?ref= from the URL.
// Stores params in a ref on mount, fires the appropriate action as soon as
// wallet.connected becomes true — regardless of connect timing.
// ---------------------------------------------------------------------------
function PaymentLinkHandler() {
  const { setActiveTab, addMessage, wallet } = useAppStore();
  const searchParams = useSearchParams();
  const pendingRef = useRef<PendingPayment | null>(null);
  const firedRef = useRef(false);

  // Parse params once on mount and store in ref
  useEffect(() => {
    const to      = searchParams.get('to');
    const amount  = searchParams.get('amount');
    const message = searchParams.get('message');
    const ref     = searchParams.get('ref');
    const error   = searchParams.get('error');

    if (error === 'invalid-address') {
      addMessage({
        role: 'ai',
        content: '❌ Invalid Nimiq address in the payment link. Please check the QR code or link.',
      });
      return;
    }

    if (to) {
      pendingRef.current = { type: 'payment', to, amount, message };
    } else if (ref) {
      pendingRef.current = { type: 'referral', ref };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire the action card / track referral as soon as wallet connects
  useEffect(() => {
    if (!wallet.connected || !pendingRef.current || firedRef.current) return;
    firedRef.current = true;

    const pending = pendingRef.current;

    if (pending.type === 'payment' && pending.to) {
      const { to, amount, message } = pending;
      const hasAmount = !!amount && parseFloat(amount) > 0;
      const amountLuna = hasAmount ? Math.round(parseFloat(amount!) * 100_000) : 0;

      setActiveTab('chat');
      setTimeout(() => {
        addMessage({
          role: 'ai',
          content: [
            'Payment request detected!',
            '',
            `Recipient: ${to}`,
            amount  ? `Amount: ${amount} NIM` : '',
            message ? `For: ${message}`       : '',
            '',
            hasAmount
              ? '⚠️ The amount is fixed by the requester and cannot be changed.'
              : 'The sender can choose the amount.',
          ].filter(Boolean).join('\n'),
          action: {
            type: 'send',
            recipient: to,
            amountLuna,
            message: message || undefined,
            locked: hasAmount,
          },
        });
      }, 300);
    }

    if (pending.type === 'referral' && pending.ref && wallet.address) {
      // Track the referral silently, then let the normal home page load
      import('@/lib/api-client').then(({ trackReferral }) => {
        trackReferral(wallet.address!, pending.ref!).catch(() => {});
      });
    }
  }, [wallet.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ---------------------------------------------------------------------------
// Loading skeleton shown while detecting Nimiq Pay
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-white dark:bg-background-primary px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6">
            <div className="h-3 w-24 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse" />
            <div className="mt-4 h-8 w-56 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse" />
            <div className="mt-3 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.05] animate-pulse" />
            <div className="mt-5 h-12 rounded-2xl bg-amber-100 dark:bg-gold/10 animate-pulse" />
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Home — main entry point
// ---------------------------------------------------------------------------
export default function Home() {
  const { activeTab, wallet, setActiveTab, fetchBalance, connectWallet } = useAppStore();
  const [miniAppStatus, setMiniAppStatus] = useState<'checking' | 'inside' | 'outside'>('checking');
  const [consensusEstablished, setConsensusEstablished] = useState(true);
  // Compute once — safe on SSR (window may not exist), stable across renders
  const [hasPaymentParams] = useState(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.has('to') || p.has('ref');
  });

  // Redirect chat → home if wallet disconnects
  useEffect(() => {
    if (activeTab === 'chat' && !wallet.connected) {
      setActiveTab('home');
    }
  }, [activeTab, wallet.connected, setActiveTab]);

  // Detect whether we're inside Nimiq Pay
  useEffect(() => {
    let cancelled = false;
    isInsideNimiqPay()
      .then((inside) => { if (!cancelled) setMiniAppStatus(inside ? 'inside' : 'outside'); })
      .catch(() => { if (!cancelled) setMiniAppStatus('outside'); });
    return () => { cancelled = true; };
  }, []);

  // Poll Nimiq Pay consensus — used to show syncing toast on all tabs
  useEffect(() => {
    if (!wallet.connected) return;
    const check = async () => {
      try {
        const { getNimiqNetworkState } = await import('@/lib/wallet');
        const state = await getNimiqNetworkState();
        setConsensusEstablished(state.consensusEstablished);
      } catch { setConsensusEstablished(true); }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, [wallet.connected]);

  // Once confirmed inside Nimiq Pay — ONE place that handles all startup logic.
  useEffect(() => {
    if (miniAppStatus !== 'inside') return;

    const state = useAppStore.getState();

    if (state.wallet.connected) {
      // Re-validate the persisted address against the live provider.
      // The user may have switched their active account in Nimiq Pay between
      // sessions, which would cause a stale address to be shown here.
      import('@/lib/wallet').then(({ getUserAddress }) => {
        getUserAddress()
          .then((liveAddress) => {
            const stored = useAppStore.getState().wallet.address;
            if (stored !== liveAddress) {
              // Active account changed — update the address and reload the session.
              useAppStore.setState((s) => ({
                wallet: { ...s.wallet, address: liveAddress },
              }));
              useAppStore.getState().loadOrCreateSession();
            }
            useAppStore.getState().fetchBalance();
          })
          .catch(() => {
            // Provider unavailable — fall back to fetching balance with stored address.
            useAppStore.getState().fetchBalance();
          });
      });
      return;
    }

    // Auto-connect whenever we're inside Nimiq Pay and not yet connected.
    // This covers: payment link opens, fresh installs, and post-clear-cache
    // reloads (where localStorage was wiped and connected is false).
    // Without this, after "Clear cache & reload" the user had to press the
    // connect button manually, and the provider sometimes returned accounts in
    // a different order on that first cold call — showing the wrong wallet.
    connectWallet();
  }, [miniAppStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show maintenance page — checked AFTER all hooks
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return (
      <ThemeProvider>
        <MaintenancePage />
      </ThemeProvider>
    );
  }

  if (miniAppStatus === 'checking') return <LoadingSkeleton />;
  if (miniAppStatus === 'outside') {
    return (
      <ThemeProvider>
        <NimiqPayRequired />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <main className="min-h-screen flex flex-col overflow-hidden">
        <Suspense fallback={null}>
          <PaymentLinkHandler />
        </Suspense>

        <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-background-primary">
          <Navigation />
          {activeTab !== 'chat' && <TickerBar />}
        </div>

        <div className="flex-1 relative">
          {activeTab === 'home' && (
            <div className="h-full overflow-y-auto pb-28 pt-[104px]">
              <HomePage />
            </div>
          )}
          {activeTab === 'chat' && wallet.connected && <ChatPage />}
          {activeTab === 'history' && (
            <div className="h-full overflow-y-auto pb-36 pt-[104px]">
              <HistoryPage />
            </div>
          )}
        </div>

        <BottomNav />

        {/* Global syncing toast — sits just above the bottom nav */}
        {wallet.connected && !consensusEstablished && (
          <div className="fixed bottom-[5.5rem] left-4 right-4 z-40 pointer-events-none animate-fade-up">
            <div className="rounded-xl border border-amber-300/80 dark:border-gold/25 bg-amber-50 dark:bg-[#1c1200] shadow-lg px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 border-2 border-amber-500 dark:border-gold/70 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
                Nimiq Pay syncing — payments paused
              </p>
            </div>
          </div>
        )}
      </main>
    </ThemeProvider>
  );
}
