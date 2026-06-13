'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { requestPayment, prewarmHub } from '@/lib/wallet';
import { recordTransaction, createOrder, validateOrder } from '@/lib/api-client';
import QRCodeDisplay from './QRCodeDisplay';
import BalanceDisplay from './BalanceDisplay';
import QRScanner from './QRScanner';
import SwapInterface from './SwapInterface';
import BuyNimInterface from './BuyNimInterface';
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
  const { wallet, addMessage, messages, updateActionState, setActiveTab, sendMessageToAI } = useAppStore();
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const [loading, setLoading] = useState(false);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch contacts for show-contacts action type
  useEffect(() => {
    if ((action.type === 'show-contacts' || action.type === 'list-contacts') && wallet.address && savedContacts.length === 0) {
      setLoadingContacts(true);
      import('@/lib/api-client').then(({ getSavedAddresses }) => {
        getSavedAddresses(wallet.address!)
          .then(contacts => {
            console.log('[ActionCard] Fetched contacts:', contacts.length);
            contacts.forEach((c, idx) => {
              console.log(`[ActionCard] Contact ${idx}: ${c.nickname} -> ${c.recipient_address} (length: ${c.recipient_address?.length || 0})`);
            });
            setSavedContacts(contacts);
          })
          .catch(err => {
            console.error('[ActionCard] Failed to fetch contacts:', err);
          })
          .finally(() => {
            setLoadingContacts(false);
          });
      });
    }
  }, [wallet.address, action.type]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Handle Crypto Swap - show swap interface
  if (action.type === 'crypto-swap') {
    return <SwapInterface />;
  }

  // Handle Buy NIM - show Coinify buy interface
  if (action.type === 'buy-nim') {
    return <BuyNimInterface />;
  }

  // Handle Staking - redirect to stake tab
  if (action.type === 'stake' || action.type === 'unstake' || action.type === 'withdraw') {
    const isWithdraw = action.type === 'withdraw';
    const isUnstake = action.type === 'unstake';
    return (
      <div className="bg-white dark:bg-white/[0.035] border-2 border-amber-300 dark:border-[#F5A623]/20 rounded-2xl p-4 max-w-sm bg-gradient-to-br from-amber-50/50 to-transparent dark:from-[#F5A623]/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-[#F5A623]/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-700 dark:text-[#F5A623]">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {isWithdraw ? 'Withdraw Stake' : isUnstake ? 'Manage Staking' : 'Earn Staking Rewards'}
            </p>
            <p className="text-[10px] font-mono text-gray-500 dark:text-white/55">
              {isWithdraw ? 'WITHDRAW UNLOCKED NIM' : isUnstake ? 'UNSTAKE & WITHDRAW' : '~8% APY · NON-CUSTODIAL'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('stake')}
          className="w-full py-2.5 px-4 rounded-xl bg-amber-600 dark:bg-[#F5A623] text-white font-semibold hover:bg-amber-700 dark:hover:bg-[#FBBF4D] transition-colors"
        >
          Go to Stake Tab
        </button>
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
                    console.log('[ActionCard] Send button clicked for contact:', {
                      nickname: contact.nickname,
                      address: contact.recipient_address,
                      normalizedLength: normalizedAddr.length
                    });
                    
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
                    
                    console.log('[ActionCard] Normalized address:', normalizedAddress, 'Length:', normalizedAddress.length);
                    
                    // Validate format (NQ + 34 alphanumeric = 36 total)
                    if (!/^NQ[0-9A-Z]{34}$/.test(normalizedAddress)) {
                      addMessage({
                        role: 'ai',
                        content: `❌ Error: Contact "${contact.nickname}" has an invalid address format.\n\nAddress: ${contact.recipient_address}\nNormalized: ${normalizedAddress}\nLength: ${normalizedAddress.length} chars (expected 36)\n\nPlease delete this contact and save it again with a valid Nimiq address.`,
                      });
                      return;
                    }
                    
                    // Send message with FULL address so AI can immediately create send action
                    addMessage({
                      role: 'user',
                      content: `Send NIM to ${contact.nickname} (${contact.recipient_address})`,
                    });
                    // Also send the AI context so it knows this is a saved contact
                    sendMessageToAI(`Send NIM to ${contact.nickname} at address ${contact.recipient_address}`, wallet.address || undefined);
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
        console.log('[ActionCard] Initiating send transaction:', {
          recipient: normalizedRecipient,
          amountLuna,
          walletAddress: wallet.address
        });
        
        const hash = await requestPayment(
          normalizedRecipient,
          amountLuna,
          'NimHub-send',
          'direct',
          wallet.address // Pass wallet address to skip address selection
        );

        console.log('[ActionCard] Transaction successful, hash:', hash);

        await recordTransaction({
          type: 'send',
          fromAddress: wallet.address,
          toAddress: normalizedRecipient,
          amountLuna,
          txHash: hash,
          status: 'completed',
        });

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
        
        const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
        const explorerUrl = network === 'mainnet' 
          ? `https://nimiq.watch/#${hash}`
          : `https://test.nimiq.watch/#${hash}`;
        
        addMessage({
          role: 'ai',
          content: `Payment sent successfully! 🎉\n\nTransaction Hash:\n${hash}\n\nView on explorer:\n${explorerUrl}`,
        });

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
        // FIX 2 FRONTEND: Handle confirmation requirement - retry if payment not yet confirmed
        let result;
        let retryCount = 0;
        const maxRetries = 4; // Up to 4 retries (0 initial + 3 retries = ~2 minutes max)
        
        while (retryCount <= maxRetries) {
          try {
            result = await createOrder({
              type: action.type,
              txHash: hash,
              amountLuna,
              details: { ...action, recipientEmail: email || undefined },
              walletAddress: wallet.address,
              quoteId: quoteId || undefined,
            });
            
            // Success! Break out of retry loop
            break;
          } catch (err: any) {
            // Check if error is due to insufficient confirmations
            const isConfirmationError = err.message?.includes('not yet confirmed') || 
                                       err.message?.includes('confirmation');
            
            if (isConfirmationError && retryCount < maxRetries) {
              retryCount++;
              const waitTime = 20000; // Wait 20 seconds between retries
              
              console.log(`[Confirmation Wait] Attempt ${retryCount}/${maxRetries} - waiting ${waitTime/1000}s for confirmation`);
              
              // Update user with waiting message
              if (retryCount === 1) {
                addMessage({
                  role: 'ai',
                  content: '⏳ Waiting for blockchain confirmation... This usually takes 30-60 seconds. Please wait.',
                });
              }
              
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // Not a confirmation error, or max retries reached - rethrow
              throw err;
            }
          }
        }
        
        // If we exhausted retries without success
        if (!result) {
          throw new Error('Payment confirmation timeout. Your payment is on-chain but order processing failed. Our team will investigate.');
        }

        if (result.success) {
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
      console.error('Action execution error:', error);
      
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
      // Handle popup blocked
      else if (error.message?.includes('popup')) {
        errorMessage = '🚫 Popup Blocked\n\nPlease allow popups for this site and try again.';
      }
      // Handle locked order from backend
      else if (error.message?.includes('locked') || error.message?.includes('already failed')) {
        errorMessage = `❌ Order Locked\n\n${error.message}\n\n⚠️ This transaction is locked. Do not retry. If your payment was deducted, a refund will be processed within 24 hours.`;
      }
      // Generic error
      else {
        errorMessage = `❌ Payment Failed\n\n${error.message || 'Something went wrong. Please try again.'}\n\nIf funds were deducted, our team will investigate and process a refund if needed.`;
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
    <div className="bg-white dark:bg-white/[0.035] border-2 border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 space-y-3 max-w-sm backdrop-blur-xl">
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
        disabled={loading || success || failed || !amount || parseFloat(amount) <= 0 || !!prevalidationError}
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