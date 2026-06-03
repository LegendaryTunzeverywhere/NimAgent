'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { requestPayment, prewarmHub } from '@/lib/wallet';
import { recordTransaction, createOrder, validateOrder } from '@/lib/api-client';
import QRCodeDisplay from './QRCodeDisplay';
import BalanceDisplay from './BalanceDisplay';
import QRScanner from './QRScanner';
import SwapInterface from './SwapInterface';
import type { ActionCard as ActionCardType } from '@/types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  GHS: '₵',
};

interface ActionCardProps {
  action: ActionCardType;
}

export default function ActionCard({ action }: ActionCardProps) {
  const { wallet, addMessage } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false); // Track failures
  const [amount, setAmount] = useState(action.amountLuna ? (action.amountLuna / 100000).toFixed(2) : '');
  const [email, setEmail] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Pre-validation state — done BEFORE the user clicks Pay so the wallet
  // popup isn't blocked by a network request inside the click handler.
  const isOrder = action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill';
  const [prevalidationError, setPrevalidationError] = useState<string | null>(null);
  // LOCK IMMEDIATELY for orders to prevent editing during validation, and lock after transaction completes
  const [amountLocked, setAmountLocked] = useState(isOrder);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  
  // Real-time quote refresh state
  const [quoteExpiry, setQuoteExpiry] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [refreshing, setRefreshing] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [lastKnownAmount, setLastKnownAmount] = useState<number | null>(null);

  // Refresh quote function
  const refreshQuote = async () => {
    if (!isOrder || success || failed || loading) return;
    
    setRefreshing(true);
    setPriceChanged(false);
    
    try {
      const validation = await validateOrder({
        type: action.type,
        details: action,
        walletAddress: wallet.address || undefined,
      });
      
      if (validation.valid && typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
        const oldAmountLuna = action.amountLuna || 0;
        const newAmountLuna = validation.amountLuna;
        const oldAmount = parseFloat(amount) || 0;
        const newAmount = newAmountLuna / 100000;
        
        // Update IDs
        if (validation.productId) action.productId = validation.productId;
        if (validation.operatorId) action.operatorId = validation.operatorId;
        if (validation.billerId) action.billerId = validation.billerId;
        if (validation.quoteId) setQuoteId(validation.quoteId);
        
        // Check if price changed significantly (>2%)
        if (oldAmountLuna > 0 && Math.abs((newAmount - oldAmount) / oldAmount) > 0.02) {
          setPriceChanged(true);
          const direction = newAmount > oldAmount ? 'increased' : 'decreased';
          const percentChange = Math.abs(((newAmount - oldAmount) / oldAmount) * 100).toFixed(1);
          console.log(`[Quote Refresh] Price ${direction} by ${percentChange}%: ${oldAmount.toFixed(2)} → ${newAmount.toFixed(2)} NIM`);
        }
        
        // Update amount
        action.amountLuna = newAmountLuna;
        setAmount(newAmount.toFixed(2));
        setLastKnownAmount(newAmount);
        
        // Set expiry if provided (default 60 seconds)
        const expiryTime = validation.expiresAt 
          ? new Date(validation.expiresAt).getTime()
          : Date.now() + 60000;
        setQuoteExpiry(expiryTime);
        
        setPrevalidationError(null);
      } else if (!validation.valid) {
        setPrevalidationError(validation.error || 'Quote validation failed');
      }
    } catch (err) {
      console.error('[Quote Refresh] Failed:', err);
      // Don't show error to user, just log it
    } finally {
      setRefreshing(false);
    }
  };

  // Countdown timer for quote expiry
  useEffect(() => {
    if (!isOrder || !quoteExpiry || success || failed || loading) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((quoteExpiry - Date.now()) / 1000));
      setTimeRemaining(remaining);
      
      // Auto-refresh when quote expires
      if (remaining === 0) {
        console.log('[Quote Refresh] Quote expired, refreshing...');
        refreshQuote();
      }
      
      // Warn user when less than 10 seconds
      if (remaining <= 10 && remaining > 0 && !priceChanged) {
        setPriceChanged(true);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [quoteExpiry, success, failed, loading, isOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm up the Hub and pre-validate orders as soon as the card mounts.
  // This keeps the eventual checkout() call inside the user's click gesture
  // with no blocking await before it, so the wallet popup opens naturally.
  useEffect(() => {
    if (action.type === 'send' || isOrder) {
      prewarmHub();
    }

    if (isOrder) {
      let cancelled = false;
      validateOrder({ type: action.type, details: action, walletAddress: wallet.address || undefined })
        .then((validation) => {
          if (cancelled) return;
          if (validation.valid) {
            if (validation.productId) action.productId = validation.productId;
            if (validation.operatorId) action.operatorId = validation.operatorId;
            if (validation.billerId) action.billerId = validation.billerId;
            if (validation.quoteId) setQuoteId(validation.quoteId);
            // Use the SERVER's authoritative NIM amount (works for all
            // currencies, not just USD). This is what the user pays and what
            // the backend re-verifies on-chain, so prefill it here.
            if (typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
              action.amountLuna = validation.amountLuna;
              setAmount((validation.amountLuna / 100000).toFixed(2));
              setLastKnownAmount(validation.amountLuna / 100000);
              
              // Set initial expiry (60 seconds default)
              const expiryTime = validation.expiresAt 
                ? new Date(validation.expiresAt).getTime()
                : Date.now() + 60000;
              setQuoteExpiry(expiryTime);
            }
            setPrevalidationError(null);
          } else {
            // Surface the validated amount even on "amount not supported" so the
            // user sees a sane figure rather than a blank/wrong one.
            if (typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
              setAmount((validation.amountLuna / 100000).toFixed(2));
            }
            setPrevalidationError(validation.error || 'This order could not be validated.');
          }
        })
        .catch(() => {
          // If pre-validation fails (e.g. network), the click path will retry;
          // we just lose the popup-timing optimization.
        });
      return () => { cancelled = true; };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle QR Code display
  if (action.type === 'qr-code' && action.address) {
    return <QRCodeDisplay address={action.address} />;
  }

  // Handle QR Code scanning
  if (action.type === 'qr-scan') {
    return <QRScanner />;
  }

  // Handle Balance display
  if (action.type === 'balance') {
    return <BalanceDisplay walletAddress={wallet.address || ''} />;
  }

  // Handle Crypto Swap - show swap interface
  if (action.type === 'crypto-swap') {
    return <SwapInterface />;
  }

  const executeAction = async () => {
    if (!wallet.address) {
      addMessage({
        role: 'ai',
        content: 'Please connect your wallet first to complete this action.',
      });
      return;
    }

    const nimAmount = parseFloat(amount);
    if (!nimAmount || nimAmount <= 0) {
      addMessage({
        role: 'ai',
        content: 'Please enter a valid NIM amount.',
      });
      return;
    }

    // For orders (gift-card, airtime, bill), use the validated amountLuna from the backend
    // which includes the 5% markup (volatility buffer + service fee). For simple sends, calculate from user input.
    const amountLuna = (action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill')
      ? (action.amountLuna || Math.round(nimAmount * 100000))
      : Math.round(nimAmount * 100000);
    
    setLoading(true);

    try {
      if (action.type === 'send') {
        // Send NIM transaction
        console.log('[ActionCard] Initiating send transaction:', {
          recipient: action.recipient,
          amountLuna,
          walletAddress: wallet.address
        });
        
        const hash = await requestPayment(
          action.recipient!,
          amountLuna,
          'NimHub-send',
          'direct',
          wallet.address // Pass wallet address to skip address selection
        );

        console.log('[ActionCard] Transaction successful, hash:', hash);

        await recordTransaction({
          type: 'send',
          fromAddress: wallet.address,
          toAddress: action.recipient!,
          amountLuna,
          txHash: hash,
          status: 'completed',
        });

        setSuccess(true);
        setTxHash(hash);
        setAmountLocked(true); // Lock after successful transaction
        const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
        const explorerUrl = network === 'mainnet' 
          ? `https://nimiq.watch/#${hash}`
          : `https://test.nimiq.watch/#${hash}`;
        
        addMessage({
          role: 'ai',
          content: `Payment sent successfully! 🎉\n\nTransaction Hash:\n${hash}\n\nView on explorer:\n${explorerUrl}`,
        });

      } else if (action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill') {
        // If pre-validation already flagged a problem, stop before the popup.
        if (prevalidationError) {
          addMessage({
            role: 'ai',
            content: `Cannot process this order: ${prevalidationError}\n\nNo NIM was deducted. Please try with different details.`,
          });
          setLoading(false);
          return;
        }

        // Trigger the wallet popup FIRST, directly from the click gesture, so
        // the browser doesn't block it. Order validation already ran on mount.
        const serviceAddress = process.env.NEXT_PUBLIC_SERVICE_ADDRESS || action.recipient || 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
        
        console.log('[ActionCard] Processing order:', {
          type: action.type,
          serviceAddress,
          amountLuna,
          actionAmountLuna: action.amountLuna,
          nimAmount,
          fiatAmount: action.fiatAmount,
          currency: action.currency,
        });
        
        const hash = await requestPayment(
          serviceAddress,
          amountLuna,
          `NimHub-${action.type}`,
          action.type,
          wallet.address // Pass wallet address to skip address selection
        );

        // Let the user know we're confirming the payment on-chain before
        // releasing the gift card code / airtime / bill payment.
        addMessage({
          role: 'ai',
          content: 'Payment sent. Confirming it on the Nimiq network before releasing your order — this can take a few seconds…',
        });

        // Fulfill order (backend verifies the on-chain payment first)
        const result = await createOrder({
          type: action.type,
          txHash: hash,
          amountLuna,
          details: { ...action, recipientEmail: email || undefined },
          walletAddress: wallet.address,
          quoteId: quoteId || undefined,
        });

        if (result.success) {
          setSuccess(true);
          setTxHash(hash);
          setAmountLocked(true); // Lock after successful transaction
          const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
          const explorerUrl = network === 'mainnet' 
            ? `https://nimiq.watch/#${hash}`
            : `https://test.nimiq.watch/#${hash}`;

          if (action.type === 'gift-card' && result.code) {
            let msg = `Here's your ${action.product} gift card! 🎁\n\n🎟️ Gift Card Code:\n${result.code}`;
            if (result.pin) msg += `\n🔐 PIN: ${result.pin}`;
            if (result.serialNumber) msg += `\n#️⃣ Serial: ${result.serialNumber}`;
            if (email) msg += `\n\n📧 Gift card sent to: ${email}`;
            msg += `\n\n💳 Transaction Hash:\n${hash}\n\n🔗 View on Explorer:\n${explorerUrl}\n\n⚠️ Keep this safe — it won't be shown again.`;
            addMessage({ role: 'ai', content: msg });
          } else if (action.type === 'gift-card') {
            let msg = `${action.product} gift card order placed! 🎁\n\n`;
            if (result.sandboxNote) msg += `ℹ️ ${result.sandboxNote}\n\n`;
            if (email) msg += `📧 Gift card will be sent to: ${email}\n\n`;
            msg += `💳 Transaction Hash:\n${hash}\n\n🔗 View on Explorer:\n${explorerUrl}`;
            addMessage({ role: 'ai', content: msg });
          } else if (action.type === 'airtime') {
            addMessage({
              role: 'ai',
              content: `Airtime sent! 📱\n\n${action.operator} ${CURRENCY_SYMBOLS[action.currency || 'USD']}${action.fiatAmount} to ${action.phone}\n\nTransaction Hash:\n${hash}\n\nView on explorer:\n${explorerUrl}`,
            });
          } else if (action.type === 'bill') {
            addMessage({
              role: 'ai',
              content: `Bill paid! 🧾\n\n${action.service} payment of ${CURRENCY_SYMBOLS[action.currency || 'USD']}${action.fiatAmount} confirmed.\n\nRef: ${result.reference}\n\nTransaction Hash:\n${hash}\n\nView on explorer:\n${explorerUrl}`,
            });
          }
        } else {
          throw new Error(result.error || 'Order fulfillment failed');
        }
      }
    } catch (error: any) {
      console.error('Action execution error:', error);
      
      // Mark as failed and lock the card
      setFailed(true);
      setAmountLocked(true);
      
      // Provide more specific error messages
      let errorMessage = 'Payment failed: ';
      if (error.message?.includes('User closed')) {
        errorMessage += 'You cancelled the transaction.';
      } else if (error.message?.includes('timeout')) {
        errorMessage += 'The wallet took too long to respond. Please try again.';
      } else if (error.message?.includes('popup')) {
        errorMessage += 'Popup was blocked. Please allow popups for this site and try again.';
      } else {
        errorMessage += error.message || 'Something went wrong. Please try again.';
      }
      
      addMessage({
        role: 'ai',
        content: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3 max-w-sm">
      {/* Action Details */}
      {action.type === 'send' && (
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-sm">To</span>
          <span className="text-white font-mono text-xs">{action.recipient?.substring(0, 14)}...</span>
        </div>
      )}

      {action.type === 'gift-card' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-sm">Product</span>
            <span className="text-white font-semibold">{action.product}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Value</span>
              <span className="text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-white/50 text-xs">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/25 outline-none focus:border-gold/50"
            />
            <p className="text-white/30 text-xs">We'll send the gift card code to this email</p>
          </div>
        </>
      )}

      {action.type === 'airtime' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-sm">Phone</span>
            <span className="text-white font-semibold">{action.phone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-sm">Operator</span>
            <span className="text-white font-semibold">{action.operator}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Amount</span>
              <span className="text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
        </>
      )}

      {action.type === 'bill' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-sm">Service</span>
            <span className="text-white font-semibold">{action.service}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-sm">Account</span>
            <span className="text-white font-mono text-xs">{action.accountNumber}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Amount</span>
              <span className="text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
        </>
      )}

      {/* Amount Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-white/50 text-xs">Amount to pay</label>
          {isOrder && !success && quoteExpiry && (
            <button
              onClick={refreshQuote}
              disabled={refreshing || loading}
              className="text-xs text-gold/70 hover:text-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Refresh quote to get latest NIM price"
            >
              <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-9-9 9 9 0 019 9z" />
                <path d="M21 12a9 9 0 01-9 9" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border ${failed ? 'border-error/50' : 'border-white/10'} ${amountLocked ? 'opacity-75' : 'focus-within:border-gold/50'}`}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            disabled={loading || success || failed || amountLocked}
            readOnly={amountLocked}
            className="flex-1 bg-transparent text-white text-sm outline-none disabled:cursor-not-allowed"
          />
          <span className="text-white/50 text-sm font-semibold">NIM</span>
        </div>
        {isOrder && !success && quoteExpiry && timeRemaining > 0 && (
          <p className={`text-xs ${timeRemaining <= 10 ? 'text-warning animate-pulse' : 'text-white/40'} text-right`}>
            Quote expires in {timeRemaining}s
          </p>
        )}
      </div>

      {/* Price change alert */}
      {priceChanged && !success && isOrder && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 p-2.5">
          <span className="text-warning mt-0.5">⚠️</span>
          <p className="text-warning text-xs leading-relaxed">
            {timeRemaining <= 10 && timeRemaining > 0
              ? `Quote expiring soon! Click "Refresh" to update the price.`
              : `NIM price updated. Amount changed from ${lastKnownAmount?.toFixed(2) || '?'} to ${amount} NIM.`}
          </p>
        </div>
      )}

      {/* Pre-validation warning (orders only) */}
      {prevalidationError && !success && (
        <div className="flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 p-2.5">
          <span className="text-error mt-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
          </span>
          <p className="text-error text-xs leading-relaxed">{prevalidationError}</p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={executeAction}
        disabled={loading || success || failed || !amount || parseFloat(amount) <= 0 || !!prevalidationError}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          success
            ? 'bg-green-500/20 text-green-400 cursor-default'
            : failed
            ? 'bg-error/20 text-error cursor-default'
            : 'btn-gold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {loading ? 'Processing...' : success ? '✓ Payment Complete!' : failed ? '✗ Transaction Failed' : 'Confirm & Pay'}
      </button>
      
      {success && txHash && (
        <p className="text-xs text-success text-center">
          Transaction recorded. Check History tab to view details.
        </p>
      )}
      
      {failed && (
        <p className="text-xs text-error text-center">
          Transaction failed. Card is now locked. Please start a new request.
        </p>
      )}
    </div>
  );
}