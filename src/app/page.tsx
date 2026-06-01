'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import Navigation from '@/components/Navigation';
import TickerBar from '@/components/TickerBar';
import BottomNav from '@/components/BottomNav';
import HomePage from '@/components/pages/HomePage';
import ChatPage from '@/components/pages/ChatPage';
import HistoryPage from '@/components/pages/HistoryPage';

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
    <main className="min-h-screen flex flex-col">
      <Suspense fallback={null}>
        <PaymentLinkHandler />
      </Suspense>

      <Navigation />
      <TickerBar />

      <div className="flex-1 overflow-y-auto pb-28">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'chat' && <ChatPage />}
        {activeTab === 'history' && <HistoryPage />}
      </div>

      <BottomNav />
    </main>
  );
}