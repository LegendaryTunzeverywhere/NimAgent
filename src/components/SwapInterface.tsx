<<<<<<< HEAD
'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface SwapQuote {
  nimAmount?: number;
  btcAmount?: number;
  rate: number;
  fee: number;
  feePercent: number;
}

interface SwapRates {
  nimtoBTC: {
    rate: number;
    description: string;
  };
  btctoNIM: {
    rate: number;
    description: string;
  };
  lastUpdate: string;
}

export default function SwapInterface() {
  const { wallet, addMessage } = useAppStore();
  const [fromCoin, setFromCoin] = useState<'NIM' | 'BTC'>('NIM');
  const [toCoin, setToCoin] = useState<'NIM' | 'BTC'>('BTC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [rates, setRates] = useState<SwapRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setQuote(null);
    }
  }, [amount, fromCoin, toCoin]);

  const fetchRates = async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/api/swap/rates`);
      const data = await response.json();
      setRates(data);
    } catch (error) {
      console.error('Failed to fetch swap rates:', error);
    }
  };

  const fetchQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setQuoteLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const endpoint = fromCoin === 'NIM' 
        ? '/api/swap/quote/nim-to-btc'
        : '/api/swap/quote/btc-to-nim';
      
      const body = fromCoin === 'NIM' 
        ? { nimAmount: parseFloat(amount) }
        : { btcAmount: parseFloat(amount) };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setQuote(data);
    } catch (error) {
      console.error('Failed to fetch quote:', error);
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwapDirection = () => {
    setFromCoin(toCoin);
    setToCoin(fromCoin);
    setAmount('');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!wallet.address) {
      addMessage({
        role: 'ai',
        content: 'Please connect your wallet first to perform swaps.',
      });
      return;
    }

    if (!quote || !amount) {
      addMessage({
        role: 'ai',
        content: 'Please enter an amount to get a swap quote first.',
      });
      return;
    }

    setLoading(true);
    try {
      // For now, show a message about the swap process
      const outputAmount = fromCoin === 'NIM' ? quote.btcAmount : quote.nimAmount;
      const feeAmount = quote.fee;
      
      addMessage({
        role: 'ai',
        content: `Swap initiated! 🔄\n\n📊 **Swap Details:**\n• From: ${amount} ${fromCoin}\n• To: ~${outputAmount?.toFixed(8)} ${toCoin}\n• Fee: ${feeAmount?.toFixed(8)} ${toCoin} (${quote.feePercent}%)\n• Rate: ${quote.rate.toFixed(8)}\n\n⚠️ **Note:** This is a demo swap interface. In production, this would integrate with real exchange APIs like 1inch or Changelly to execute the swap.\n\n🔗 The swap would create a transaction that you'd need to sign with your wallet.`,
      });
    } catch (error) {
      console.error('Swap error:', error);
      addMessage({
        role: 'ai',
        content: 'Swap failed. Please try again or contact support.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 text-gold mb-3">
          <Icon name="swap" size={24} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Crypto Swap</h2>
        <p className="text-sm text-white/60">Exchange NIM for BTC instantly</p>
      </div>

      {/* Current Rates */}
      {rates && (
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
            <Icon name="history" size={14} strokeWidth={2} className="text-gold" /> Current Rates
          </h3>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">1 NIM =</span>
            <span className="text-white font-mono">{rates.nimtoBTC.rate.toFixed(8)} BTC</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">1 BTC =</span>
            <span className="text-white font-mono">{rates.btctoNIM.rate.toFixed(2)} NIM</span>
          </div>
          <div className="text-xs text-white/40 text-center mt-2">
            Updated: {new Date(rates.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Swap Interface */}
      <div className="space-y-4">
        {/* From Section */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">From</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-semibold outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex items-center">
              <div className="px-4 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-semibold min-w-[80px] text-center">
                {fromCoin}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapDirection}
            className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 hover:rotate-180 transition-all duration-300 flex items-center justify-center"
            title="Swap direction"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10 3 6l4-4" />
              <path d="M3 6h12a4 4 0 0 1 0 8" />
              <path d="m17 14 4 4-4 4" />
              <path d="M21 18H9a4 4 0 0 1 0-8" />
            </svg>
          </button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">To</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-semibold min-h-[52px] flex items-center">
                {quoteLoading ? (
                  <span className="text-white/40">Calculating...</span>
                ) : quote ? (
                  <span>
                    {fromCoin === 'NIM' 
                      ? quote.btcAmount?.toFixed(8) 
                      : quote.nimAmount?.toFixed(6)
                    }
                  </span>
                ) : (
                  <span className="text-white/40">0.00</span>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="px-4 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-semibold min-w-[80px] text-center">
                {toCoin}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
            <Icon name="wallet" size={14} strokeWidth={2} className="text-gold" /> Quote Details
          </h3>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Exchange Rate:</span>
            <span className="text-white font-mono">
              1 {fromCoin} = {quote.rate.toFixed(8)} {toCoin}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Network Fee:</span>
            <span className="text-white font-mono">
              {quote.fee.toFixed(8)} {toCoin} ({quote.feePercent}%)
            </span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-white/80">You'll receive:</span>
              <span className="text-success">
                ~{fromCoin === 'NIM' 
                  ? quote.btcAmount?.toFixed(8) 
                  : quote.nimAmount?.toFixed(6)
                } {toCoin}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={loading || !quote || !amount || parseFloat(amount) <= 0}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          loading || !quote || !amount || parseFloat(amount) <= 0
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'btn-gold'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-background-primary/40 border-t-background-primary rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Icon name="swap" size={18} strokeWidth={2.2} /> Swap Now
          </span>
        )}
      </button>

      {/* Disclaimer */}
      <div className="text-xs text-white/40 text-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <p className="mb-1 font-semibold text-white/60">Demo Mode</p>
        <p>This swap interface shows real rates but doesn&apos;t execute actual swaps. In production, it would integrate with exchange APIs.</p>
      </div>
    </div>
  );
}
=======
'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface SwapQuote {
  nimAmount?: number;
  btcAmount?: number;
  rate: number;
  fee: number;
  feePercent: number;
}

interface SwapRates {
  nimtoBTC: {
    rate: number;
    description: string;
  };
  btctoNIM: {
    rate: number;
    description: string;
  };
  lastUpdate: string;
}

export default function SwapInterface() {
  const { wallet, addMessage } = useAppStore();
  const [fromCoin, setFromCoin] = useState<'NIM' | 'BTC'>('NIM');
  const [toCoin, setToCoin] = useState<'NIM' | 'BTC'>('BTC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [rates, setRates] = useState<SwapRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setQuote(null);
    }
  }, [amount, fromCoin, toCoin]);

  const fetchRates = async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/api/swap/rates`);
      const data = await response.json();
      setRates(data);
    } catch (error) {
      console.error('Failed to fetch swap rates:', error);
    }
  };

  const fetchQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setQuoteLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const endpoint = fromCoin === 'NIM' 
        ? '/api/swap/quote/nim-to-btc'
        : '/api/swap/quote/btc-to-nim';
      
      const body = fromCoin === 'NIM' 
        ? { nimAmount: parseFloat(amount) }
        : { btcAmount: parseFloat(amount) };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setQuote(data);
    } catch (error) {
      console.error('Failed to fetch quote:', error);
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwapDirection = () => {
    setFromCoin(toCoin);
    setToCoin(fromCoin);
    setAmount('');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!wallet.address) {
      addMessage({
        role: 'ai',
        content: 'Please connect your wallet first to perform swaps.',
      });
      return;
    }

    if (!quote || !amount) {
      addMessage({
        role: 'ai',
        content: 'Please enter an amount to get a swap quote first.',
      });
      return;
    }

    setLoading(true);
    try {
      // For now, show a message about the swap process
      const outputAmount = fromCoin === 'NIM' ? quote.btcAmount : quote.nimAmount;
      const feeAmount = quote.fee;
      
      addMessage({
        role: 'ai',
        content: `Swap initiated! 🔄\n\n📊 **Swap Details:**\n• From: ${amount} ${fromCoin}\n• To: ~${outputAmount?.toFixed(8)} ${toCoin}\n• Fee: ${feeAmount?.toFixed(8)} ${toCoin} (${quote.feePercent}%)\n• Rate: ${quote.rate.toFixed(8)}\n\n⚠️ **Note:** This is a demo swap interface. In production, this would integrate with real exchange APIs like 1inch or Changelly to execute the swap.\n\n🔗 The swap would create a transaction that you'd need to sign with your wallet.`,
      });
    } catch (error) {
      console.error('Swap error:', error);
      addMessage({
        role: 'ai',
        content: 'Swap failed. Please try again or contact support.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 text-gold mb-3">
          <Icon name="swap" size={24} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Crypto Swap</h2>
        <p className="text-sm text-white/60">Exchange NIM for BTC instantly</p>
      </div>

      {/* Current Rates */}
      {rates && (
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
            <Icon name="history" size={14} strokeWidth={2} className="text-gold" /> Current Rates
          </h3>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">1 NIM =</span>
            <span className="text-white font-mono">{rates.nimtoBTC.rate.toFixed(8)} BTC</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">1 BTC =</span>
            <span className="text-white font-mono">{rates.btctoNIM.rate.toFixed(2)} NIM</span>
          </div>
          <div className="text-xs text-white/40 text-center mt-2">
            Updated: {new Date(rates.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Swap Interface */}
      <div className="space-y-4">
        {/* From Section */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">From</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-semibold outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex items-center">
              <div className="px-4 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-semibold min-w-[80px] text-center">
                {fromCoin}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapDirection}
            className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 hover:rotate-180 transition-all duration-300 flex items-center justify-center"
            title="Swap direction"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10 3 6l4-4" />
              <path d="M3 6h12a4 4 0 0 1 0 8" />
              <path d="m17 14 4 4-4 4" />
              <path d="M21 18H9a4 4 0 0 1 0-8" />
            </svg>
          </button>
        </div>

        {/* To Section */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">To</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-semibold min-h-[52px] flex items-center">
                {quoteLoading ? (
                  <span className="text-white/40">Calculating...</span>
                ) : quote ? (
                  <span>
                    {fromCoin === 'NIM' 
                      ? quote.btcAmount?.toFixed(8) 
                      : quote.nimAmount?.toFixed(6)
                    }
                  </span>
                ) : (
                  <span className="text-white/40">0.00</span>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="px-4 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-semibold min-w-[80px] text-center">
                {toCoin}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
            <Icon name="wallet" size={14} strokeWidth={2} className="text-gold" /> Quote Details
          </h3>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Exchange Rate:</span>
            <span className="text-white font-mono">
              1 {fromCoin} = {quote.rate.toFixed(8)} {toCoin}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Network Fee:</span>
            <span className="text-white font-mono">
              {quote.fee.toFixed(8)} {toCoin} ({quote.feePercent}%)
            </span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-white/80">You'll receive:</span>
              <span className="text-success">
                ~{fromCoin === 'NIM' 
                  ? quote.btcAmount?.toFixed(8) 
                  : quote.nimAmount?.toFixed(6)
                } {toCoin}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={loading || !quote || !amount || parseFloat(amount) <= 0}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          loading || !quote || !amount || parseFloat(amount) <= 0
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'btn-gold'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-background-primary/40 border-t-background-primary rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Icon name="swap" size={18} strokeWidth={2.2} /> Swap Now
          </span>
        )}
      </button>

      {/* Disclaimer */}
      <div className="text-xs text-white/40 text-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <p className="mb-1 font-semibold text-white/60">Demo Mode</p>
        <p>This swap interface shows real rates but doesn&apos;t execute actual swaps. In production, it would integrate with exchange APIs.</p>
      </div>
    </div>
  );
}
>>>>>>> fe7c71977bd3a17b2432805024c7c963bcd1e6b5
