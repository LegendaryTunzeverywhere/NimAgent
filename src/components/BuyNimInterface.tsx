'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface BuyQuote {
  amountFiat: number;
  currency: string;
  amountNIM: number;
  exchangeRate: number;
  coinifyFee: number;
  quoteId: string;
  expiresAt: string;
}

interface BuyNimInterfaceProps {
  onComplete?: () => void;
}

type KYCStep = 'input' | 'email' | 'verify' | 'payment' | 'complete';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  GHS: '₵',
  ZAR: 'R',
  INR: '₹',
};

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR', 'INR'];

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  ZAR: 'South African Rand',
  INR: 'Indian Rupee',
};

export default function BuyNimInterface({ onComplete }: BuyNimInterfaceProps) {
  const { wallet, addMessage } = useAppStore();
  const [step, setStep] = useState<KYCStep>('input');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [quote, setQuote] = useState<BuyQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Fetch quote when amount or currency changes
  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/coinify/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountFiat: parseFloat(amount),
          currency: currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get quote');
      }

      const data = await response.json();
      setQuote(data);
    } catch (err: any) {
      console.error('Failed to fetch quote:', err);
      setError(err.message || 'Failed to get quote. Please try again.');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, currency]);

  // Debounced quote fetch
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setQuote(null);
    }
  }, [amount, currency, fetchQuote]);

  // Quote expiry countdown
  useEffect(() => {
    if (!quote || step !== 'input') return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        // Quote expired, refresh
        fetchQuote();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [quote, step, fetchQuote]);

  const handleInitiateKYC = async () => {
    if (!wallet.address) {
      addMessage({
        role: 'ai',
        content: 'Please connect your wallet first to buy NIM.',
      });
      return;
    }

    if (!quote) {
      setError('Please enter an amount to get a quote first.');
      return;
    }

    setStep('email');
  };

  const handleSendVerificationEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coinify/initiate-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          walletAddress: wallet.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send verification email');
      }

      addMessage({
        role: 'ai',
        content: `📧 Verification email sent to ${email}!\n\nPlease check your inbox and enter the verification code below.`,
      });

      setStep('verify');
    } catch (err: any) {
      console.error('KYC initiation failed:', err);
      setError(err.message || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      setError('Please enter the verification code from your email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coinify/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: verificationCode,
          walletAddress: wallet.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      addMessage({
        role: 'ai',
        content: '✅ Email verified successfully! You can now proceed with payment.',
      });

      setStep('payment');
    } catch (err: any) {
      console.error('Verification failed:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrade = async () => {
    if (!quote) {
      setError('Quote expired. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coinify/create-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          email,
          walletAddress: wallet.address,
          nimAddress: wallet.address, // Where to send the NIM
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create trade');
      }

      const data = await response.json();

      addMessage({
        role: 'ai',
        content: `🎉 Trade created successfully!\n\n💳 **Payment Instructions:**\n${data.paymentInstructions}\n\n📊 **Trade ID:** ${data.tradeId}\n\nYour NIM will be sent to your wallet once payment is confirmed.`,
      });

      setStep('complete');
      onComplete?.();
    } catch (err: any) {
      console.error('Trade creation failed:', err);
      setError(err.message || 'Failed to create trade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light mb-3">
          <Icon name="wallet" size={24} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Buy NIM</h2>
        <p className="text-sm text-gray-600 dark:text-white/60">Purchase NIM with credit card or bank transfer</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <span className="text-error mt-0.5">⚠️</span>
          <p className="text-error text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Step 1: Amount Input */}
      {step === 'input' && (
        <div className="space-y-4">
          {/* Currency Selector */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-white/60">Currency</label>
            <div className="grid grid-cols-4 gap-2">
              {POPULAR_CURRENCIES.map((cur) => (
                <button
                  key={cur}
                  onClick={() => setCurrency(cur)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    currency === cur
                      ? 'bg-brand-blue text-white'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-white/60">
              Amount ({CURRENCY_NAMES[currency] || currency})
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-lg font-semibold outline-none focus:border-brand-blue/50"
                />
              </div>
              <div className="flex items-center">
                <div className="px-4 py-3 rounded-xl bg-brand-blue/10 border border-brand-blue/20 text-brand-blue-light font-semibold min-w-[80px] text-center">
                  {CURRENCY_SYMBOLS[currency] || currency}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-white/40">Minimum: {CURRENCY_SYMBOLS[currency]}20</p>
          </div>

          {/* Quote Display */}
          {quote && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/80 mb-2 flex items-center gap-1.5">
                <Icon name="wallet" size={14} strokeWidth={2} className="text-brand-blue-light" /> Quote
              </h3>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-white/60">Exchange Rate:</span>
                <span className="text-gray-900 dark:text-white font-mono">
                  1 NIM = {CURRENCY_SYMBOLS[currency]}{quote.exchangeRate.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-white/60">Coinify Fee:</span>
                <span className="text-gray-900 dark:text-white font-mono">
                  {CURRENCY_SYMBOLS[currency]}{quote.coinifyFee.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-200 dark:border-white/10 pt-2 mt-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-900 dark:text-white/80">You'll receive:</span>
                  <span className="text-success">
                    ~{quote.amountNIM.toFixed(2)} NIM
                  </span>
                </div>
              </div>
              {timeRemaining > 0 && (
                <p className={`text-xs text-center ${timeRemaining <= 10 ? 'text-warning animate-pulse' : 'text-gray-500 dark:text-white/40'}`}>
                  Quote expires in {timeRemaining}s
                </p>
              )}
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleInitiateKYC}
            disabled={loading || quoteLoading || !quote || !amount || parseFloat(amount) < 20}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              loading || quoteLoading || !quote || !amount || parseFloat(amount) < 20
                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 cursor-not-allowed'
                : 'bg-brand-blue text-white hover:bg-brand-blue-dark'
            }`}
          >
            {quoteLoading ? 'Getting quote...' : 'Continue to Payment'}
          </button>
        </div>
      )}

      {/* Step 2: Email Input */}
      {step === 'email' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-white/60">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm outline-none focus:border-brand-blue/50"
            />
            <p className="text-xs text-gray-500 dark:text-white/40">
              We'll send a verification code to this email for KYC compliance
            </p>
          </div>

          <button
            onClick={handleSendVerificationEmail}
            disabled={loading || !email || !email.includes('@')}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              loading || !email || !email.includes('@')
                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 cursor-not-allowed'
                : 'bg-brand-blue text-white hover:bg-brand-blue-dark'
            }`}
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>

          <button
            onClick={() => setStep('input')}
            className="w-full py-2 text-sm text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Verification Code */}
      {step === 'verify' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600 dark:text-white/60">Verification Code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter code from email"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm outline-none focus:border-brand-blue/50 text-center text-2xl font-mono tracking-widest"
              maxLength={6}
            />
            <p className="text-xs text-gray-500 dark:text-white/40 text-center">
              Check your email ({email}) for the verification code
            </p>
          </div>

          <button
            onClick={handleVerifyCode}
            disabled={loading || !verificationCode || verificationCode.length < 4}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              loading || !verificationCode || verificationCode.length < 4
                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 cursor-not-allowed'
                : 'bg-brand-blue text-white hover:bg-brand-blue-dark'
            }`}
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button
            onClick={handleSendVerificationEmail}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
          >
            Resend Code
          </button>
        </div>
      )}

      {/* Step 4: Payment */}
      {step === 'payment' && quote && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/80 mb-3">Order Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-white/60">Amount:</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[currency]}{quote.amountFiat}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-white/60">NIM to receive:</span>
              <span className="text-success font-semibold">~{quote.amountNIM.toFixed(2)} NIM</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-white/60">Delivery to:</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">{wallet.address?.substring(0, 14)}...</span>
            </div>
          </div>

          <button
            onClick={handleCreateTrade}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              loading
                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 cursor-not-allowed'
                : 'bg-brand-blue text-white hover:bg-brand-blue-dark'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating order...
              </span>
            ) : (
              'Proceed to Payment'
            )}
          </button>

          <button
            onClick={() => setStep('input')}
            className="w-full py-2 text-sm text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Order Created!</h3>
          <p className="text-sm text-gray-600 dark:text-white/60">
            Follow the payment instructions sent to your email. Your NIM will arrive once payment is confirmed.
          </p>
          <button
            onClick={() => {
              setStep('input');
              setAmount('');
              setEmail('');
              setVerificationCode('');
              setQuote(null);
            }}
            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
          >
            Buy More NIM
          </button>
        </div>
      )}

      {/* Info Notice */}
      <div className="text-xs text-gray-500 dark:text-white/40 text-center bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg p-3">
        <p className="mb-1 font-semibold text-gray-700 dark:text-white/60">Powered by Coinify</p>
        <p>Secure fiat-to-crypto purchase with KYC compliance. Minimum {CURRENCY_SYMBOLS[currency]}20.</p>
      </div>
    </div>
  );
}
