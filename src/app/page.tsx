'use client';

import { useEffect, Suspense, useState } from 'react';
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
import { isInsideNimiqPay } from '@/lib/wallet/detect';

/**
 * Reads payment params from the URL (?to=&amount=&message=) and seeds a chat
 * action. Isolated in its own component so it can sit inside a Suspense
 * boundary — Next.js requires useSearchParams() to be wrapped for static
 * rendering. Renders nothing.
 */
function PaymentLinkHandler() {
  const { setActiveTab, addMessage, wallet } = useAppStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle payment URL parameters
    const to = searchParams.get('to');
    const amount = searchParams.get('amount');
    const message = searchParams.get('message');
    const error = searchParams.get('error');

    if (error === 'invalid-address') {
      addMessage({
        role: 'ai',
        content: '❌ Invalid Nimiq address in the payment link. Please check the QR code or link.',
      });
      setActiveTab(wallet.connected ? 'chat' : 'home');
      return;
    }

    if (to) {
      if (!wallet.connected) {
        setActiveTab('home');
        return;
      }

      // Pre-fill payment request from QR code scan
      let paymentMessage = `I want to send NIM to ${to}`;
      if (amount) {
        paymentMessage += ` (Amount: ${amount} NIM)`;
      }
      if (message) {
        paymentMessage += ` (Message: ${message})`;
      }

      // Switch to chat and create payment action
      setActiveTab('chat');

      setTimeout(() => {
        const hasAmount = !!amount && parseFloat(amount) > 0;
        addMessage({
          role: 'ai',
          content: `Payment request detected!\n\nRecipient: ${to}${amount ? `\nAmount: ${amount} NIM` : ''}${message ? `\nFor: ${message}` : ''}\n\n${hasAmount ? '⚠️ The amount is fixed by the requester and cannot be changed.' : 'The sender can choose the amount.'}`,
          action: {
            type: 'send',
            recipient: to,
            amountLuna: hasAmount ? Math.round(parseFloat(amount!) * 100000) : 0,
            message: message || undefined,
            // Lock the amount when a specific value was requested — sender cannot edit it
            locked: hasAmount,
          }
        });
      }, 500);
    }
  }, [searchParams, addMessage, setActiveTab, wallet.connected]);

  return null;
}

export default function Home() {
  const { activeTab, wallet, setActiveTab, fetchBalance } = useAppStore();
  const [miniAppStatus, setMiniAppStatus] = useState<'checking' | 'inside' | 'outside'>('checking');

  useEffect(() => {
    if (activeTab === 'chat' && !wallet.connected) {
      setActiveTab('home');
    }
  }, [activeTab, wallet.connected, setActiveTab]);

  useEffect(() => {
    let cancelled = false;

    const detectMiniApp = async () => {
      const inside = await isInsideNimiqPay();
      if (!cancelled) {
        setMiniAppStatus(inside ? 'inside' : 'outside');
      }
    };

    detectMiniApp().catch(() => {
      if (!cancelled) {
        setMiniAppStatus('outside');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // When the app loads with a persisted connected state, re-verify the address
  // from listAccounts() — this picks the funded account instead of blindly
  // trusting the previously stored address (which may be an empty secondary account).
  useEffect(() => {
    if (miniAppStatus !== 'inside' || !wallet.connected) return;

    let cancelled = false;
    (async () => {
      try {
        const { getUserAddress } = await import('@/lib/wallet');
        const freshAddress = await getUserAddress();
        if (cancelled) return;

        const { useAppStore: store } = await import('@/store/useAppStore');
        const state = store.getState();

        // Only update if the address changed — avoids unnecessary re-renders
        if (freshAddress !== state.wallet.address) {
          console.log('[page] Address updated on startup:', freshAddress);
          store.setState((s) => ({
            wallet: { ...s.wallet, address: freshAddress },
          }));
        }

        // Always re-fetch balance on startup to clear stale null state
        state.fetchBalance();
      } catch {
        // Best-effort — fallback to existing persisted address
        if (!cancelled) fetchBalance();
      }
    })();

    return () => { cancelled = true; };
  }, [miniAppStatus, wallet.connected, fetchBalance]);

  if (miniAppStatus === 'checking') {
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

        {/* Fixed Navigation and Ticker — ticker hidden on chat tab (keyboard-layout sensitive) */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-background-primary">
          <Navigation />
          {activeTab !== 'chat' && <TickerBar />}
        </div>

        {/* Main content area - top padding accounts for fixed nav + ticker (all tabs except chat) */}
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
      </main>
    </ThemeProvider>
  );
}
