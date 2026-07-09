'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { openExternalUrl } from '@/lib/external-links';
import { SOCIAL_LINKS } from '@/lib/social-links';
import { requestPayment, prewarmHub } from '@/lib/wallet';
import { recordTransaction, createOrder, validateOrder, pollOrderStatus, getLeaderboard } from '@/lib/api-client';
import { enqueuePendingSync, removePendingSync } from '@/lib/pending-sync-queue';
import QRCodeDisplay from './QRCodeDisplay';
import BalanceDisplay from './BalanceDisplay';
import QRScanner from './QRScanner';
import Icon from './Icon';

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
  const { wallet, addMessage, messages, updateActionState, sendMessageToAI, fetchBalance } = useAppStore();
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const [loading, setLoading] = useState(false);
  const isExecutingRef = useRef(false);
  const [success, setSuccess] = useState(action.completed || false);
  const [failed, setFailed] = useState(action.failed || false);
  const [amount, setAmount] = useState(action.amountLuna ? (action.amountLuna / 100000).toFixed(2) : '');
  const [email, setEmail] = useState('');
  const [txHash, setTxHash] = useState<string | null>(action.txHash || null);
  const [savedContacts, setSavedContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  // Catalog-supplied denomination hints — populated from validateOrder response
  const [availableAmounts, setAvailableAmounts] = useState<number[] | null>(action.availableAmounts || null);
  const [amountRange, setAmountRange] = useState<{ min: number; max: number; currency: string } | null>(
    action.minAmount != null && action.maxAmount != null
      ? { min: action.minAmount, max: action.maxAmount, currency: action.currency || 'USD' }
      : null
  );
  
  // Referral/Leaderboard hooks
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  
  // Leaderboard effect
  useEffect(() => {
    if (action.type === 'leaderboard') {
      const fetchLeaderboard = async () => {
        try {
          const data = await getLeaderboard(20);
          setLeaderboard(data.leaderboard || []);
        } catch (err) {
          // Silent failure
        } finally {
          setLeaderboardLoading(false);
        }
      };
      fetchLeaderboard();
    }
  }, [action.type]);
  
  // Find the index of this message in the messages array
  const messageIndex = messages.findIndex(msg => msg.action === action);

  // Pre-validation state — done BEFORE the user clicks Pay so the wallet
  // popup isn't blocked by a network request inside the click handler.
  const isOrder = action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill';
  // Lock immediately for orders (server-priced), AND for payment requests where
  // the receiver has specified a fixed amount the sender must not change.
  const isPaymentRequest = action.type === 'send' && !!action.locked && !!action.amountLuna;
  const [prevalidationError, setPrevalidationError] = useState<string | null>(null);
  const [amountLocked, setAmountLocked] = useState(isOrder || isPaymentRequest);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  
  // Real-time quote refresh state
  const [quoteExpiry, setQuoteExpiry] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [refreshing, setRefreshing] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [lastKnownAmount, setLastKnownAmount] = useState<number | null>(null);
  const [billAccountConfirmed, setBillAccountConfirmed] = useState(action.type !== 'bill');

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
      // Silent failure
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

    // Balance check for 'send' actions
    if (action.type === 'send') {
      const sendAmountLuna = action.amountLuna || Math.round(parseFloat(amount) * 100000);
      const currentBalanceLuna = Math.round((wallet.balance?.nim.balance ?? 0) * 100000);
      
      if (sendAmountLuna > currentBalanceLuna) {
        const shortfall = ((sendAmountLuna - currentBalanceLuna) / 100000).toFixed(5);
        setPrevalidationError(
          `Insufficient balance. You have ${(currentBalanceLuna / 100000).toFixed(5)} NIM, ` +
          `but this requires ${(sendAmountLuna / 100000).toFixed(5)} NIM (short by ${shortfall} NIM).`
        );
      } else {
        setPrevalidationError(null);
      }
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
            if (typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
              action.amountLuna = validation.amountLuna;
              setAmount((validation.amountLuna / 100000).toFixed(2));
              setLastKnownAmount(validation.amountLuna / 100000);
              
              const expiryTime = validation.expiresAt 
                ? new Date(validation.expiresAt).getTime()
                : Date.now() + 60000;
              setQuoteExpiry(expiryTime);
            }
            // Store denomination hints from catalog so the UI can show them
            if (validation.availableAmounts?.length) setAvailableAmounts(validation.availableAmounts);
            if (validation.minAmount != null && validation.maxAmount != null) {
              setAmountRange({
                min: validation.minAmount,
                max: validation.maxAmount,
                currency: (validation.recipientCurrency || validation.localCurrency || action.currency || 'USD').toUpperCase(),
              });
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
  }, [wallet.balance?.nim.balance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch contacts for show-contacts action type
  useEffect(() => {
    if ((action.type === 'show-contacts' || action.type === 'list-contacts') && wallet.address && savedContacts.length === 0) {
      setLoadingContacts(true);
      import('@/lib/api-client').then(({ getSavedAddresses }) => {
        getSavedAddresses(wallet.address!)
          .then(contacts => {
            setSavedContacts(contacts);
          })
          .catch(() => {
            // Silent failure
          })
          .finally(() => {
            setLoadingContacts(false);
          });
      });
    }
  }, [wallet.address, action.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Referral Link
  if (action.type === 'referral') {
    const referralLink = action.referralLink || '';
    const referralCount = action.referralCount || 0;
    
    const copyLink = () => {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    
    const shareLink = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join NimAgent',
            text: 'Use my referral link to join NimAgent!',
            url: referralLink,
          });
        } catch (err) {
          copyLink();
        }
      } else {
        copyLink();
      }
    };
    
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-700 dark:text-green-400">
              <path d="M9 12l2 2 4-4" />
              <path d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">Your Referral Link</p>
            <p className="text-[10px] text-gray-500 dark:text-white/55 font-mono uppercase">
              {referralCount} REFERRAL{referralCount !== 1 ? 'S' : ''}
            </p>
          </div>
        </div>
        
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 mb-3">
          <p className="text-[11px] text-gray-600 dark:text-white/60 font-mono break-all">
            {referralLink}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className={`flex-1 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              copied 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white'
            }`}
          >
            {copied ? (
              <>
                <Icon name="check" size={14} />
                Copied!
              </>
            ) : (
              <>
                <Icon name="copy" size={14} />
                Copy Link
              </>
            )}
          </button>
          <button
            onClick={shareLink}
            className="rounded-xl py-2.5 px-4 text-sm font-semibold bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white/80 border border-gray-300 dark:border-white/20 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
          >
            <Icon name="share" size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Handle Leaderboard
  if (action.type === 'leaderboard') {
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-700 dark:text-purple-400">
              <path d="M6 9H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2v-9a2 2 0 00-2-2h-2" />
              <path d="M9 22V9a3 3 0 016 0v13" />
              <path d="M12 12l-1.5 2.5 1.5 2.5L15 17" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">Referral Leaderboard</p>
            <p className="text-[10px] text-gray-500 dark:text-white/55 font-mono uppercase">
              TOP REFERRERS
            </p>
          </div>
        </div>
        
        {leaderboardLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-300 dark:border-purple-800 border-t-purple-700 dark:border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-white/65 mb-1">No referrals yet</p>
            <p className="text-xs text-gray-500 dark:text-white/55">Be the first to refer friends!</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 mt-2">
              * Referrals count only after $1000 spend
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, idx) => {
              const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                >
                  <span className="text-lg font-bold w-6 text-center">{rankEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                      {entry.wallet_address?.substring(0, 8)}...{entry.wallet_address?.substring(entry.wallet_address.length - 6)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-700 dark:text-white/80">
                      {entry.total_qualified || entry.referrals || 0}
                    </span>
                    {(entry.total_referrals || entry.total) && (entry.total_referrals || entry.total) > (entry.total_qualified || entry.referrals || 0) && (
                      <span className="text-[10px] text-gray-500 dark:text-white/55 ml-1">
                        /{entry.total_referrals || entry.total}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-gray-400 dark:text-white/40 text-center pt-1">
              * Qualified referrals shown (after $1000 spend)
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filter out action types that don't need an action card UI
  const NON_CARD_ACTIONS = ['save-address', 'save-contact', 'update-contact', 'delete-contact', 'lookup-contact'];
  if (NON_CARD_ACTIONS.includes(action.type)) {
    return null; // Don't render anything for these actions
  }

  // Handle QR Code display
  if (action.type === 'qr-code' && action.address) {
    const nimAmount = action.amountLuna ? action.amountLuna / 100000 : undefined;
    return <QRCodeDisplay address={action.address} amount={nimAmount} message={action.message} />;
  }

  // Handle QR Code scanning
  if (action.type === 'qr-scan') {
    return <QRScanner />;
  }

  // Handle Balance display
  if (action.type === 'balance') {
    return <BalanceDisplay walletAddress={wallet.address || ''} />;
  }

  if (action.type === 'support') {
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-brand-blue/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-700 dark:text-brand-blue-light">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">Get Support</p>
            <p className="text-[10px] font-mono text-gray-500 dark:text-white/55">HELP · FEEDBACK · BUG REPORT</p>
          </div>
        </div>
        <div className="space-y-2 mb-3">
          {SOCIAL_LINKS.map((social) => (
            social.href ? (
              <button
                key={social.label}
                type="button"
                onClick={() => openExternalUrl(social.href!)}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-brand-blue/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={social.icon} alt={social.label} width={20} height={20} className="object-contain flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{social.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/55">{social.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-100 dark:bg-brand-blue/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-brand-blue-light flex-shrink-0">
                    Live
                  </span>
                </div>
              </button>
            ) : (
              <div
                key={social.label}
                className="w-full rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={social.icon} alt={social.label} width={20} height={20} className="object-contain flex-shrink-0 grayscale" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{social.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/55">{social.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-gray-200 dark:bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-white/45 flex-shrink-0">
                    Soon
                  </span>
                </div>
              </div>
            )
          ))}
        </div>
        {action.formUrl ? (
          <button
            type="button"
            onClick={() => openExternalUrl(action.formUrl!)}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 dark:bg-brand-blue text-white font-semibold hover:bg-blue-700 dark:hover:bg-brand-blue/90 transition-colors flex items-center justify-center gap-2"
          >
            Open Support Form
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15,3 21,3 21,9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        ) : (
          <p className="text-sm text-gray-600 dark:text-white/65">Support form coming soon! Please check back later.</p>
        )}
      </div>
    );
  }

  // Handle Show Contacts - display saved addresses
  if (action.type === 'show-contacts' || action.type === 'list-contacts') {
    return (
      <div className="bg-white dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-3 sm:p-4 w-full max-w-full sm:max-w-sm space-y-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700 dark:text-brand-blue-light">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">Saved Contacts</p>
            <p className="text-[10px] text-gray-600 dark:text-white/55 font-mono">
              {loadingContacts ? 'LOADING...' : `${savedContacts.length} CONTACT${savedContacts.length !== 1 ? 'S' : ''}`}
            </p>
          </div>
        </div>

        {loadingContacts ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-300 dark:border-brand-blue/30 border-t-blue-700 dark:border-t-brand-blue-light rounded-full animate-spin" />
          </div>
        ) : savedContacts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-white/65 mb-1">No saved contacts yet</p>
            <p className="text-xs text-gray-500 dark:text-white/45">
              Save addresses by saying "Save [address] as [name]"
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {savedContacts.map((contact) => {
              // Validate address for display
              const normalizedAddr = contact.recipient_address?.replace(/\s/g, '').toUpperCase() || '';
              const isValidAddr = /^NQ[0-9A-Z]{34}$/.test(normalizedAddr); // NQ + 34 chars = 36 total
              
              return (
              <div
                key={contact.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {contact.nickname}
                    </p>
                    {!isValidAddr && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                        INVALID
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs font-mono text-gray-600 dark:text-white/65 break-all">
                    {contact.recipient_address}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
                    {isValidAddr ? (
                      contact.usage_count > 0 
                        ? `Used ${contact.usage_count} time${contact.usage_count !== 1 ? 's' : ''}`
                        : 'Never used'
                    ) : (
                      `⚠️ Invalid address (${normalizedAddr.length} chars, expected 36)`
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Validate address before sending
                    if (!contact.recipient_address) {
                      addMessage({
                        role: 'ai',
                        content: `❌ Error: Contact "${contact.nickname}" has no address saved. Please update or delete this contact.`,
                      });
                      return;
                    }
                    
                    // Normalize address (remove spaces, uppercase)
                    const normalizedAddress = contact.recipient_address.replace(/\s/g, '').toUpperCase();
                    
                    // Validate format (NQ + 34 alphanumeric = 36 total)
                    if (!/^NQ[0-9A-Z]{34}$/.test(normalizedAddress)) {
                      addMessage({
                        role: 'ai',
                        content: `❌ Error: Contact "${contact.nickname}" has an invalid address format.\n\nAddress: ${contact.recipient_address}\nNormalized: ${normalizedAddress}\nLength: ${normalizedAddress.length} chars (expected 36)\n\nPlease delete this contact and save it again with a valid Nimiq address.`,
                      });
                      return;
                    }
                    
                    // Send message with FULL address so AI can immediately create send action
                    const userMessage = `Send NIM to ${contact.nickname} at address ${contact.recipient_address}`;
                    // Send to AI to process (this will add the user message automatically)
                    sendMessageToAI(userMessage, wallet.address || undefined, { bypassRateLimit: true });
                  }}
                  disabled={!isValidAddr}
                  className="w-full sm:w-auto sm:ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-gold/10 text-amber-700 dark:text-gold border-2 border-amber-300 dark:border-gold/20 hover:bg-amber-200 dark:hover:bg-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:opacity-0 sm:group-hover:opacity-100"
                >
                  {isValidAddr ? 'Send' : 'Invalid'}
                </button>
              </div>
            );
          })}
          </div>
        )}
      </div>
    );
  }

  const executeAction = async () => {
    // Prevent duplicate concurrent calls
    if (isExecutingRef.current) {
      return;
    }
    isExecutingRef.current = true;
    
    // Prevent retry if card is already failed or completed
    if (failed) {
      addMessage({
        role: 'ai',
        content: '❌ This transaction has failed and is locked.\n\nPlease start a new request instead of retrying. If your payment was deducted, our team will process your refund within 24 hours.',
      });
      return;
    }
    
    if (success) {
      addMessage({
        role: 'ai',
        content: '✅ This transaction is already complete. No need to retry.',
      });
      return;
    }
    
    if (!wallet.address) {
      addMessage({
        role: 'ai',
        content: 'Please connect your wallet first to complete this action.',
      });
      return;
    }

    // Check Nimiq Pay consensus before attempting any payment.
    // If the wallet is still syncing, block the payment and tell the user.
    if (action.type === 'send' || action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill') {
      try {
        const { getNimiqNetworkState } = await import('@/lib/wallet');
        const networkState = await getNimiqNetworkState();
        if (!networkState.consensusEstablished) {
          addMessage({
            role: 'ai',
            content: '⏳ Nimiq Pay is still syncing with the Nimiq network.\n\nPayments are paused until sync is complete. Please wait a moment and try again. If this persists, check your internet connection.',
          });
          return;
        }
      } catch {
        // If we can't check consensus, proceed anyway — the wallet will reject if truly not synced
      }
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
    // which includes the 0.5% markup (volatility buffer + service fee). For simple sends, calculate from user input.
    const amountLuna = (action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill')
      ? (action.amountLuna || Math.round(nimAmount * 100000))
      : Math.round(nimAmount * 100000);
    
    setLoading(true);

    try {
      if (action.type === 'send') {
        // Defense-in-depth: Check balance again in case it changed between mount and tap
        if (prevalidationError) {
          addMessage({
            role: 'ai',
            content: `Cannot send this amount: ${prevalidationError}`,
          });
          setLoading(false);
          return;
        }
        
        // Validate recipient address
        if (!action.recipient) {
          addMessage({
            role: 'ai',
            content: '❌ Error: No recipient address provided. Please try again with a valid Nimiq address.',
          });
          setLoading(false);
          return;
        }
        
        // Normalize address (remove spaces)
        const normalizedRecipient = action.recipient.replace(/\s/g, '');
        
        // Basic validation
        if (normalizedRecipient.length < 36 || !normalizedRecipient.startsWith('NQ')) {
          addMessage({
            role: 'ai',
            content: '❌ Error: Invalid recipient address format. Nimiq addresses must start with "NQ" and be properly formatted.',
          });
          setLoading(false);
          return;
        }
        
        // Send NIM transaction
        const hash = await requestPayment(
          normalizedRecipient,
          amountLuna,
          'NimAgent-send',
          'direct',
          wallet.address // Pass wallet address to skip address selection
        );

        // The on-chain send succeeded. This is real and irreversible —
        // reflect that to the user regardless of what happens next.
        setSuccess(true);
        setTxHash(hash);
        setAmountLocked(true); // Lock after successful transaction
        
        // Update action in store to persist completion state
        if (messageIndex >= 0) {
          await updateActionState(messageIndex, {
            completed: true,
            txHash: hash
          });
        }
        
        const explorerUrl = `https://nimiq.watch/#${hash}`;
        
        addMessage({
          role: 'ai',
          content: `Payment sent successfully! 🎉\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}`,
        });

        // Recording is now a separate, retryable concern — never let its
        // failure undo the success message above.
        const syncId = enqueuePendingSync({
          kind: 'send',
          txHash: hash,
          payload: {
            type: 'send',
            fromAddress: wallet.address,
            toAddress: normalizedRecipient,
            amountLuna,
            txHash: hash,
            status: 'completed',
          },
        });

        try {
          await recordTransaction({
            type: 'send',
            fromAddress: wallet.address,
            toAddress: normalizedRecipient,
            amountLuna,
            txHash: hash,
            status: 'completed',
          });
          removePendingSync(syncId);
        } catch (syncErr) {
          console.error('[Sync] Failed to record transaction, will retry later:', syncErr);
          // Do NOT setFailed/setAmountLocked here, do NOT throw — the payment
          // already succeeded. Leave it in the queue for background retry.
        }

        // Ask if user wants to save this address (after a short delay)
        setTimeout(async () => {
          // Check if wallet is connected
          if (!wallet.address) return;
          
          // Check if this address is already saved
          const { getSavedAddresses } = await import('@/lib/api-client');
          const contacts = await getSavedAddresses(wallet.address || '');
          const alreadySaved = contacts.some(c => c.recipient_address.replace(/\s/g, '').toUpperCase() === normalizedRecipient.toUpperCase());
          
          if (!alreadySaved) {
            addMessage({
              role: 'ai',
              content: `Would you like to save this address for future use?\n\nAddress: ${normalizedRecipient.substring(0, 10)}...${normalizedRecipient.substring(normalizedRecipient.length - 6)}\n\nJust say "Save this as [name]" (e.g., "Save this as Coffee Shop")`,
            });
          }
        }, 1500);

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
        const serviceAddress = process.env.NEXT_PUBLIC_SERVICE_ADDRESS || action.recipient || 'NQ18 TAQ8 CL7P K505 LE2M C78A 1YQC 1CH1 6Y4G';
        
        const hash = await requestPayment(
          serviceAddress,
          amountLuna,
          `NimAgent-${action.type}`,
          action.type,
          wallet.address // Pass wallet address to skip address selection
        );

        // Let the user know we're confirming the payment on-chain before
        // releasing the gift card code / airtime / bill payment.
        addMessage({
          role: 'ai',
          content: 'Payment sent. Confirming it on the Nimiq network before releasing your order — this can take a few seconds…',
        });

        // Queue the order for retry in case createOrder fails to reach the backend
        const syncId = enqueuePendingSync({
          kind: 'order',
          txHash: hash,
          payload: {
            type: action.type,
            txHash: hash,
            amountLuna,
            details: { ...action, recipientEmail: email || undefined },
            walletAddress: wallet.address,
            quoteId: quoteId || undefined,
          },
        });

        // Fulfill order (backend verifies the on-chain payment first)
        // Backend now handles async payment verification automatically
        let result: any;
        
        try {
          result = await createOrder({
            type: action.type,
            txHash: hash,
            amountLuna,
            details: { ...action, recipientEmail: email || undefined },
            walletAddress: wallet.address,
            quoteId: quoteId || undefined,
          });
          
          // Successfully reached backend - remove from queue
          removePendingSync(syncId);
        } catch (err: any) {
          // createOrder() failed to reach the backend at all — the ONLY case
          // this specific catch should handle. The order was never recorded.
          console.error('[Sync] createOrder failed to record, will retry later:', err);
          setSuccess(true); // we know the on-chain send succeeded
          setTxHash(hash);
          setAmountLocked(true);
          addMessage({
            role: 'ai',
            content: `Payment sent (TX: ${hash.slice(0, 8)}…${hash.slice(-6)}) but we couldn't reach our servers to process your order just now. We'll keep retrying automatically — check History in a few minutes. If it doesn't appear, contact support with this transaction hash.`,
          });
          setLoading(false);
          return; // do not fall through to the generic catch/failed state below
        }

        // Everything below is now OUTSIDE that catch, so a pollOrderStatus
        // failure falls through to the existing, more accurate handling
        // (the outer catch block further down / result.locked/refundNeeded
        // logic) instead of being swallowed by the "couldn't reach servers"
        // message above.
        if (result.pending && result.orderId) {
          // Update user that payment is being confirmed
          addMessage({
            role: 'ai',
            content: '⏳ Confirming your payment on the blockchain... This usually takes 10-30 seconds. Please wait.',
          });
          
          // Poll for order completion
          const finalStatus = await pollOrderStatus(result.orderId, {
            maxAttempts: 30,  // 30 * 4s = 2 minutes max
            intervalMs: 4000,  // Poll every 4 seconds
            onStatusChange: (status, message) => {
              // Log status changes for debugging
              console.log(`[Order ${result.orderId}] Status: ${status} - ${message}`);
              
              // Optional: Update UI with intermediate states
              if (status === 'pending') {
                // Payment confirmed, now fulfilling order
                addMessage({
                  role: 'ai',
                  content: '✓ Payment confirmed! Processing your order...',
                });
              }
            },
          });
          
          // Update result with final status
          if (finalStatus.success) {
            result = {
              success: true,
              ...finalStatus.result,
            };
          } else {
            throw new Error(finalStatus.error || 'Order fulfillment failed');
            // this now propagates to the ORIGINAL outer catch further down in
            // executeAction (the one that already existed before this fix,
            // handling result.locked/refundNeeded and generic order failures
            // with proper refund messaging) — do not add a new catch here.
          }
        }

        if (result.success) {
          setSuccess(true);
          setTxHash(hash);
          setAmountLocked(true); // Lock after successful transaction

          // Refresh balance immediately — NIM was just spent
          fetchBalance();
          
          // Update action in store to persist completion state
          if (messageIndex >= 0) {
            await updateActionState(messageIndex, {
              completed: true,
              txHash: hash
            });
          }
          
          const explorerUrl = `https://nimiq.watch/#${hash}`;

          if (action.type === 'gift-card' && result.code) {
            let msg = `Here's your ${action.product} gift card! 🎁\n\n🎟️ Code: ${result.code}`;
            if (result.pin) msg += `\n🔐 PIN: ${result.pin}`;
            if (result.serialNumber) msg += `\n#️⃣ Serial: ${result.serialNumber}`;
            if (result.instructionLink) msg += `\n📖 Instructions: ${result.instructionLink}`;
            if (email) msg += `\n📧 To: ${email}`;
            msg += `\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}\n\n⚠️ Keep this safe — it won't be shown again.`;
            // Persist fulfillment data on the action so it stays in history
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                completed: true,
                txHash: hash,
                fulfillmentData: { code: result.code, pin: result.pin, serialNumber: result.serialNumber },
              });
            }
            addMessage({ role: 'ai', content: msg });
          } else if (action.type === 'gift-card') {
            // Code not in immediate response — delivered via email or async
            let msg = `${action.product} gift card order placed! 🎁`;
            if (result.reloadlyTransactionId) msg += `\nOrder ID: ${result.reloadlyTransactionId}`;
            if (email) msg += `\n📧 Code will be sent to: ${email}`;
            else msg += `\n\nℹ️ The redemption code wasn't returned immediately. Check your order history in a few minutes — it will appear there once Reloadly processes it.`;
            if (result.sandboxNote) msg += `\n\nℹ️ ${result.sandboxNote}`;
            msg += `\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}`;
            addMessage({ role: 'ai', content: msg });
          } else if (action.type === 'airtime') {
            let airtimeMsg = `Airtime sent! 📱\n\n${result.operatorName || action.operator} to ${action.phone}`;
            if (result.deliveredAmount && result.deliveredAmountCurrency) {
              airtimeMsg += `\n💰 Delivered: ${result.deliveredAmount} ${result.deliveredAmountCurrency}`;
            }
            if (result.pin) {
              airtimeMsg += `\n\n🔑 PIN: ${result.pin}`;
              if (result.pinSerial) airtimeMsg += `\n# Serial: ${result.pinSerial}`;
              airtimeMsg += `\n\n⚠️ Enter this PIN to load your credit.`;
            }
            airtimeMsg += `\nRef: ${result.reference}\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}`;
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                completed: true,
                txHash: hash,
                fulfillmentData: {
                  reference: result.reference,
                  operatorName: result.operatorName,
                  deliveredAmount: result.deliveredAmount,
                  deliveredAmountCurrency: result.deliveredAmountCurrency,
                  pin: result.pin,
                  pinSerial: result.pinSerial,
                  reloadlyTransactionId: result.reloadlyTransactionId,
                },
              });
            }
            addMessage({ role: 'ai', content: airtimeMsg });
          } else if (action.type === 'bill') {
            let billMsg = `Bill paid! 🧾\n\n${action.service} payment of ${CURRENCY_SYMBOLS[action.currency || 'USD']}${action.fiatAmount}`;
            if (result.token) {
              billMsg += `\n\n⚡ Meter Token: ${result.token}`;
              if (result.tokenInfo1) billMsg += `\nℹ️ ${result.tokenInfo1}`;
              if (result.tokenInfo2) billMsg += `\nℹ️ ${result.tokenInfo2}`;
              billMsg += `\n\n⚠️ Enter this token on your meter to load credit.`;
            }
            if (result.deliveryAmount) {
              billMsg += `\n\n🔋 Units: ${result.deliveryAmount} ${result.deliveryAmountCurrency || ''}`.trim();
            }
            billMsg += `\nRef: ${result.reference}\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}`;
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                completed: true,
                txHash: hash,
                fulfillmentData: {
                  reference: result.reference,
                  token: result.token,
                  tokenInfo1: result.tokenInfo1,
                  deliveryAmount: result.deliveryAmount,
                  deliveryAmountCurrency: result.deliveryAmountCurrency,
                  billerName: result.billerName,
                  serviceType: result.serviceType,
                  reloadlyTransactionId: result.reloadlyTransactionId,
                },
              });
            }
            addMessage({ role: 'ai', content: billMsg });
          }
        } else {
          // Backend returned failure - check if it's a locked/failed order
          if (result.locked || result.refundNeeded) {
            // This is a failed order that's locked - don't retry
            setFailed(true);
            setAmountLocked(true);
            
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                failed: true
              });
            }
            
            addMessage({
              role: 'ai',
              content: `❌ Order Failed (Locked)\n\n${result.message || result.error}\n\nYour transaction hash: ${hash}\n\n⚠️ Do not retry - a refund will be processed within 24 hours.`,
            });
          } else {
            throw new Error(result.error || 'Order fulfillment failed');
          }
        }
      }
    } catch (error: any) {
      
      // Mark as failed and lock the card
      setFailed(true);
      setAmountLocked(true);
      
      // Update action in store to persist failed state
      if (messageIndex >= 0) {
        await updateActionState(messageIndex, {
          failed: true
        });
      }
      
      // Provide more specific error messages
      let errorMessage = '';
      
      // Handle quote expiry specifically
      if (error.message?.includes('Quote has expired')) {
        errorMessage = '⏱️ Quote Expired\n\nThe price quote expired before payment was completed. Please refresh the quote and try again with updated pricing.';
      }
      // Handle user cancellation
      else if (error.message?.includes('User closed') || error.message?.includes('cancelled')) {
        errorMessage = '❌ Transaction Cancelled\n\nYou cancelled the transaction. No funds were deducted.';
        // Don't mark as failed for user cancellation
        setFailed(false);
        setAmountLocked(false);
        if (messageIndex >= 0) {
          await updateActionState(messageIndex, {
            failed: false
          });
        }
      }
      // Handle timeout
      else if (error.message?.includes('timeout')) {
        errorMessage = '⏱️ Timeout\n\nThe wallet took too long to respond. Please try again.';
      }
      // Handle unsupported browser context
      else if (error.message?.includes('popup') || error.message?.includes('only inside the Nimiq Pay app')) {
        errorMessage = '🚫 Nimiq Pay Required\n\nOpen NimAgent inside the Nimiq Pay app and try again.';
      }
      // Handle wallet/network sync state — do NOT lock the card, just let user retry
      else if (error.message?.includes('syncing with the Nimiq network')) {
        errorMessage = '⏳ Wallet Syncing\n\nNimiq Pay is still establishing consensus with the Nimiq network. Wait a moment and tap Send again — no funds were deducted.';
        // Don't lock the card — this is a transient state, not a payment failure
        setFailed(false);
        setAmountLocked(action.locked ?? false);
        if (messageIndex >= 0) {
          await updateActionState(messageIndex, { failed: false });
        }
      }
      // Handle locked order from backend
      else if (error.message?.includes('locked') || error.message?.includes('already failed')) {
        errorMessage = `❌ Order Locked\n\n${error.message}\n\n⚠️ This transaction is locked. Do not retry. If your payment was deducted, a refund will be processed within 24 hours.`;
      }
      // Generic error - different message depending on action type
      else {
        if (action.type === 'send') {
          // For simple NIM sends, don't mention refunds or service wallet stuff
          errorMessage = `❌ Payment Failed\n\n${error.message || 'Something went wrong. Please try again.'}`;
        } else {
          // For service orders (gift-card, airtime, bill), keep the original message
          errorMessage = `❌ Payment Failed\n\n${error.message || 'Something went wrong. Please try again.'}\n\nIf funds were deducted, our team will investigate and process a refund if needed.`;
        }
      }
      
      addMessage({
        role: 'ai',
        content: errorMessage,
      });
    } finally {
      setLoading(false);
      isExecutingRef.current = false;
    }
  };

  return (
    <div className="glass dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 space-y-3 max-w-sm">
      {/* Action Details */}
      {action.type === 'send' && (
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-white/65 text-sm font-medium">To</span>
          <span className="text-gray-900 dark:text-white font-mono text-xs">{action.recipient?.substring(0, 14)}...</span>
        </div>
      )}

      {/* Payment request lock banner — shown when receiver set a fixed amount */}
      {isPaymentRequest && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 dark:bg-gold/10 border border-amber-300 dark:border-gold/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-gold flex-shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p className="text-xs text-amber-700 dark:text-gold font-medium leading-snug">
            Amount fixed by requester{action.message ? ` · ${action.message}` : ''} — cannot be changed
          </p>
        </div>
      )}

      {action.type === 'gift-card' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Product</span>
            <span className="text-gray-900 dark:text-white font-semibold">{action.product}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Value</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {/* Show available denominations from catalog — display only, not selectable */}
          {availableAmounts && availableAmounts.length > 0 && !success && (
            <div className="space-y-1">
              <p className="text-gray-500 dark:text-white/55 text-[10px] font-medium uppercase tracking-wider">Available amounts</p>
              <div className="flex flex-wrap gap-1.5">
                {availableAmounts.map(a => (
                  <span
                    key={a}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded select-none ${
                      Number(action.fiatAmount) === a
                        ? 'bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold/90 ring-1 ring-amber-300 dark:ring-gold/30'
                        : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/55'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[action.currency || 'USD']}{a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {amountRange && !availableAmounts && !success && (
            <p className="text-gray-500 dark:text-white/55 text-[10px]">
              Range: {CURRENCY_SYMBOLS[amountRange.currency]}{amountRange.min} – {CURRENCY_SYMBOLS[amountRange.currency]}{amountRange.max}
            </p>
          )}
          <div className="space-y-1">
            <label className="text-gray-600 dark:text-white/65 text-xs font-medium">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm placeholder-gray-500 dark:placeholder-white/25 outline-none focus:border-amber-500 dark:focus:border-gold/50 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-gold/20"
            />
            <p className="text-gray-500 dark:text-white/45 text-xs">We'll send the gift card code to this email</p>
          </div>
        </>
      )}

      {action.type === 'airtime' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Phone</span>
            <span className="text-gray-900 dark:text-white font-semibold">{action.phone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Operator</span>
            <span className="text-gray-900 dark:text-white font-semibold">{action.operator}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Amount</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {amountRange && !success && (
            <p className="text-gray-500 dark:text-white/55 text-[10px]">
              Valid range: {amountRange.currency} {amountRange.min} – {amountRange.max}
            </p>
          )}
        </>
      )}

      {action.type === 'bill' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Service</span>
            <span className="text-gray-900 dark:text-white font-semibold">{action.service}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Account</span>
            <span className="text-gray-900 dark:text-white font-mono text-xs">{action.accountNumber}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-white/65 text-sm font-medium">Amount</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {!success && !failed && (
            <div className="space-y-2 rounded-xl border-2 border-amber-300 dark:border-gold/20 bg-amber-50 dark:bg-gold/10 p-3">
              <p className="text-xs leading-relaxed text-amber-800 dark:text-gold/90">
                Reloadly does not return the subscriber name before payment for this flow. Please confirm the service and account or meter number manually before paying.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billAccountConfirmed}
                  onChange={(e) => setBillAccountConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-white/20 dark:bg-white/5 dark:focus:ring-gold"
                />
                <span className="text-xs leading-relaxed text-gray-700 dark:text-white/75">
                  I confirm this account or meter number is correct and belongs to the person or service I want to pay.
                </span>
              </label>
            </div>
          )}
        </>
      )}

      {/* Amount Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-gray-600 dark:text-white/65 text-xs font-medium">Amount to pay</label>
          {isOrder && !success && quoteExpiry && (
            <button
              onClick={refreshQuote}
              disabled={refreshing || loading}
              className="text-xs text-amber-700 dark:text-gold/70 hover:text-amber-800 dark:hover:text-gold font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 border-2 ${failed ? 'border-red-500 dark:border-error/50' : 'border-gray-200 dark:border-white/10'} ${amountLocked ? 'opacity-75' : 'focus-within:border-amber-500 dark:focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-amber-500/20 dark:focus-within:ring-gold/20'}`}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            disabled={loading || success || failed || amountLocked}
            readOnly={amountLocked}
            className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm outline-none disabled:cursor-not-allowed placeholder-gray-500 dark:placeholder-white/40"
          />
          <span className="text-gray-700 dark:text-white/65 text-sm font-bold">NIM</span>
        </div>
        {isOrder && !success && quoteExpiry && timeRemaining > 0 && (
          <p className={`text-xs ${timeRemaining <= 10 ? 'text-orange-600 dark:text-warning animate-pulse font-semibold' : 'text-gray-600 dark:text-white/55'} text-right`}>
            Quote expires in {timeRemaining}s
          </p>
        )}
      </div>

      {/* Price change alert */}
      {priceChanged && !success && isOrder && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-100 dark:bg-warning/10 border-2 border-orange-300 dark:border-warning/20 p-2.5">
          <span className="text-orange-600 dark:text-warning mt-0.5">⚠️</span>
          <p className="text-orange-700 dark:text-warning text-xs leading-relaxed font-medium">
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
        disabled={loading || success || failed || !amount || parseFloat(amount) <= 0 || !!prevalidationError || (action.type === 'bill' && !billAccountConfirmed)}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          success
            ? 'bg-success/10 text-success cursor-default border border-success/20'
            : failed
            ? 'bg-error/10 text-error cursor-default border border-error/20'
            : 'btn-gold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {loading ? 'Processing...' : success ? '✓ Payment Complete!' : failed ? '✗ Transaction Failed' : 'Confirm & Pay'}
      </button>
      {action.type === 'bill' && !billAccountConfirmed && !success && !failed && (
        <p className="text-xs text-amber-700 dark:text-gold/80 text-center">
          Confirm the account details above to continue.
        </p>
      )}
      
      {success && txHash && (
        <p className="text-xs text-success text-center">
          Transaction recorded. Check History tab to view details.
        </p>
      )}
      
      {failed && (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-error">Transaction Failed</p>
          <p className="text-[11px] text-error/80 mt-0.5">
            This request is locked. Ask the AI to start a new payment request.
          </p>
        </div>
      )}
    </div>
  );
}
