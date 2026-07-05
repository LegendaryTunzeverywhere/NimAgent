import type { Metadata, Viewport } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import './globals.css';
import CsrfPrefetcher from '@/components/csrf-prefetcher';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
});

export const metadata: Metadata = {
  title: 'NimAgent: AI-Powered Nimiq Payments',
  description: 'Send NIM, split bills, buy gift cards, recharge airtime, pay bills, all powered by AI.',
  applicationName: 'NimAgent',
  keywords: ['Nimiq', 'NIM', 'crypto payments', 'AI payments', 'gift cards', 'airtime', 'bill payments', 'crypto swap'],
  authors: [{ name: 'NimAgent' }],
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'NimAgent: AI-Powered Nimiq Payments',
    description: 'Send NIM, buy gift cards, recharge airtime, pay bills, and swap crypto, all powered by AI.',
    siteName: 'NimAgent',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NimAgent: AI-Powered Nimiq Payments',
    description: 'Your AI-powered Nimiq payment Agent.',
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
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`} suppressHydrationWarning={true}>
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
        {/* Ambient background — flat base + subtle grid, fixed behind everything */}
        <div className="bg-mesh" aria-hidden="true" />
        <div className="bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}