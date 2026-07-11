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
// Stores params in global state so any screen can see it (SignInPage, LoadingSkeleton).
// Fires the appropriate action as soon as wallet.connected becomes true.
// ---------------------------------------------------------------------------
function PaymentLinkHandler() {
  const { setActiveTab, addMessage, wallet, setPendingLinkAction } = useAppStore();
  const searchParams = useSearchParams();
  const pendingRef = useRef<PendingPayment | null>(null);
  const firedRef = useRef(false);
  const wasConnectedRef = useRef(false);

  // Parse params once on mount and store in both ref and global state
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
      const action = { type: 'payment' as const, to, amount, message };
      pendingRef.current = action;
      setPendingLinkAction(action);
    } else if (ref) {
      const action = { type: 'referral' as const, ref };
      pendingRef.current = action;
      setPendingLinkAction(action);
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
  }, [wallet.connected, wallet.address, setPendingLinkAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear pending action only after authentication completes
  // This keeps the contextual copy visible on SignInPage (authCompleted stays 0)
  // and only clears it once sign-in finishes — right as ChatPage appears with the action card
  useEffect(() => {
    const pendingLinkAction = useAppStore.getState().pendingLinkAction;
    if (wallet.authCompleted > 0 && pendingLinkAction) {
      setPendingLinkAction(null);
    }
  }, [wallet.authCompleted, setPendingLinkAction]);

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
  const pendingLinkAction = useAppStore(state => state.pendingLinkAction);
  
  // Contextual copy based on pending action
  let title = 'Connecting to Nimiq Pay...';
  let subtitle = 'Please wait while we detect your environment';
  
  if (pendingLinkAction) {
    if (pendingLinkAction.type === 'payment') {
      const amount = pendingLinkAction.amount;
      const hasAmount = amount && parseFloat(amount) > 0;
      title = hasAmount ? `Preparing your ${amount} NIM payment request...` : 'Preparing your payment request...';
      subtitle = 'Setting up your secure payment connection';
    } else if (pendingLinkAction.type === 'referral') {
      title = 'Activating your referral...';
      subtitle = 'Setting up your account connection';
    }
  }
  
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F1219] px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[2rem] border border-[#1F2348]/10 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-8 shadow-lg">
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner size="lg" type="loading" />
              <p className="mt-4 text-sm font-semibold text-[#1F2348] dark:text-white/75">
                {title}
              </p>
              <p className="mt-1 text-xs text-[#1F2348]/60 dark:text-white/55">
                {subtitle}
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
  
  // Always start with 'checking' - no wallet persistence
  const [miniAppStatus, setMiniAppStatus] = useState<'checking' | 'inside' | 'outside'>('checking');
  
  const [connecting, setConnecting] = useState(false);
  const [consensusEstablished, setConsensusEstablished] = useState(true);
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

  // Prewarm wallet provider as early as possible to speed up first connect
  useEffect(() => {
    import('@/lib/wallet').then(({ prewarmHub }) => {
      prewarmHub();
    });
  }, []);

  // Detect whether we're inside Nimiq Pay
  useEffect(() => {
    let cancelled = false;
    isInsideNimiqPay()
      .then((inside) => { 
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

  // Handle app resume (when returning from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wallet.connected) {
        fetchBalance();
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

  // Show maintenance page — checked AFTER all hooks
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return (
      <ThemeProvider>
        <MaintenancePage />
      </ThemeProvider>
    );
  }

  // Simple gate: wallet.connected means user has connected and signed in
  if (wallet.connected) {
    // Fetch balance once on first render after connection
    if (!hasValidatedAddressRef.current && wallet.address) {
      hasValidatedAddressRef.current = true;
      fetchBalance();
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
