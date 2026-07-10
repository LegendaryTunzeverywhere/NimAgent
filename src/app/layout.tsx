import type { Metadata, Viewport } from 'next';
import { Mulish } from 'next/font/google';
import './globals.css';
import CsrfPrefetcher from '@/components/csrf-prefetcher';
import AuthProvider from '@/components/AuthProvider';

// Nimiq uses Mulish as their primary font
const mulish = Mulish({ 
  subsets: ['latin'],
  variable: '--font-mulish',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nimagent.online'),
  title: 'NimAgent: AI-Powered Nimiq Payments',
  description: 'Send NIM, buy gift cards, top up airtime, pay bills, and swap crypto — all powered by AI inside Nimiq Pay.',
  applicationName: 'NimAgent',
  keywords: ['Nimiq', 'NIM', 'crypto payments', 'AI payments', 'gift cards', 'airtime', 'bill payments', 'crypto swap'],
  authors: [{ name: 'NimAgent' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/icon-1024.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'NimAgent — AI Crypto Payments',
    description: 'Send NIM • Gift Cards • Airtime • Bills • Swap Assets',
    siteName: 'NimAgent',
    type: 'website',
    url: 'https://nimagent.online',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NimAgent — AI-powered crypto payments for the real world',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@nimiqagent',
    title: 'NimAgent — AI Crypto Payments',
    description: 'Send NIM • Gift Cards • Airtime • Bills • Swap Assets',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0C17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={mulish.variable} suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Prevent flash of light mode - apply dark class immediately before render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('nimagent-storage');
                  if (stored) {
                    const data = JSON.parse(stored);
                    if (data.state && data.state.theme === 'dark') {
                      document.documentElement.classList.add('dark');
                    }
                  } else {
                    // Default to dark mode if no preference saved
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  // Default to dark mode on error
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        <CsrfPrefetcher />
        <AuthProvider />
        {/* Ambient background — flat base + subtle grid, fixed behind everything */}
        <div className="bg-mesh" aria-hidden="true" />
        <div className="bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}