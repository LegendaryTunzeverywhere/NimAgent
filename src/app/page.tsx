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
import SignInPage from '@/components/pages/SignInPage';
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
  const wasConnectedRef = useRef(false);

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

  // Track wallet connection state to detect reconnections
  useEffect(() => {
    if (wallet.connected) {
      wasConnectedRef.current = true;
    }
  }, [wallet.connected]);

  // Fire the action card / track referral when:
  // 1. Wallet connects for the first time, OR
  // 2. Wallet reconnects after being disconnected (handles stale session scenario)
  useEffect(() => {
    if (!wallet.connected || !pendingRef.current || firedRef.current) return;
    
    // Only fire if:
    // - Wallet just connected, OR
    // - We detected a reconnection (wasConnected → disconnected → connected again)
    const shouldFire = wallet.connected && (!wasConnectedRef.current || wasConnectedRef.current);
    
    if (!shouldFire) return;
    
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
  }, [wallet.connected, wallet.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset fired flag when wallet disconnects (to allow refiring on reconnect)
  useEffect(() => {
    if (!wallet.connected) {
      firedRef.current = false;
    }
  }, [wallet.connected]);

  return null;
}

// ---------------------------------------------------------------------------
// Loading skeleton shown while detecting Nimiq Pay
// ---------------------------------------------------------------------------
import LoadingSpinner from '@/components/LoadingSpinner';

function LoadingSkeleton() {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F1219] px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[2rem] border border-[#1F2348]/10 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-8 shadow-lg">
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner size="lg" type="loading" />
              <p className="mt-4 text-sm font-semibold text-[#1F2348] dark:text-white/75">
                Connecting to Nimiq Pay...
              </p>
              <p className="mt-1 text-xs text-[#1F2348]/60 dark:text-white/55">
                Please wait while we detect your environment
              </p>
            </div>
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
  
  // OPTIMIZATION: Read persisted wallet.connected synchronously on mount
  // If already connected (returning user), skip detection entirely and go straight to app
  const [miniAppStatus, setMiniAppStatus] = useState<'checking' | 'inside' | 'outside'>(() => {
    if (typeof window === 'undefined') return 'checking';
    // Read from persisted storage synchronously
    const persistedConnected = useAppStore.getState().wallet.connected;
    // If wallet is connected (valid session from before), skip detection
    // A disconnected external browser could never produce connected: true
    return persistedConnected ? 'inside' : 'checking';
  });
  
  const [connecting, setConnecting] = useState(false);
  const [consensusEstablished, setConsensusEstablished] = useState(true);
  const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false);
  const hasValidatedAddressRef = useRef(false);
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
  // SKIP DETECTION for returning users (wallet.connected already true from persisted storage)
  useEffect(() => {
    // If miniAppStatus is already 'inside' (returning user), skip detection
    if (miniAppStatus === 'inside') return;
    
    let cancelled = false;
    isInsideNimiqPay()
      .then((inside) => { 
        // RACE CONDITION FIX: Once wallet.connected is true, ignore detection results
        // Don't let a late/racy 'outside' result override a successful connection
        if (!cancelled && !useAppStore.getState().wallet.connected) {
          setMiniAppStatus(inside ? 'inside' : 'outside');
        }
      })
      .catch(() => { 
        if (!cancelled && !useAppStore.getState().wallet.connected) {
          setMiniAppStatus('outside');
        }
      });
    return () => { cancelled = true; };
  }, [miniAppStatus]);

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

  // Handle app resume (when returning from background)
  // Mobile apps often suspend JavaScript execution when minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wallet.connected) {
        console.log('[App] Resumed from background - refreshing state');
        // Fetch fresh balance
        fetchBalance();
        // Ensure consensus state is current
        import('@/lib/wallet').then(({ getNimiqNetworkState }) => {
          getNimiqNetworkState()
            .then(state => setConsensusEstablished(state.consensusEstablished))
            .catch(() => setConsensusEstablished(true));
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wallet.connected, fetchBalance]);

  // Once confirmed inside Nimiq Pay — ONE place that handles all startup logic.
  useEffect(() => {
    if (miniAppStatus !== 'inside') return;

    const state = useAppStore.getState();

    if (state.wallet.connected) {
      // Returning user with valid session — fetch balance immediately
      // Skip address validation on page refresh/reload to avoid triggering
      // unnecessary wallet connection prompts. The persisted address is already
      // valid from the initial connection. Only validate if we detect the user
      // is actively switching accounts (which would trigger a new connection flow).
      if (hasValidatedAddressRef.current) return;
      hasValidatedAddressRef.current = true;
      
      // Fetch balance immediately for returning users so payment actions can render instantly
      console.log('[App] Returning user detected - fetching balance immediately');
      useAppStore.getState().fetchBalance();
      return;
    }

    // Auto-connect ONLY once per page load, and only if payment params exist.
    // This prevents auto-reconnecting when user manually disconnects.
    // If user disconnects and refreshes, wallet won't auto-connect unless there's a payment link.
    if (hasAttemptedAutoConnect) return;
    
    // Only auto-connect if payment link is present (to=... or ref=... params)
    // For normal app usage, user must connect manually via button
    if (hasPaymentParams) {
      setHasAttemptedAutoConnect(true);
      setConnecting(true);
      connectWallet()
        .finally(() => setConnecting(false));
    } else {
      // Mark as attempted so we don't keep checking
      setHasAttemptedAutoConnect(true);
    }
  }, [miniAppStatus, hasAttemptedAutoConnect, hasPaymentParams, connectWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show maintenance page — checked AFTER all hooks
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return (
      <ThemeProvider>
        <MaintenancePage />
      </ThemeProvider>
    );
  }

  // GATE ORDER: wallet.connected ALWAYS wins over miniAppStatus
  // Trust the persisted session — wallet.connected can only be true if the user
  // was genuinely inside Nimiq Pay before. Never let a later/racy 'outside'
  // detection result override this. Proceed straight into the authenticated app shell.
  if (wallet.connected) {
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
            {/* Show loading state while checking auth for connected wallet */}
            {!wallet.authChecked ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner size="lg" type="loading" />
                  <p className="text-sm font-semibold text-[#1F2348] dark:text-white/75">
                    Checking authentication...
                  </p>
                </div>
              </div>
            ) : wallet.authCompleted === 0 ? (
              /* Show SignInPage if wallet is connected, auth checked, but not authenticated */
              <SignInPage />
            ) : (
              <>
                {activeTab === 'home' && (
                  <div className="h-full overflow-y-auto pb-28 pt-[104px]">
                    <HomePage connecting={connecting} />
                  </div>
                )}
                {activeTab === 'chat' && <ChatPage />}
                {activeTab === 'history' && (
                  <div className="h-full overflow-y-auto pb-36 pt-[104px]">
                    <HistoryPage />
                  </div>
                )}
              </>
            )}
          </div>

          <BottomNav />

          {/* Global syncing toast — sits just above the bottom nav */}
          {!consensusEstablished && (
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

  // Not connected yet — check miniAppStatus for new/disconnected users
  if (miniAppStatus === 'checking') return <LoadingSkeleton />;
  if (miniAppStatus === 'outside') {
    return (
      <ThemeProvider>
        <NimiqPayRequired />
      </ThemeProvider>
    );
  }

  // miniAppStatus === 'inside' but not connected yet — normal new-user flow
  // (auto-connect on payment params, or manual connect button)
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
          {/* New user flow: show home page with connect button or auto-connecting state */}
          {activeTab === 'home' && (
            <div className="h-full overflow-y-auto pb-28 pt-[104px]">
              <HomePage connecting={connecting} />
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
      </main>
    </ThemeProvider>
  );
}
