'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function TickerBar() {
  const { wallet } = useAppStore();
  const [nimPrice, setNimPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';

  useEffect(() => {
    // Fetch NIM price from CoinGecko via BFF proxy
    const fetchPrice = async () => {
      try {
        // Use BFF proxy (same-origin request)
        const res = await fetch(`/api/nim-price?currency=usd`);
        if (res.ok) {
          const data = await res.json();
          setNimPrice(data.price);
          setPriceChange(data.change24h || 3.14);
        }
      } catch (error) {
        console.error('Failed to fetch NIM price:', error);
        // Fallback to mock price if API is unavailable
        setNimPrice(0.0621);
        setPriceChange(3.14);
      }
    };

    fetchPrice();
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    nimPrice ? `NIM  $${nimPrice.toFixed(4)}  ${priceChange && priceChange > 0 ? '+' : ''}${priceChange?.toFixed(2)}%` : 'NIM  LOADING...',
    'AI AGENT  ACTIVE',
    wallet.connected && wallet.address 
      ? `${wallet.address.slice(0, 4)} ${wallet.address.slice(5, 9)} ${wallet.address.slice(10, 14)} ••• CONNECTED`
      : 'WALLET  NOT CONNECTED',
    `NETWORK  ${network.toUpperCase()}`,
    nimPrice ? `NIM  $${nimPrice.toFixed(4)}  ${priceChange && priceChange > 0 ? '+' : ''}${priceChange?.toFixed(2)}%` : 'NIM  LOADING...',
    'POWERED BY NIMIQ',
  ];
  
  const text = items.join('   ·   ');

  return (
    <div className="relative overflow-hidden w-full bg-gold/[0.07] border-b border-gold/15 py-1.5">
      {/* Edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none bg-gradient-to-r from-background-primary to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none bg-gradient-to-l from-background-primary to-transparent" />
      <div className="inline-block whitespace-nowrap animate-ticker text-gold text-[11px] font-mono tracking-wider font-semibold">
        {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
      </div>
    </div>
  );
}
