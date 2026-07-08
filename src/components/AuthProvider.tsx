'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { signInWithWallet, checkAuthStatus } from '@/lib/auth';

/**
 * AuthProvider - Establishes wallet authentication session
 * 
 * Triggers the sign-in handshake once when a wallet connects.
 * The session cookie (nimagent_session) persists for 24 hours,
 * enabling all wallet-scoped API calls (orders, cashback, referrals, etc.)
 * 
 * Must be mounted at the root level (layout.tsx) to ensure authentication
 * happens before any pages try to make wallet-scoped API calls.
 */
export default function AuthProvider() {
  const wallet = useAppStore(state => state.wallet);
  const [authStatus, setAuthStatus] = useState<'idle' | 'checking' | 'awaiting-signature' | 'error'>('idle');
  const [showFeedback, setShowFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const attemptAuthentication = (walletAddress: string, bypassThrottle = false) => {
    const authKey = `nimagent_auth_attempt_${walletAddress}`;
    const lastAttempt = sessionStorage.getItem(authKey);
    const now = Date.now();

    // If we attempted auth in the last 5 minutes, don't try again
    // (unless this is a manual retry which bypasses the throttle)
    if (!bypassThrottle && lastAttempt && now - parseInt(lastAttempt) < 5 * 60 * 1000) {
      return;
    }

    setAuthStatus('checking');
    setErrorMessage('');

    // Delay showing feedback by 400ms so it doesn't flash for fast auth
    const feedbackTimeout = setTimeout(() => setShowFeedback(true), 400);

    // Check if we already have a valid session before prompting for signature
    checkAuthStatus()
      .then((status) => {
        // If already authenticated with the correct wallet, don't re-prompt
        if (status.authenticated && status.wallet === walletAddress) {
          console.log('[Auth] Already authenticated with valid session');
          sessionStorage.setItem(authKey, now.toString());
          clearTimeout(feedbackTimeout);
          setShowFeedback(false);
          setAuthStatus('idle');
          return;
        }

        // No valid session - trigger authentication
        setAuthStatus('awaiting-signature');
        return signInWithWallet(walletAddress)
          .then(() => {
            console.log('[Auth] Wallet authenticated successfully');
            sessionStorage.setItem(authKey, now.toString());
            clearTimeout(feedbackTimeout);
            setShowFeedback(false);
            setAuthStatus('idle');
          })
          .catch((error) => {
            console.error('[Auth] Authentication failed:', error);
            clearTimeout(feedbackTimeout);
            setAuthStatus('error');
            setErrorMessage(error.message || 'Sign-in failed. Please try again.');
            // Keep showFeedback true for error state
          });
      })
      .catch((error) => {
        console.error('[Auth] Session check failed:', error);
        clearTimeout(feedbackTimeout);
        setShowFeedback(false);
        setAuthStatus('idle');
        // If session check fails, don't attempt sign-in (might be network issue)
      });
  };

  useEffect(() => {
    // Only authenticate if wallet is connected and we have an address
    if (!wallet.connected || !wallet.address) {
      return;
    }

    // TypeScript type guard - at this point wallet.address is definitely non-null
    const walletAddress = wallet.address;

    attemptAuthentication(walletAddress, false);
  }, [wallet.connected, wallet.address]);

  // Manual retry handler
  const handleRetry = () => {
    if (!wallet.address) return;
    setShowFeedback(false);
    attemptAuthentication(wallet.address, true); // Bypass throttle for manual retry
  };

  // Don't render anything if status is idle
  if (authStatus === 'idle' || !showFeedback) {
    return null;
  }

  // Render feedback toast/banner
  return (
    <div className="fixed bottom-[5.5rem] left-4 right-4 z-40 animate-fade-up">
      <div 
        className={`rounded-xl border shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 ${
          authStatus === 'error'
            ? 'border-red-300/80 dark:border-error/25 bg-red-50 dark:bg-[#1c0000] cursor-pointer hover:bg-red-100 dark:hover:bg-[#2c0000] transition-colors'
            : 'border-amber-300/80 dark:border-gold/25 bg-amber-50 dark:bg-[#1c1200] pointer-events-none'
        }`}
        onClick={authStatus === 'error' ? handleRetry : undefined}
      >
        {authStatus === 'error' ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 dark:bg-error flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-900 dark:text-error leading-snug">
                {errorMessage}
              </p>
              <p className="text-[10px] text-red-700 dark:text-error/70 mt-0.5">
                Tap to try again
              </p>
            </div>
          </>
        ) : authStatus === 'awaiting-signature' ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-amber-500 dark:border-gold/70 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
              Confirm the sign-in request in your wallet...
            </p>
          </>
        ) : (
          <>
            <div className="w-3.5 h-3.5 border-2 border-amber-500 dark:border-gold/70 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
              Checking authentication...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
