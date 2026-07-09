'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [hasTriggeredAuth, setHasTriggeredAuth] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const authInFlightRef = useRef(false);

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

    // Delay showing feedback by 200ms (reduced from 400ms for faster user feedback)
    const feedbackTimeout = setTimeout(() => setShowFeedback(true), 200);

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
          authInFlightRef.current = false; // Reset ref on completion
          // Notify the app store that authentication completed
          useAppStore.getState().notifyAuthComplete();
          return;
        }

        // No valid session - trigger authentication
        setAuthStatus('awaiting-signature');
        return signInWithWallet(walletAddress)
          .then(() => {
            console.log('[Auth] Wallet authenticated successfully');
            
            // Mark as authenticated in this session to prevent re-auth on app return
            const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
            sessionStorage.setItem(sessionAuthKey, 'true');
            sessionStorage.setItem(authKey, now.toString());
            
            clearTimeout(feedbackTimeout);
            setShowFeedback(false);
            setAuthStatus('idle');
            authInFlightRef.current = false; // Reset ref on completion
            // Notify the app store that authentication completed
            useAppStore.getState().notifyAuthComplete();
          })
          .catch((error) => {
            console.error('[Auth] Authentication failed:', error);
            clearTimeout(feedbackTimeout);
            setAuthStatus('error');
            authInFlightRef.current = false; // Reset ref on failure
            
            // Clear the session authentication flag so user can retry
            const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
            sessionStorage.removeItem(sessionAuthKey);
            
            // User-friendly error messages
            let friendlyError = 'Sign-in failed. Please try again.';
            if (error.message?.includes('cancelled') || error.message?.includes('reject')) {
              friendlyError = 'Authentication cancelled. Tap to try again.';
            } else if (error.message?.includes('timeout')) {
              friendlyError = 'Sign-in timed out. Tap to retry.';
            } else if (error.message) {
              friendlyError = error.message;
            }
            
            setErrorMessage(friendlyError);
            setShowFeedback(true);
            
            // Auto-dismiss error after 8 seconds (gives user time to read)
            setTimeout(() => {
              setShowFeedback(false);
              setAuthStatus('idle');
            }, 8000);
          });
      })
      .catch((error) => {
        console.error('[Auth] Session check failed:', error);
        clearTimeout(feedbackTimeout);
        setShowFeedback(false);
        setAuthStatus('idle');
        authInFlightRef.current = false; // Reset ref on error
        // If session check fails, don't attempt sign-in (might be network issue)
      });
  };

  // Delay initialization to prevent auth firing before UI renders
  useEffect(() => {
    const insideNimiqPay = typeof window !== 'undefined' && !!window.nimiqPay;
    
    if (insideNimiqPay) {
      // In Nimiq Pay, longer delay to ensure UI renders first
      // Increased to 3000ms (3s) to guarantee page loads before any auth
      const initDelay = setTimeout(() => setIsReady(true), 3000);
      return () => clearTimeout(initDelay);
    } else {
      // Outside Nimiq Pay, ready immediately
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    // Don't authenticate until component is ready
    if (!isReady) return;

    // Only authenticate if wallet is connected AND we have an address
    // Both must be present to avoid racing conditions during wallet connection
    if (!wallet.connected || !wallet.address) {
      // Reset the flag when wallet disconnects so it can trigger again on next connect
      setHasTriggeredAuth(false);
      authInFlightRef.current = false; // Reset ref on disconnect
      return;
    }

    // TypeScript type guard - at this point wallet.address is definitely non-null
    const walletAddress = wallet.address;

    // Prevent repeated authentication attempts when wallet state updates
    if (hasTriggeredAuth || authInFlightRef.current) return;

    // Set guards BEFORE any async operations to prevent race conditions
    authInFlightRef.current = true;
    setHasTriggeredAuth(true);

    // Check sessionStorage FIRST (synchronous, instant check)
    // This prevents unnecessary signature prompts on app reopen/refresh within 24h
    const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
    const hasSessionFlag = sessionStorage.getItem(sessionAuthKey);

    if (hasSessionFlag === 'true') {
      // User authenticated in this session already - trust it and skip server check
      // The server session cookie (24h) should still be valid since we only set
      // this flag after successful authentication
      console.log('[Auth] Session flag found - skipping auth check (trusting existing 24h session)');
      useAppStore.getState().notifyAuthComplete();
      authInFlightRef.current = false;
      return;
    }

    // No session flag found - check server for valid 24h session
    // This happens on:
    // 1. First app open (new wallet connection)
    // 2. After clearing browser cache/sessionStorage
    // 3. After 24h expiry (session flag cleared, cookie expired)
    console.log('[Auth] No session flag - checking server for valid 24h session...');
    
    checkAuthStatus()
      .then((status) => {
        if (status.authenticated && status.wallet === walletAddress) {
          // Valid 24h session exists on server - restore session flag
          console.log('[Auth] Valid 24h session found on server - no signature needed');
          sessionStorage.setItem(sessionAuthKey, 'true');
          useAppStore.getState().notifyAuthComplete();
          authInFlightRef.current = false;
        } else {
          // No valid session or session expired - authenticate now
          // This happens on:
          // 1. First-time login (new wallet connection)
          // 2. After 24h session expiry (even with persisted wallet)
          // 3. After explicit logout
          console.log('[Auth] No valid session or session expired - requesting signature');
          
          // Clear any stale sessionStorage flag
          sessionStorage.removeItem(sessionAuthKey);
          
          // Small delay to ensure UI is fully rendered before signature prompt
          setTimeout(() => {
            attemptAuthentication(walletAddress, false);
          }, 1000);
        }
      })
      .catch((err) => {
        // Session check failed (network error) - try to authenticate anyway
        console.error('[Auth] Session check failed, will attempt authentication:', err);
        
        // Clear sessionStorage since we couldn't verify
        sessionStorage.removeItem(sessionAuthKey);
        
        setTimeout(() => {
          attemptAuthentication(walletAddress, false);
        }, 1000);
      });
  }, [wallet.connected, wallet.address, hasTriggeredAuth, isReady]);

  // Manual retry handler
  const handleRetry = () => {
    if (!wallet.address) return;
    
    // Clear the session authenticated flag to allow fresh retry
    const sessionAuthKey = `nimagent_session_authenticated_${wallet.address}`;
    sessionStorage.removeItem(sessionAuthKey);
    
    setShowFeedback(false);
    setErrorMessage('');
    setAuthStatus('idle');
    setHasTriggeredAuth(false); // Reset flag so useEffect can trigger again
    
    // Don't call attemptAuthentication directly - let useEffect handle it
    // This ensures proper flow through the authentication logic
  };

  // Don't render anything if status is idle
  if (authStatus === 'idle' || !showFeedback) {
    return null;
  }

  // Render feedback toast/banner
  // Positioned higher than syncing toast to avoid overlap
  return (
    <div className="fixed bottom-[8rem] left-4 right-4 z-50 animate-fade-up">
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
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
                Sign in to unlock NimAgent
              </p>
              <p className="text-[10px] text-amber-700 dark:text-gold/70 mt-0.5">
                Check Nimiq Pay for a secure signature request
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-3.5 h-3.5 border-2 border-amber-500 dark:border-gold/70 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
                Setting up your secure session...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
