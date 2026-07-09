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
      // In Nimiq Pay, always delay to let UI render first
      const initDelay = setTimeout(() => setIsReady(true), 2000);
      return () => clearTimeout(initDelay);
    } else {
      // Outside Nimiq Pay, ready immediately
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    // Don't authenticate until component is ready
    if (!isReady) return;

    // Only authenticate if wallet is connected and we have an address
    if (!wallet.connected || !wallet.address) {
      // Reset the flag when wallet disconnects so it can trigger again on next connect
      setHasTriggeredAuth(false);
      authInFlightRef.current = false; // Reset ref on disconnect
      return;
    }

    // TypeScript type guard - at this point wallet.address is definitely non-null
    const walletAddress = wallet.address;

    // Check if we've EVER authenticated in this browser session (survives component remounts)
    const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
    const hasAuthenticatedInSession = sessionStorage.getItem(sessionAuthKey);

    if (hasAuthenticatedInSession) {
      // We already authenticated in this browser session, don't do it again
      // This prevents re-auth when returning to the app or on page refresh
      setHasTriggeredAuth(true);
      return;
    }

    // Prevent repeated authentication attempts when wallet state updates
    // Only trigger authentication once per wallet connection session
    if (hasTriggeredAuth) return;

    // For page refresh/reload: silently check if session is still valid
    // This prevents signature prompts when user just refreshed the page
    const hasRefreshed = typeof window !== 'undefined' && 
      performance.navigation.type === 1; // 1 = TYPE_RELOAD
    
    if (hasRefreshed) {
      // On page refresh, just check session status without showing UI
      // If session is valid, mark as authenticated. If not, user can authenticate
      // when they actually try to use a feature that needs auth.
      console.log('[Auth] Page refresh detected - checking existing session silently');
      checkAuthStatus()
        .then((status) => {
          if (status.authenticated && status.wallet === walletAddress) {
            console.log('[Auth] Valid session found on refresh - no auth needed');
            sessionStorage.setItem(sessionAuthKey, 'true');
            setHasTriggeredAuth(true);
            useAppStore.getState().notifyAuthComplete();
          } else {
            // No valid session - but don't prompt automatically on refresh
            // User can authenticate when they try to use a protected feature
            console.log('[Auth] No valid session on refresh - will authenticate on demand');
            setHasTriggeredAuth(true); // Mark as attempted so we don't keep checking
          }
        })
        .catch(() => {
          // Session check failed - treat same as no session
          setHasTriggeredAuth(true);
        });
      return;
    }

    // Check if this is a first-time visit in Nimiq Pay
    const isFirstVisit = typeof window !== 'undefined' && 
      window.nimiqPay && 
      !sessionStorage.getItem('nimagent_visited');

    if (isFirstVisit) {
      // First time in Nimiq Pay - let user see the app first!
      console.log('[Auth] First visit - delaying authentication for better UX');
      sessionStorage.setItem('nimagent_visited', 'true');
      
      // Additional 2 seconds delay for first visit (total 4s from mount)
      const delayTimeout = setTimeout(() => {
        // Synchronous guard to prevent double-trigger
        if (authInFlightRef.current) return;
        authInFlightRef.current = true;
        setHasTriggeredAuth(true);
        attemptAuthentication(walletAddress, false);
      }, 2000);

      return () => clearTimeout(delayTimeout);
    }

    // Returning user or not in Nimiq Pay - authenticate after delay (but check session first)
    // Synchronous guard to prevent double-trigger
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    setHasTriggeredAuth(true);
    
    // Still add a small delay for returning users to let page render
    setTimeout(() => {
      attemptAuthentication(walletAddress, false);
    }, 500);
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
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900 dark:text-gold leading-snug">
                Complete sign-in to unlock all features
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
