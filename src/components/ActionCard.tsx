'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { openExternalUrl } from '@/lib/external-links';
import { SOCIAL_LINKS } from '@/lib/social-links';
import { requestPayment, prewarmHub } from '@/lib/wallet';
import { recordTransaction, createOrder, validateOrder, pollOrderStatus, getLeaderboard } from '@/lib/api-client';
import { enqueuePendingSync, removePendingSync, isTxHashPending, findPendingByActionDetails } from '@/lib/pending-sync-queue';
import { copyToClipboard } from '@/lib/clipboard';
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
  // Track if this action is already being processed (prevents double-submission)
  const [isAlreadyProcessing, setIsAlreadyProcessing] = useState(false);
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
  
  // Payment method selection (Phase 3: Cryptorefills integration)
  const [paymentMethod, setPaymentMethod] = useState<'nim' | 'usdt-polygon'>(
    action.paymentMethod || 'nim'
  );
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [paymentMethodsAvailable, setPaymentMethodsAvailable] = useState<any[]>([]);
  
  // USDT price quote state (for payment method switching)
  const [usdtQuoteLoading, setUsdtQuoteLoading] = useState(false);
  const [usdtQuoteError, setUsdtQuoteError] = useState<string | null>(null);
  const nimAmountRef = useRef<string>(amount); // Store original NIM amount
  const [cryptoAmount, setCryptoAmount] = useState<string | null>(null); // Store USDT amount
  
  // Browse catalog hooks (must be declared before any conditional returns)
  const [catalogLoading, setCatalogLoading] = useState(!action.catalogData);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Check if payment method is locked (AI explicitly chose one)
  const isPaymentMethodLocked = !!action.paymentMethod;
  
  // Pre-validation state — done BEFORE the user clicks Pay so the wallet
  // popup isn't blocked by a network request inside the click handler.
  const isOrder = action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill';
  // Lock immediately for orders (server-priced), AND for payment requests where
  // the receiver has specified a fixed amount the sender must not change.
  const isPaymentRequest = action.type === 'send' && !!action.locked && !!action.amountLuna;
  
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
  
  // Fetch available payment methods (Phase 3: Cryptorefills)
  useEffect(() => {
    if (isOrder && !success && !failed) {
      // If AI explicitly set paymentMethod, don't show selector (use that method only)
      if (isPaymentMethodLocked) {
        setShowPaymentMethodSelector(false);
        return;
      }
      
      // Check if crypto payments are available
      import('@/lib/api-client').then(({ getPaymentMethods }) => {
        getPaymentMethods()
          .then((methods) => {
            if (methods && methods.length > 0) {
              setPaymentMethodsAvailable(methods);
              // Only show selector if USDT-Polygon is available
              const hasUSDT = methods.some(m => m.currency === 'USDT' && m.network === 'Polygon');
              setShowPaymentMethodSelector(hasUSDT);
            }
          })
          .catch(() => {
            // Silent failure - payment methods not available
          });
      });
    }
  }, [isOrder, success, failed, isPaymentMethodLocked]);
  
  // Find the index of this message in the messages array (needed by catalog lookup effect)
  const messageIndex = messages.findIndex(msg => msg.action?.id === action.id);
  
  // Catalog lookup effect - fetch brands for validation
  useEffect(() => {
    const fetchCatalogBrands = async () => {
      if (action.type !== 'catalog-lookup') return;
      if (action.catalogBrands) return; // Already fetched

      try {
        setCatalogLoading(true);
        setCatalogError(null);

        const response = await fetch(
          `/api/cryptorefills/catalog/brands/${action.countryCode}/${action.productType}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load brands: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load brands');
        }

        // Update action with fetched brands
        if (messageIndex >= 0) {
          await updateActionState(messageIndex, {
            catalogBrands: data.brands,
            catalogCountry: data.country
          });
        }

        // Send brands back to AI so it can create the actual action
        const brandNames = data.brands.map((b: any) => b.name).join(', ');
        await sendMessageToAI(
          `Available brands for ${action.productType} in ${data.country}: ${brandNames}. User requested: "${action.userIntent}"`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load catalog';
        setCatalogError(errorMsg);
        await sendMessageToAI(
          `Error loading catalog for ${action.productType} in ${action.countryCode}: ${errorMsg}`
        );
      } finally {
        setCatalogLoading(false);
      }
    };

    fetchCatalogBrands();
  }, [action.type, action.catalogBrands, action.countryCode, action.productType, action.userIntent, messageIndex, sendMessageToAI, updateActionState]);
  
  // Other state declarations
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

  // Unified quote refresh function - respects payment method
  const refreshCurrentQuote = async () => {
    // Skip refresh for locked actions - they already have final validated amounts
    if (!isOrder || success || failed || loading || amountLocked) return;
    
    setRefreshing(true);
    setPriceChanged(false);
    
    try {
      if (paymentMethod === 'usdt-polygon') {
        // USDT quote refresh
        const { getCryptoPriceQuote } = await import('@/lib/api-client');
        const quote = await getCryptoPriceQuote(action.type, action, wallet.address || '');
        
        if (quote.valid && quote.cryptoAmount) {
          const oldAmount = parseFloat(amount) || 0;
          const newAmount = parseFloat(quote.cryptoAmount);
          
          // Check if price changed significantly (>2%)
          if (oldAmount > 0 && Math.abs((newAmount - oldAmount) / oldAmount) > 0.02) {
            setPriceChanged(true);
          }
          
          const cryptoAmountStr = String(quote.cryptoAmount);
          setCryptoAmount(cryptoAmountStr);
          setAmount(cryptoAmountStr);
          setUsdtQuoteError(null);
          
          // Set expiry (default 60 seconds)
          setQuoteExpiry(Date.now() + 60000);
        } else {
          setUsdtQuoteError(quote.error || 'Failed to get USDT price');
        }
      } else {
        // NIM quote refresh
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
      }
    } catch (err) {
      // Silent failure
      console.error('[ActionCard] Quote refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Legacy refreshQuote - now just calls refreshCurrentQuote
  const refreshQuote = refreshCurrentQuote;

  // Countdown timer for quote expiry
  // Auto-refreshes using refreshCurrentQuote which respects payment method
  // SKIP for locked actions - they don't need quote refresh
  useEffect(() => {
    if (!isOrder || !quoteExpiry || success || failed || loading || amountLocked) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((quoteExpiry - Date.now()) / 1000));
      setTimeRemaining(remaining);
      
      // Auto-refresh when quote expires (uses unified refreshCurrentQuote)
      if (remaining === 0) {
        refreshCurrentQuote();
      }
      
      // Warn user when less than 10 seconds
      if (remaining <= 10 && remaining > 0 && !priceChanged) {
        setPriceChanged(true);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [quoteExpiry, success, failed, loading, isOrder, paymentMethod, amountLocked]); // eslint-disable-line react-hooks/exhaustive-deps

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
      
      // Skip all validation for locked actions - they already have final amounts
      // BUT only skip if they ALSO have a quoteId (meaning they were already validated)
      if (amountLocked && quoteId) {
        return () => { cancelled = true; };
      }
      
      // Only validate NIM orders at mount if payment method is NIM
      // For USDT, let the USDT-quote effect handle it
      if (paymentMethod === 'usdt-polygon') {
        // Skip NIM validation, USDT effect will handle quote
        return () => { cancelled = true; };
      }
      
      validateOrder({ type: action.type, details: action, walletAddress: wallet.address || undefined })
        .then((validation) => {
          if (cancelled) return;
          if (validation.valid) {
            if (validation.productId) action.productId = validation.productId;
            if (validation.operatorId) action.operatorId = validation.operatorId;
            if (validation.billerId) action.billerId = validation.billerId;
            
            // CRITICAL FIX: Always set quoteId when received from validation
            if (validation.quoteId) {
              console.log('[Validation] Quote received:', validation.quoteId);
              setQuoteId(validation.quoteId);
            } else {
              console.warn('[Validation] No quoteId in validation response!');
            }
            
            if (typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
              action.amountLuna = validation.amountLuna;
              // Only set amount if payment method is NIM
              if (paymentMethod === 'nim') {
                setAmount((validation.amountLuna / 100000).toFixed(2));
                setLastKnownAmount(validation.amountLuna / 100000);
              }
              
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
            // But only for NIM payment method
            if (paymentMethod === 'nim' && typeof validation.amountLuna === 'number' && validation.amountLuna > 0) {
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
  }, [wallet.balance?.nim.balance, wallet.address, paymentMethod, action.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRITICAL: Check if this action is already being processed (prevents double-submission)
  // This runs once on mount to detect if the same transaction is already in the pending sync queue
  useEffect(() => {
    // Only check for order types that could have pending syncs
    if (action.type !== 'gift-card' && action.type !== 'airtime' && action.type !== 'bill' && action.type !== 'send') {
      return;
    }
    
    // Skip if already marked as completed or failed
    if (success || failed) {
      return;
    }
    
    // Check if this specific action is already in the pending sync queue
    const pendingEntry = findPendingByActionDetails(action.type, action);
    
    if (pendingEntry) {
      console.log('[ActionCard] Action already being processed:', action.id, 'txHash:', pendingEntry.txHash);
      setIsAlreadyProcessing(true);
      
      // If we have a txHash from the pending entry, show it to the user
      if (pendingEntry.txHash && !txHash) {
        setTxHash(pendingEntry.txHash);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load catalog data for browse-catalog action type
  useEffect(() => {
    if (action.type === 'browse-catalog' && !action.catalogData && action.countryCode) {
      setCatalogLoading(true);
      setCatalogError(null);
      
      // Use the new catalog API
      import('@/lib/api-client').then(({ getCatalogProducts }) => {
        getCatalogProducts(action.countryCode!)
          .then((data) => {
            // Transform the response to match the expected catalogData structure
            const catalogData = {
              country: data.country,
              productTypes: data.productTypes,
              brands: data.products.reduce((acc, product) => {
                const type = product.productType;
                if (!acc[type]) {
                  acc[type] = [];
                }
                acc[type].push({
                  name: product.brandName,
                  family: product.brandFamily,
                  brandId: product.brandId,
                  category: product.category,
                  min: product.min !== null ? `$${product.min}` : undefined,
                  max: product.max !== null ? `$${product.max}` : undefined,
                  logoUrl: product.logoUrl,
                });
                return acc;
              }, {} as any),
              summary: {
                totalBrands: data.totalProducts,
                byType: data.products.reduce((acc, product) => {
                  acc[product.productType] = (acc[product.productType] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
              },
            };
            
            updateActionState(messageIndex, { catalogData });
            setCatalogError(null);
          })
          .catch((err) => {
            setCatalogError(`Failed to load catalog: ${err.message}`);
          })
          .finally(() => {
            setCatalogLoading(false);
          });
      });
    }
  }, [action.type, action.countryCode, action.catalogData, messageIndex, updateActionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch USDT price quote when payment method changes to usdt-polygon
  useEffect(() => {
    // Only for orders (not send actions)
    if (!isOrder || success || failed) return;
    
    // Skip for locked payment requests (send actions with fixed amounts)
    // BUT allow orders to fetch USDT quotes even if amountLocked = true
    // because "locked" means fiat amount is locked, but we still need crypto quote
    if (amountLocked && action.type === 'send') return;
    
    // Store NIM amount when first mounting or switching FROM USDT back to NIM
    if (paymentMethod === 'nim' && !nimAmountRef.current && amount) {
      nimAmountRef.current = amount;
    }
    
    // Fetch USDT quote when switching to USDT OR when mounting with USDT already selected
    if (paymentMethod === 'usdt-polygon') {
      setUsdtQuoteLoading(true);
      setUsdtQuoteError(null);
      // Clear amount immediately to prevent showing NIM amount with USDT label
      setAmount('');
      
      import('@/lib/api-client').then(({ getCryptoPriceQuote }) => {
        getCryptoPriceQuote(action.type, action, wallet.address || '')
          .then((quote) => {
            if (quote.valid && quote.cryptoAmount) {
              const cryptoAmountStr = String(quote.cryptoAmount);
              setCryptoAmount(cryptoAmountStr);
              setAmount(cryptoAmountStr);
              setUsdtQuoteError(null);
            } else {
              setUsdtQuoteError(quote.error || 'Failed to get USDT price');
              // Keep amount empty if quote failed
              setAmount('');
            }
          })
          .catch((err) => {
            setUsdtQuoteError(err.message || 'Failed to fetch USDT price');
            // Keep amount empty if quote failed
            setAmount('');
          })
          .finally(() => {
            setUsdtQuoteLoading(false);
          });
      });
    } else if (paymentMethod === 'nim') {
      // Switching back to NIM - restore original NIM amount
      if (nimAmountRef.current) {
        setAmount(nimAmountRef.current);
      }
      setCryptoAmount(null);
      setUsdtQuoteError(null);
    }
  }, [paymentMethod, isOrder, success, failed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Referral Link
  if (action.type === 'referral') {
    const referralLink = action.referralLink || '';
    const referralCount = action.referralCount || 0;
    
    const copyLink = async () => {
      const success = await copyToClipboard(referralLink);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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
      <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-700 dark:text-green-400">
              <path d="M9 12l2 2 4-4" />
              <path d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">Your Referral Link</p>
            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 font-mono uppercase">
              {referralCount} REFERRAL{referralCount !== 1 ? 'S' : ''}
            </p>
          </div>
        </div>
        
        <div className="bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10 rounded-xl p-3 mb-3">
          <p className="text-[11px] text-[#1F2348]/70 dark:text-white/70 font-mono break-all">
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
            className="rounded-xl py-2.5 px-4 text-sm font-semibold bg-gray-200 dark:bg-white/10 text-[#1F2348] dark:text-white/80 border border-[#1F2348]/20 dark:border-white/20 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
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
      <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-700 dark:text-purple-400">
              <path d="M6 9H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2v-9a2 2 0 00-2-2h-2" />
              <path d="M9 22V9a3 3 0 016 0v13" />
              <path d="M12 12l-1.5 2.5 1.5 2.5L15 17" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">Referral Leaderboard</p>
            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 font-mono uppercase">
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
            <p className="text-sm text-[#1F2348]/70 dark:text-white/70 mb-1">No referrals yet</p>
            <p className="text-xs text-[#1F2348]/60 dark:text-white/65">Be the first to refer friends!</p>
            <p className="text-[10px] text-gray-400 dark:text-white/60 mt-2">
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
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10"
                >
                  <span className="text-lg font-bold w-6 text-center">{rankEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#1F2348] dark:text-white truncate">
                      {entry.wallet_address?.substring(0, 8)}...{entry.wallet_address?.substring(entry.wallet_address.length - 6)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#1F2348] dark:text-white/80">
                      {entry.total_qualified || entry.referrals || 0}
                    </span>
                    {(entry.total_referrals || entry.total) && (entry.total_referrals || entry.total) > (entry.total_qualified || entry.referrals || 0) && (
                      <span className="text-[10px] text-[#1F2348]/60 dark:text-white/65 ml-1">
                        /{entry.total_referrals || entry.total}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-gray-400 dark:text-white/60 text-center pt-1">
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

  // Handle Browse Catalog - show products by country
  if (action.type === 'browse-catalog') {
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-700 dark:text-purple-400">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">
              {action.catalogData ? action.catalogData.country.name : action.countryCode}
            </p>
            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 font-mono uppercase">
              CRYPTOREFILLS CATALOG
            </p>
          </div>
        </div>

        {catalogLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-300 dark:border-purple-800 border-t-purple-700 dark:border-t-purple-400 rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#1F2348]/70 dark:text-white/70">Loading products...</p>
          </div>
        ) : catalogError ? (
          <div className="text-center py-6">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{catalogError}</p>
          </div>
        ) : action.catalogData ? (
          <div className="space-y-3">
            <div className="bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10 rounded-xl p-3">
              <p className="text-xs font-semibold text-[#1F2348] dark:text-white mb-2">
                Available Products
              </p>
              <div className="flex flex-wrap gap-2">
                {action.catalogData.productTypes.map((type) => {
                  const typeLabels: Record<string, { label: string; emoji: string }> = {
                    giftcard: { label: 'Gift Cards', emoji: '🎁' },
                    physical: { label: 'Physical Cards', emoji: '📦' },
                    airtime: { label: 'Airtime', emoji: '📱' },
                    data: { label: 'Data', emoji: '📶' },
                    esim: { label: 'eSIM', emoji: '🌐' },
                    bills: { label: 'Bills', emoji: '💳' },
                  };
                  const info = typeLabels[type] || { label: type, emoji: '•' };
                  const count = action.catalogData!.summary.byType[type] || 0;

                  return (
                    <div
                      key={type}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700/30"
                    >
                      <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                        {info.emoji} {info.label} ({count})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gift Cards */}
            {action.catalogData.brands.giftcard && action.catalogData.brands.giftcard.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1F2348] dark:text-white">
                  🎁 Gift Cards ({action.catalogData.brands.giftcard.length})
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {action.catalogData.brands.giftcard.slice(0, 20).map((brand, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1F2348] dark:text-white truncate">
                          {brand.name}
                        </p>
                        {(brand.min || brand.max) && (
                          <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60">
                            {brand.min} - {brand.max}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {action.catalogData.brands.giftcard.length > 20 && (
                    <p className="text-[10px] text-center text-[#1F2348]/60 dark:text-white/60 pt-1">
                      + {action.catalogData.brands.giftcard.length - 20} more brands
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Other product types (airtime, data, esim, bills) */}
            {['airtime', 'data', 'esim', 'bills'].map((productType) => {
              const brands = action.catalogData!.brands[productType as keyof typeof action.catalogData.brands];
              if (!brands || brands.length === 0) return null;

              const typeInfo: Record<string, { label: string; emoji: string }> = {
                airtime: { label: 'Airtime Top-ups', emoji: '📱' },
                data: { label: 'Data Bundles', emoji: '📶' },
                esim: { label: 'eSIM Packages', emoji: '🌐' },
                bills: { label: 'Bill Payments', emoji: '💳' },
              };
              const info = typeInfo[productType] || { label: productType, emoji: '•' };

              return (
                <div key={productType} className="space-y-2">
                  <p className="text-xs font-semibold text-[#1F2348] dark:text-white">
                    {info.emoji} {info.label} ({brands.length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {brands.slice(0, 10).map((brand, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10"
                      >
                        <p className="text-sm font-medium text-[#1F2348] dark:text-white truncate">
                          {brand.name}
                        </p>
                      </div>
                    ))}
                    {brands.length > 10 && (
                      <p className="text-[10px] text-center text-[#1F2348]/60 dark:text-white/60 pt-1">
                        + {brands.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-2 border-t border-[#1F2348]/10 dark:border-white/10">
              <p className="text-[11px] text-[#1F2348]/70 dark:text-white/70 leading-relaxed">
                💡 To purchase, tell me which product you want (e.g., "I want Amazon gift card")
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Handle Catalog Lookup - validate brand names before creating actions
  if (action.type === 'catalog-lookup') {
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-700 dark:text-blue-400">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">
              Validating Product
            </p>
            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 font-mono uppercase">
              CATALOG LOOKUP · {action.productType}
            </p>
          </div>
        </div>

        {catalogLoading ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-8 h-8 border-2 border-blue-300 dark:border-blue-800 border-t-blue-700 dark:border-t-blue-400 rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#1F2348]/70 dark:text-white/70">
              Checking available brands in {action.countryCode}...
            </p>
          </div>
        ) : catalogError ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{catalogError}</p>
          </div>
        ) : action.catalogBrands ? (
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                ✅ Found {action.catalogBrands.length} brands in {action.catalogCountry}
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {action.catalogBrands.map((brand: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1F2348] dark:text-white">
                        {brand.name}
                      </p>
                      {(brand.min || brand.max) && (
                        <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60">
                          Range: {brand.min} - {brand.max}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[#1F2348]/70 dark:text-white/70 text-center">
              Creating your order with verified brand name...
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (action.type === 'support') {
    return (
      <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-brand-blue/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-700 dark:text-brand-blue-light">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">Get Support</p>
            <p className="text-[10px] font-mono text-[#1F2348]/60 dark:text-white/65">HELP · FEEDBACK · BUG REPORT</p>
          </div>
        </div>
        <div className="space-y-2 mb-3">
          {SOCIAL_LINKS.map((social) => (
            social.href ? (
              <button
                key={social.label}
                type="button"
                onClick={() => openExternalUrl(social.href!)}
                className="w-full rounded-xl border border-[#1F2348]/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2.5 text-left hover:bg-[#0582CA]/10 hover:border-[#0582CA]/20 transition-all"
                style={{ transition: 'all 200ms cubic-bezier(0.25, 0, 0, 1)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#0582CA]/10 border border-[#0582CA]/20 flex items-center justify-center flex-shrink-0">
                      <Icon name={social.icon} size={16} className="text-[#0582CA]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1F2348] dark:text-white">{social.label}</p>
                      <p className="text-[11px] text-[#1F2348]/60 dark:text-white/65">{social.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#21BCA5]/10 border border-[#21BCA5]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#21BCA5] flex-shrink-0">
                    Live
                  </span>
                </div>
              </button>
            ) : (
              <div
                key={social.label}
                className="w-full rounded-xl border border-dashed border-[#1F2348]/10 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 opacity-50">
                    <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={social.icon} size={16} className="text-gray-400 dark:text-white/30" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1F2348] dark:text-white">{social.label}</p>
                      <p className="text-[11px] text-[#1F2348]/60 dark:text-white/65">{social.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-gray-200 dark:bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1F2348]/70 dark:text-white/65 flex-shrink-0">
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
          <p className="text-sm text-[#1F2348]/70 dark:text-white/70">Support form coming soon! Please check back later.</p>
        )}
      </div>
    );
  }

  // Handle Show Contacts - display saved addresses
  if (action.type === 'show-contacts' || action.type === 'list-contacts') {
    return (
      <div className="bg-white dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-3 sm:p-4 w-full max-w-full sm:max-w-sm space-y-3 backdrop-blur-xl">
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
            <p className="font-semibold text-sm text-[#1F2348] dark:text-white">Saved Contacts</p>
            <p className="text-[10px] text-[#1F2348]/70 dark:text-white/70 font-mono">
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
            <p className="text-sm text-[#1F2348]/70 dark:text-white/70 mb-1">No saved contacts yet</p>
            <p className="text-xs text-[#1F2348]/60 dark:text-white/60">
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
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-white/80 dark:bg-white/5 border-2 border-[#1F2348]/10 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-[#1F2348] dark:text-white truncate">
                      {contact.nickname}
                    </p>
                    {!isValidAddr && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                        INVALID
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs font-mono text-[#1F2348]/70 dark:text-white/70 break-all">
                    {contact.recipient_address}
                  </p>
                  <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60 mt-0.5">
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
                  className="w-full sm:w-auto sm:ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E9B213]/20 dark:bg-gold/10 text-[#E9B213] dark:text-gold border-2 border-amber-300 dark:border-gold/20 hover:bg-amber-200 dark:hover:bg-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:opacity-0 sm:group-hover:opacity-100"
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

    // CRITICAL: Check if this action is already being processed (prevents double-submission)
    // This handles the case where a user retries while a previous attempt is still in the pending sync queue
    if (isAlreadyProcessing) {
      addMessage({
        role: 'ai',
        content: `⏳ This transaction is already being processed.

Your previous submission is still pending. Please wait a moment and check your History tab for updates.

If you see this message for more than 5 minutes, the transaction may have completed but the confirmation was delayed. Please check your History tab before attempting a new transaction.`,
      });
      return;
    }

    // Also check in real-time if this action is already in the pending queue
    const existingPending = findPendingByActionDetails(action.type, action);
    if (existingPending) {
      console.log('[ActionCard] Found existing pending entry:', existingPending.txHash);
      setIsAlreadyProcessing(true);
      if (existingPending.txHash) {
        setTxHash(existingPending.txHash);
      }
      addMessage({
        role: 'ai',
        content: `⏳ This transaction is already being processed.

A previous submission with transaction hash ${existingPending.txHash.slice(0, 8)}...${existingPending.txHash.slice(-6)} is still pending.

Please check your History tab for updates. Do not retry to avoid double-charging.`,
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
    // which includes the 0.5% markup (volatility buffer + service fee).
    // For locked sends (payment requests), use the pre-specified amount.
    // For simple sends, calculate from user input.
    const isLockedOrder = action.type === 'gift-card' || action.type === 'airtime' || action.type === 'bill';
    const isLockedSend = action.type === 'send' && action.locked;
    const amountLuna = (isLockedOrder || isLockedSend)
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

        // CRITICAL: Check if this transaction hash is already being processed
        // This prevents double-submission when the user clicks multiple times
        if (isTxHashPending(hash)) {
          console.log('[ActionCard] Transaction hash already pending:', hash);
          addMessage({
            role: 'ai',
            content: `⏳ This transaction is already being processed.

Transaction hash: ${hash.slice(0, 8)}...${hash.slice(-6)}

Your previous submission is still pending. Please check your History tab for updates.`,
          });
          setLoading(false);
          return;
        }

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
        // PHASE 4: USDT Payment Flow (NEW)
        if (paymentMethod === 'usdt-polygon') {
          // If pre-validation already flagged a problem, stop
          if (prevalidationError) {
            addMessage({
              role: 'ai',
              content: `Cannot process this order: ${prevalidationError}\n\nPlease try with different details.`,
            });
            setLoading(false);
            return;
          }

          try {
            // Import EVM helper functions
            const { connectEthereum, switchToPolygon, sendUSDT, isOnPolygon } = await import('@/lib/wallet/evm');
            const { createCryptoOrder, confirmCryptoPayment } = await import('@/lib/api-client');
            const { getPaymentAddress } = await import('@/lib/wallet/WalletManager');

            // STEP 1: Determine payment coin and network
            const coin: 'NIM' | 'USDT' = 'USDT';
            const network: 'nimiq' | 'polygon' = 'polygon';
            
            addMessage({
              role: 'ai',
              content: `🔗 Connecting to ${network} wallet for ${coin} payment...`,
            });
            
            // STEP 2: Get correct payment address (auto-connects if needed)
            console.log(`[Payment] Getting ${coin} payment address for ${network} network`);
            let paymentAddress: string;
            try {
              paymentAddress = await getPaymentAddress(coin);
              console.log(`[Payment] ✅ Payment address for ${coin}:`, paymentAddress);
            } catch (error: any) {
              console.error('[Payment] Failed to get payment address:', error);
              
              if (error.message?.includes('rejected')) {
                addMessage({
                  role: 'ai',
                  content: '❌ Polygon wallet connection was rejected. USDT payments require connecting your Polygon wallet. Please try again or use NIM payment instead.',
                });
                setLoading(false);
                return;
              }
              
              throw new Error(`Failed to connect ${network} wallet: ${error.message}`);
            }

            // CRYPTOREFILLS BEST PRACTICE: Create order FIRST
            // This allows us to show exact details before wallet interaction
            addMessage({
              role: 'ai',
              content: '🔄 Creating your order with Cryptorefills...',
            });

            const orderResult = await createCryptoOrder({
              type: action.type,
              details: { ...action, recipientEmail: email || undefined },
              walletAddress: wallet.address || '',  // Nimiq address for session auth
              paymentAddress: paymentAddress,        // Polygon address for payment
              paymentMethod: 'usdt-polygon',
              coin: coin,
              network: network,
            });

            console.log('[Payment] Order created:', orderResult.orderId);
            console.log('[Payment] Payment will be sent to:', orderResult.paymentAddress);
            console.log('[Payment] Network:', orderResult.network);

            const { orderId, paymentAddress: cryptorefillsAddress, paymentAmount, paymentCurrency, network: orderNetwork } = orderResult;
            
            // Verify address matches what we sent
            if (cryptorefillsAddress.toLowerCase() !== paymentAddress.toLowerCase()) {
              throw new Error(
                `Address mismatch: Expected ${paymentAddress}, got ${cryptorefillsAddress}. ` +
                `This is a critical error - please contact support.`
              );
            }

            // CRYPTOREFILLS BEST PRACTICE: Display exact payment details
            addMessage({
              role: 'ai',
              content: `✅ Order created!\n\n**Payment Details:**\n• Amount: **${paymentAmount} ${paymentCurrency}**\n• Network: **${orderNetwork}**\n• Recipient: \`${cryptorefillsAddress.slice(0, 10)}...${cryptorefillsAddress.slice(-8)}\`\n\n⚠️ **Important:** The transaction will be pre-filled with the exact amount and network. Please review and approve it in your wallet.\n\n**Do not modify the amount or network** - this will cause your order to fail.`,
            });

            // Step 2: Verify Ethereum wallet connection (already connected by getPaymentAddress)
            console.log('[USDT Payment] Ethereum wallet already connected via WalletManager');

            // Step 3: Switch to Polygon network
            addMessage({
              role: 'ai',
              content: '🔄 Switching to Polygon network...',
            });

            console.log('[USDT Payment] Checking if on Polygon network...');
            const onPolygon = await isOnPolygon();
            console.log('[USDT Payment] On Polygon:', onPolygon);
            
            if (!onPolygon) {
              console.log('[USDT Payment] Switching to Polygon network...');
              await switchToPolygon();
              console.log('[USDT Payment] Switched to Polygon successfully');
            }

            // CRYPTOREFILLS BEST PRACTICE: Wallet opens with pre-populated transaction
            // The sendUSDT() function automatically populates recipient, token contract, and exact amount
            addMessage({
              role: 'ai',
              content: `💎 Opening Nimiq Pay with your payment...\n\n**Review carefully:**\n• Verify amount is **exactly ${paymentAmount} USDT**\n• Verify network is **Polygon**\n• Approve the transaction\n\nThe payment details are pre-filled to prevent errors.`,
            });

            console.log('[USDT Payment] Calling sendUSDT with:', { recipient: cryptorefillsAddress, amount: paymentAmount });
            const txHash = await sendUSDT(cryptorefillsAddress, paymentAmount);
            console.log('[USDT Payment] Transaction sent, hash:', txHash);

            // Step 5: Verify payment on-chain + fulfill order
            addMessage({
              role: 'ai',
              content: `✅ USDT payment sent!\n\nVerifying on Polygon blockchain and fulfilling your order...\n\nTX: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
            });

            const result = await confirmCryptoPayment(orderId, txHash, wallet.address);

            // Step 6: Display success + fulfillment data
            // CRITICAL FIX P0-7: Only lock AFTER successful confirmation
            setSuccess(true);
            setTxHash(txHash);
            setAmountLocked(true);

            // Update action in store
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                completed: true,
                txHash: txHash,
              });
            }

            // Format fulfillment message based on order type
            let fulfillmentMsg = '🎉 Order completed successfully!\n\n';

            if (result.result?.code) {
              fulfillmentMsg += `Gift Card Code: ${result.result.code}\n`;
            }
            if (result.result?.pin) {
              fulfillmentMsg += `PIN: ${result.result.pin}\n`;
            }
            if (result.result?.serialNumber) {
              fulfillmentMsg += `Serial: ${result.result.serialNumber}\n`;
            }
            if (result.result?.instructions) {
              fulfillmentMsg += `\nInstructions:\n${result.result.instructions}\n`;
            }

            fulfillmentMsg += `\nPolygon TX: https://polygonscan.com/tx/${txHash}`;

            addMessage({
              role: 'ai',
              content: fulfillmentMsg,
            });

            // Refresh balance
            await fetchBalance?.();

            setLoading(false);
            return; // Don't continue to NIM flow

          } catch (err: any) {
            console.error('[USDT Payment] Error:', err);

            // Handle user rejection
            if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
              addMessage({
                role: 'ai',
                content: '❌ Payment cancelled. You can try again when ready.',
              });
              setLoading(false);
              return;
            }

            // Handle wrong network
            if (err.message?.includes('wrong network') || err.message?.includes('switch to Polygon')) {
              addMessage({
                role: 'ai',
                content: '❌ Please switch to Polygon network in your wallet and try again.',
              });
              setLoading(false);
              return;
            }

            // Handle insufficient balance
            if (err.message?.includes('insufficient') || err.message?.includes('balance')) {
              addMessage({
                role: 'ai',
                content: '❌ Insufficient USDT balance. Please add USDT to your wallet and try again.',
              });
              setLoading(false);
              return;
            }

            // CRYPTOREFILLS BEST PRACTICE: Direct to support for payment issues
            // Generic error with Cryptorefills support link
            addMessage({
              role: 'ai',
              content: `❌ USDT payment failed: ${err.message || 'Unknown error'}\n\n**Need help?**\nIf you believe the payment was sent but the order didn't complete, please contact Cryptorefills support:\n\n🔗 [Cryptorefills Support](https://www.cryptorefills.com/contact)\n\nProvide your order details and they can help resolve payment issues.`,
            });
            setFailed(true);
            setLoading(false);
            return;
          }
        }

        // EXISTING NIM FLOW (unchanged)
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

        // CRITICAL: Check if this transaction hash is already being processed
        // This prevents double-submission when the user clicks multiple times
        if (isTxHashPending(hash)) {
          console.log('[ActionCard] Order transaction hash already pending:', hash);
          addMessage({
            role: 'ai',
            content: `⏳ This order is already being processed.

Transaction hash: ${hash.slice(0, 8)}...${hash.slice(-6)}

Your previous submission is still pending. Please check your History tab for updates.`,
          });
          setLoading(false);
          return;
        }

        // Let the user know we're confirming the payment on-chain before
        // releasing the gift card code / airtime / bill payment.
        addMessage({
          role: 'ai',
          content: 'Payment sent. Confirming it on the Nimiq network before releasing your order — this can take a few seconds…',
        });

        // CRITICAL: Log quoteId for debugging
        console.log('[Order Creation] QuoteId:', quoteId, 'Type:', action.type, 'Wallet:', wallet.address);
        
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
          // CRITICAL: Always pass quoteId to prevent price mismatch
          console.log('[Order Submission] Sending order with quoteId:', quoteId || 'NONE');
          
          result = await createOrder({
            type: action.type,
            txHash: hash,
            amountLuna,
            details: { ...action, recipientEmail: email || undefined },
            walletAddress: wallet.address,
            quoteId: quoteId || undefined, // Pass the validated quote ID
          });
          
          // Successfully reached backend - remove from queue
          removePendingSync(syncId);
        } catch (err: any) {
          // createOrder() failed to reach the backend at all — the ONLY case
          // this specific catch should handle. The order was never recorded.
          console.error('[Sync] createOrder failed to record, will retry later:', err);
          
          // Check if this is a timeout vs network error
          const isTimeout = err.message?.includes('timeout') || err.message?.includes('timed out');
          const isNetworkError = err.message?.includes('Failed to fetch') || err.message?.includes('network');
          
          setSuccess(true); // we know the on-chain send succeeded
          setTxHash(hash);
          setAmountLocked(true);
          const explorerUrl = `https://nimiq.watch/#${hash}`;
          
          let errorMsg = `✓ Payment Sent\n\nTX: ${hash.slice(0, 8)}…${hash.slice(-6)}\n${explorerUrl}\n\n`;
          
          if (isTimeout) {
            errorMsg += `⏱️ **Processing Delayed**\n\nYour payment was sent successfully, but our server is taking longer than expected to verify it. This can happen when:\n• The Nimiq network is busy\n• Payment verification is backlogged\n\n**What happens next:**\n• We'll keep verifying your payment automatically\n• Check your History tab in 2-5 minutes\n• If verification fails, we'll process a refund within 24 hours\n\n💡 Your payment is safe on the blockchain. Do not retry.`;
          } else if (isNetworkError) {
            errorMsg += `🌐 **Connection Issue**\n\nYour payment was sent, but we couldn't reach our servers to process your order.\n\n**What happens next:**\n• We'll automatically retry processing your payment\n• Check your History tab in a few minutes\n• If it doesn't appear, contact support with your transaction hash\n\n💡 Your NIM has been sent and is safe on the blockchain.`;
          } else {
            errorMsg += `⚠️ **Server Error**\n\nYour payment was sent successfully, but we couldn't process your order right now.\n\n**What happens next:**\n• We'll keep trying to process your payment automatically\n• Check your History tab in a few minutes\n• If it doesn't complete, contact support with your transaction hash\n\n💡 Your payment is recorded on the blockchain and we'll process it.`;
          }
          
          addMessage({
            role: 'ai',
            content: errorMsg,
          });
          
          if (messageIndex >= 0) {
            await updateActionState(messageIndex, {
              locked: true,
              txHash: hash
            });
          }
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
          setAmountLocked(true);
          if (messageIndex >= 0) {
            await updateActionState(messageIndex, {
              locked: true,
              txHash: hash
            });
          }
          addMessage({
            role: 'ai',
            content: '⏳ Confirming your payment on the blockchain... This usually takes 10-30 seconds. Please wait.',
          });
          
          // Poll for order completion with improved feedback and error handling
          let lastStatusUpdate = Date.now();
          let statusUpdateCount = 0;
          
          console.log(`[Order ${result.orderId}] Starting polling for pending order`);
          
          try {
            const finalStatus = await pollOrderStatus(result.orderId, {
              maxAttempts: 40,  // 40 * 3s = 2 minutes max
              intervalMs: 3000,  // Poll every 3 seconds (faster, more responsive)
              onStatusChange: (status, message) => {
                // Log status changes for debugging
                console.log(`[Order ${result.orderId}] Status: ${status} - ${message}`);
                
                // Update UI with intermediate states (but not too frequently)
                const now = Date.now();
                if (now - lastStatusUpdate > 8000) { // At least 8 seconds between updates
                  statusUpdateCount++;
                  lastStatusUpdate = now;
                  
                  if (status === 'pending_verification') {
                    if (statusUpdateCount === 2) {
                      addMessage({
                        role: 'ai',
                        content: '⏳ Still confirming payment on blockchain... Nimiq transactions typically confirm within 1 minute.',
                      });
                    } else if (statusUpdateCount === 4) {
                      addMessage({
                        role: 'ai',
                        content: `🔍 Taking longer than usual... Your transaction: ${hash.slice(0, 8)}...${hash.slice(-6)}\n\nWe're monitoring the blockchain. Please wait.`,
                      });
                    }
                  } else if (status === 'pending') {
                    // Payment confirmed, now fulfilling order
                    addMessage({
                      role: 'ai',
                      content: '✓ Payment confirmed! Processing your order with our provider...',
                    });
                  }
                }
              },
            });
            
            // Update result with final status
            if (finalStatus.success) {
              console.log(`[Order ${result.orderId}] Polling completed successfully`);
              result = {
                success: true,
                ...finalStatus.result,
              };
            } else if (finalStatus.timedOut) {
              // TIMEOUT HANDLING: Order is still being processed, but we stopped polling
              console.warn(`[Order ${result.orderId}] Polling timed out - order still processing`);
              
              setSuccess(true);
              setTxHash(hash);
              setAmountLocked(true);
              
              const explorerUrl = `https://nimiq.watch/#${hash}`;
              addMessage({
                role: 'ai',
                content: `⏱️ **Order Processing Timeout**\n\nYour payment was sent successfully (TX: ${hash.slice(0, 8)}…${hash.slice(-6)}) and is being processed. The order is taking longer than usual to complete.\n\n**What's happening?**\nYour payment is being verified on the blockchain. This can sometimes take a few minutes during network congestion.\n\n**What to do:**\n• Check your order history in 2-5 minutes\n• Your order will appear there once processing completes\n• If it doesn't appear within 10 minutes, contact support\n\n**Order ID:** ${result.orderId}\n**Transaction:** ${explorerUrl}\n\n💡 Do not retry - your payment was received and is being processed.`,
              });
              
              if (messageIndex >= 0) {
                await updateActionState(messageIndex, {
                  completed: true,
                  txHash: hash
                });
              }
              
              // Refresh balance
              fetchBalance();
              setLoading(false);
              return;
            } else {
              throw new Error(finalStatus.error || 'Order fulfillment failed');
            }
          } catch (pollErr: any) {
            // NETWORK ERROR HANDLING: Polling failed due to network issues
            console.error(`[Order ${result.orderId}] Polling failed:`, pollErr);
            
            setSuccess(true);
            setTxHash(hash);
            setAmountLocked(true);
            
            const explorerUrl = `https://nimiq.watch/#${hash}`;
            addMessage({
              role: 'ai',
              content: `⚠️ **Connection Lost**\n\nYour payment was sent successfully (TX: ${hash.slice(0, 8)}…${hash.slice(-6)}), but we lost connection while checking the order status.\n\n**What's happening?**\nYour order is still being processed in the background. The network connection was interrupted, but your payment was received.\n\n**What to do:**\n• Check your order history in 2-5 minutes\n• Your order will appear there once processing completes\n• If you don't see it within 10 minutes, contact support\n\n**Order ID:** ${result.orderId}\n**Transaction:** ${explorerUrl}\n\n💡 Your order will complete automatically - no action needed.`,
            });
            
            if (messageIndex >= 0) {
              await updateActionState(messageIndex, {
                completed: true,
                txHash: hash
              });
            }
            
            // Refresh balance
            fetchBalance();
            setLoading(false);
            return;
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
      else if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
        // Check if we have a transaction hash - this means payment was sent
        if (txHash) {
          const explorerUrl = `https://nimiq.watch/#${txHash}`;
          errorMessage = `⏱️ Verification Timeout\n\nYour payment was sent but verification is taking longer than expected.\n\nTX: ${txHash.slice(0, 8)}...${txHash.slice(-6)}\n${explorerUrl}\n\n**What happens next:**\n• Your payment will be verified automatically\n• Check your History tab in a few minutes\n• If it doesn't complete, we'll process a refund\n\n💡 Do not retry - your payment is being processed.`;
          // Don't mark as failed - payment is still being processed
          setFailed(false);
        } else {
          errorMessage = '⏱️ Timeout\n\nThe request took too long to respond. Please try again.';
        }
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
      // Handle backend communication errors with payment sent
      else if (txHash && (error.message?.includes('Failed to fetch') || error.message?.includes('network') || error.message?.includes('Backend request failed'))) {
        const explorerUrl = `https://nimiq.watch/#${txHash}`;
        errorMessage = `✓ Payment Sent\n\nTX: ${txHash.slice(0, 8)}...${txHash.slice(-6)}\n${explorerUrl}\n\n⚠️ **Backend Connection Issue**\n\nYour payment was sent successfully, but we're having trouble reaching our servers.\n\n**What happens next:**\n• We'll automatically process your payment when the connection is restored\n• Check your History tab in a few minutes\n• If it doesn't appear, contact support with your transaction hash\n\n💡 Your payment is safe on the blockchain. Do not retry.`;
        // Don't mark as failed - payment is being processed
        setFailed(false);
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
    <div className="glass dark:bg-white/[0.035] border-2 border-[#1F2348]/10 dark:border-white/[0.07] rounded-2xl p-4 space-y-3 max-w-sm">
      {/* Action Details */}
      {action.type === 'send' && (
        <div className="flex justify-between items-center">
          <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">To</span>
          <span className="text-[#1F2348] dark:text-white font-mono text-xs">{action.recipient?.substring(0, 14)}...</span>
        </div>
      )}

      {/* Payment request lock banner — shown when receiver set a fixed amount */}
      {isPaymentRequest && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E9B213]/20 dark:bg-gold/10 border border-amber-300 dark:border-gold/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E9B213] flex-shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p className="text-xs text-[#E9B213] dark:text-gold font-medium leading-snug">
            Amount fixed by requester{action.message ? ` · ${action.message}` : ''} — cannot be changed
          </p>
        </div>
      )}

      {action.type === 'gift-card' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Product</span>
            <span className="text-[#1F2348] dark:text-white font-semibold">{action.product}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Value</span>
              <span className="text-[#1F2348] dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {/* Show available denominations from catalog — display only, not selectable */}
          {availableAmounts && availableAmounts.length > 0 && !success && (
            <div className="space-y-1">
              <p className="text-[#1F2348]/60 dark:text-white/65 text-[10px] font-medium uppercase tracking-wider">Available amounts</p>
              <div className="flex flex-wrap gap-1.5">
                {availableAmounts.map(a => (
                  <span
                    key={a}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded select-none ${
                      Number(action.fiatAmount) === a
                        ? 'bg-[#E9B213]/20 dark:bg-gold/15 text-[#E9B213] dark:text-gold/90 ring-1 ring-amber-300 dark:ring-gold/30'
                        : 'bg-white/80 dark:bg-white/[0.04] text-[#1F2348]/60 dark:text-white/65'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[action.currency || 'USD']}{a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {amountRange && !availableAmounts && !success && (
            <p className="text-[#1F2348]/60 dark:text-white/65 text-[10px]">
              Range: {CURRENCY_SYMBOLS[amountRange.currency]}{amountRange.min} – {CURRENCY_SYMBOLS[amountRange.currency]}{amountRange.max}
            </p>
          )}
          <div className="space-y-1">
            <label className="text-[#1F2348]/70 dark:text-white/70 text-xs font-medium">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-white/5 border-2 border-[#1F2348]/10 dark:border-white/10 text-[#1F2348] dark:text-white text-sm placeholder-gray-500 dark:placeholder-white/60 outline-none focus:border-amber-500 dark:focus:border-gold/50 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-gold/20"
            />
            <p className="text-[#1F2348]/60 dark:text-white/60 text-xs">We'll send the gift card code to this email</p>
          </div>
        </>
      )}

      {action.type === 'airtime' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Phone</span>
            <span className="text-[#1F2348] dark:text-white font-semibold">{action.phone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Operator</span>
            <span className="text-[#1F2348] dark:text-white font-semibold">{action.operator}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Amount</span>
              <span className="text-[#1F2348] dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {amountRange && !success && (
            <p className="text-[#1F2348]/60 dark:text-white/65 text-[10px]">
              Valid range: {amountRange.currency} {amountRange.min} – {amountRange.max}
            </p>
          )}
        </>
      )}

      {action.type === 'bill' && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Service</span>
            <span className="text-[#1F2348] dark:text-white font-semibold">{action.service}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Account</span>
            <span className="text-[#1F2348] dark:text-white font-mono text-xs">{action.accountNumber}</span>
          </div>
          {action.fiatAmount && (
            <div className="flex justify-between items-center">
              <span className="text-[#1F2348]/70 dark:text-white/70 text-sm font-medium">Amount</span>
              <span className="text-[#1F2348] dark:text-white font-semibold">
                {CURRENCY_SYMBOLS[action.currency || 'USD']}{action.fiatAmount}
              </span>
            </div>
          )}
          {!success && !failed && (
            <div className="space-y-2 rounded-xl border-2 border-amber-300 dark:border-gold/20 bg-[#E9B213]/10 dark:bg-gold/10 p-3">
              <p className="text-xs leading-relaxed text-amber-800 dark:text-gold/90">
                Reloadly does not return the subscriber name before payment for this flow. Please confirm the service and account or meter number manually before paying.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billAccountConfirmed}
                  onChange={(e) => setBillAccountConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#E9B213] focus:ring-amber-500 dark:border-white/20 dark:bg-white/5 dark:focus:ring-gold"
                />
                <span className="text-xs leading-relaxed text-[#1F2348] dark:text-white/75">
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
          <label className="text-[#1F2348]/70 dark:text-white/70 text-xs font-medium">Amount to pay</label>
          {isOrder && !success && quoteExpiry && (
            <button
              onClick={refreshQuote}
              disabled={refreshing || loading}
              className="text-xs text-[#E9B213] dark:text-gold/70 hover:text-amber-800 dark:hover:text-gold font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-white/5 border-2 ${
          usdtQuoteError ? 'border-red-500 dark:border-error/50' :
          failed ? 'border-red-500 dark:border-error/50' : 
          'border-[#1F2348]/10 dark:border-white/10'
        } ${amountLocked ? 'opacity-75' : 'focus-within:border-amber-500 dark:focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-amber-500/20 dark:focus-within:ring-gold/20'}`}>
          {usdtQuoteLoading ? (
            <div className="flex-1 flex items-center gap-2 text-[#1F2348]/60 dark:text-white/60 text-sm">
              <div className="w-4 h-4 border-2 border-[#1F2348]/20 dark:border-white/20 border-t-[#1F2348] dark:border-t-white rounded-full animate-spin" />
              <span>Fetching USDT price...</span>
            </div>
          ) : (
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              placeholder="0.00"
              disabled={loading || success || failed || amountLocked || usdtQuoteLoading}
              readOnly={amountLocked}
              className="flex-1 bg-transparent text-[#1F2348] dark:text-white text-sm outline-none disabled:cursor-not-allowed placeholder-gray-500 dark:placeholder-white/60"
            />
          )}
          <span className="text-[#1F2348] dark:text-white/65 text-sm font-bold">
            {paymentMethod === 'usdt-polygon' ? 'USDT' : 'NIM'}
          </span>
        </div>
        
        {/* USDT Quote Error */}
        {usdtQuoteError && paymentMethod === 'usdt-polygon' && !success && (
          <div className="flex items-start gap-2 rounded-lg bg-red-100 dark:bg-error/10 border border-red-300 dark:border-error/30 p-2.5">
            <span className="text-red-600 dark:text-error mt-0.5">⚠️</span>
            <p className="text-red-700 dark:text-error text-xs leading-relaxed">
              {usdtQuoteError}
            </p>
          </div>
        )}
        
        {isOrder && !success && quoteExpiry && timeRemaining > 0 && !usdtQuoteError && (
          <p className={`text-xs ${timeRemaining <= 10 ? 'text-orange-600 dark:text-warning animate-pulse font-semibold' : 'text-[#1F2348]/70 dark:text-white/70'} text-right`}>
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

      {/* Locked Payment Method Message */}
      {isPaymentMethodLocked && isOrder && !success && !failed && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-100 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 p-3">
          <span className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</span>
          <div>
            <p className="text-blue-900 dark:text-blue-100 text-xs font-semibold mb-1">
              Payment Method: {paymentMethod === 'usdt-polygon' ? 'USDT on Polygon' : 'NIM'}
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
              {paymentMethod === 'usdt-polygon' 
                ? 'This order will be paid with USDT on the Polygon network.' 
                : 'This order will be paid with NIM from your Nimiq wallet.'}
            </p>
          </div>
        </div>
      )}

      {/* Payment Method Selector (Phase 3: Cryptorefills) */}
      {showPaymentMethodSelector && !isPaymentMethodLocked && isOrder && !success && !failed && (
        <div className="space-y-2">
          <label className="text-[#1F2348]/70 dark:text-white/70 text-xs font-medium">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            {/* NIM Payment Option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('nim')}
              className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                paymentMethod === 'nim'
                  ? 'border-[#E9B213] dark:border-gold bg-[#E9B213]/10 dark:bg-gold/10'
                  : 'border-[#1F2348]/10 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-[#1F2348]/20 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#E9B213]/20 dark:bg-gold/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#E9B213] dark:text-gold">₿</span>
                  </div>
                  <span className="text-sm font-semibold text-[#1F2348] dark:text-white">
                    {paymentMethod === 'usdt-polygon' ? 'USDT' : 'NIM'}
                  </span>
                </div>
                {paymentMethod === 'nim' && (
                  <svg className="w-4 h-4 text-[#E9B213] dark:text-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60 leading-tight">
                Pay with Nimiq Pay
              </p>
            </button>

            {/* USDT-Polygon Payment Option */}
            <button
              type="button"
              onClick={() => setPaymentMethod('usdt-polygon')}
              className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                paymentMethod === 'usdt-polygon'
                  ? 'border-[#26A17B] bg-[#26A17B]/10'
                  : 'border-[#1F2348]/10 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-[#1F2348]/20 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#26A17B]/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#26A17B]">$</span>
                  </div>
                  <span className="text-sm font-semibold text-[#1F2348] dark:text-white">USDT</span>
                </div>
                {paymentMethod === 'usdt-polygon' && (
                  <svg className="w-4 h-4 text-[#26A17B]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60 leading-tight">
                Polygon network
              </p>
            </button>
          </div>
          
          {/* Payment Method Info */}
          {paymentMethod === 'usdt-polygon' && (
            <div className="space-y-2">
              {/* Info about Nimiq Pay EVM support */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                  </svg>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                      💎 Pay with USDT inside Nimiq Pay
                    </p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      Nimiq Pay supports Ethereum tokens! You'll approve the USDT transfer directly in the app, just like you do with NIM payments — no external wallet needed.
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Polygon network • Fast confirmation
                    </div>
                  </div>
                </div>
              </div>
              
              {/* CRYPTOREFILLS BEST PRACTICE: Warning about not changing amount/network */}
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                      ⚠️ Important Payment Instructions
                    </p>
                    <ul className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed space-y-1 list-disc list-inside">
                      <li><strong>Do not change the payment amount</strong> - it's calculated exactly</li>
                      <li><strong>Do not change the network</strong> - must be Polygon</li>
                      <li><strong>Review carefully</strong> before approving in your wallet</li>
                      <li>The transaction will be pre-filled with correct details</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      {/* Payment Summary for USDT (Phase 4) */}
      {paymentMethod === 'usdt-polygon' && cryptoAmount && !success && !failed && !usdtQuoteLoading && (
        <div className="rounded-xl border-2 border-[#26A17B]/30 bg-[#26A17B]/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#1F2348]/70 dark:text-white/70">Product Value</span>
            <span className="text-sm font-semibold text-[#1F2348] dark:text-white">
              {action.fiatAmount || action.amount} {action.currency || 'USD'}
            </span>
          </div>
          <div className="h-px bg-[#1F2348]/10 dark:bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#26A17B]">💎 USDT Cost</span>
            <span className="text-lg font-bold text-[#26A17B]">
              {parseFloat(cryptoAmount).toFixed(6)} USDT
            </span>
          </div>
          {action.currency && action.currency !== 'USD' && (
            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/60 text-center pt-1">
              Exchange rate applied: {action.currency} → USD → USDT
            </p>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={executeAction}
        disabled={loading || success || failed || isAlreadyProcessing || !amount || parseFloat(amount) <= 0 || !!prevalidationError || (action.type === 'bill' && !billAccountConfirmed) || usdtQuoteLoading || !!usdtQuoteError}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          success
            ? 'bg-success/10 text-success cursor-default border border-success/20'
            : failed
            ? 'bg-error/10 text-error cursor-default border border-error/20'
            : isAlreadyProcessing
            ? 'bg-gold/20 text-gold cursor-default border border-gold/30'
            : 'btn-gold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {loading ? 'Processing...' : success ? '✓ Payment Complete!' : failed ? '✗ Transaction Failed' : isAlreadyProcessing ? '⏳ Processing...' : usdtQuoteLoading ? 'Fetching USDT price...' : paymentMethod === 'usdt-polygon' ? `Pay ${cryptoAmount ? parseFloat(cryptoAmount).toFixed(4) : ''} USDT` : 'Confirm & Pay'}
      </button>
      {action.type === 'bill' && !billAccountConfirmed && !success && !failed && (
        <p className="text-xs text-[#E9B213] dark:text-gold/80 text-center">
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

      {isAlreadyProcessing && !failed && !success && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-gold">⏳ Transaction Processing</p>
          <p className="text-[11px] text-gold/80 mt-0.5">
            This action is already being processed. Check your History tab for updates. Do not retry to avoid double-charging.
          </p>
          {txHash && (
            <a
              href={`https://nimiq.watch/#${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gold underline mt-1 inline-block"
              onClick={(e) => {
                e.preventDefault();
                openExternalUrl(`https://nimiq.watch/#${txHash}`);
              }}
            >
              View on Nimiq Watch: {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </a>
          )}
        </div>
      )}
    </div>
  );
}


