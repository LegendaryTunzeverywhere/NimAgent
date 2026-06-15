'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import ThemeProvider from '@/components/ThemeProvider';
import Navigation from '@/components/Navigation';
import TickerBar from '@/components/TickerBar';
import BottomNav from '@/components/BottomNav';
import HomePage from '@/components/pages/HomePage';
import ChatPage from '@/components/pages/ChatPage';
import HistoryPage from '@/components/pages/HistoryPage';
import StakePage from '@/components/pages/StakePage';

/**
 * Reads payment params from the URL (?to=&amount=&message=) and seeds a chat
 * action. Isolated in its own component so it can sit inside a Suspense
 * boundary — Next.js requires useSearchParams() to be wrapped for static
 * rendering. Renders nothing.
 */
function PaymentLinkHandler() {
  const { setActiveTab, addMessage } = useAppStore();
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
      setActiveTab('chat');
      return;
    }

    if (to) {
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
  }, [searchParams, addMessage, setActiveTab]);

  return null;
}

export default function Home() {
  const { activeTab } = useAppStore();

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
          {activeTab === 'chat' && <ChatPage />}
          {activeTab === 'stake' && (
            <div className="h-full overflow-y-auto pb-28 pt-[104px]">
              <StakePage />
            </div>
          )}
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