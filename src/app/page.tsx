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
        addMessage({
          role: 'ai',
          content: `Payment request detected! 📱\n\nRecipient: ${to}${amount ? `\nAmount: ${amount} NIM` : ''}${message ? `\nMessage: ${message}` : ''}\n\nReady to send?`,
          action: {
            type: 'send',
            recipient: to,
            amountLuna: amount ? Math.round(parseFloat(amount) * 100000) : 0,
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

        {/* Fixed Navigation and Ticker */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-background-primary">
          <Navigation />
          <TickerBar />
        </div>

        {/* Main content area with top padding for fixed header */}
        <div className="flex-1 pt-[104px] relative">
          {activeTab === 'home' && (
            <div className="h-full overflow-y-auto pb-28">
              <HomePage />
            </div>
          )}
          {activeTab === 'chat' && <ChatPage />}
          {activeTab === 'stake' && (
            <div className="h-full overflow-y-auto pb-28">
              <StakePage />
            </div>
          )}
          {activeTab === 'history' && (
            <div className="h-full overflow-y-auto pb-36">
              <HistoryPage />
            </div>
          )}
        </div>

        {/* Global Disclaimer Footer - only show on Chat and History pages */}
        {(activeTab === 'chat' || activeTab === 'history') && (
          <div className="fixed bottom-20 left-0 right-0 px-6 pointer-events-none z-20">
            <div className="max-w-md mx-auto pointer-events-auto">
              <div className="backdrop-blur-md bg-white/95 dark:bg-[#08090E]/95 border border-gray-300 dark:border-white/20 rounded-xl px-3 py-2 shadow-xl">
                <p className="text-[10px] text-center text-gray-700 dark:text-white/60 leading-relaxed">
                  <strong className="font-bold">Independent Project:</strong> Not affiliated with Nimiq Foundation
                </p>
              </div>
            </div>
          </div>
        )}

        <BottomNav />
      </main>
    </ThemeProvider>
  );
}