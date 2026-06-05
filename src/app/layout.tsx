import type { Metadata, Viewport } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import './globals.css';

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
  title: 'NimHub: AI-Powered Nimiq Payments',
  description: 'Send NIM, split bills, buy gift cards, recharge airtime, pay bills, and swap crypto, all powered by AI.',
  applicationName: 'NimHub',
  keywords: ['Nimiq', 'NIM', 'crypto payments', 'AI payments', 'gift cards', 'airtime', 'bill payments', 'crypto swap'],
  authors: [{ name: 'NimHub' }],
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'NimHub: AI-Powered Nimiq Payments',
    description: 'Send NIM, buy gift cards, recharge airtime, pay bills, and swap crypto, all powered by AI.',
    siteName: 'NimHub',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NimHub: AI-Powered Nimiq Payments',
    description: 'Your AI-powered Nimiq payment hub.',
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
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        {/* Ambient background — flat base + subtle grid, fixed behind everything */}
        <div className="bg-mesh" aria-hidden="true" />
        <div className="bg-grid" aria-hidden="true" />
        {children}
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js"></script>
{/* impeccable-live-end */}
</body>
    </html>
  );
}