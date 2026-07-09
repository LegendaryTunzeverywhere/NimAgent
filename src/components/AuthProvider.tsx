'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { signInWithWallet, checkAuthStatus } from '@/lib/auth';

/**
 * AuthProvider - Manual wallet authentication with 24h sessions
 * 
 * Users must manually click "Sign In" to authenticate their wallet.
 * The session cookie (nimagent_session) persists for 24 hours.
 * 
 * On app reopen, silently checks for valid session without prompting.
 * All wallet-scoped API calls verify authentication server-side.
 */
export default function AuthProvider() {
  const wallet = useAppStore(state => state.wallet);
  const [authStatus, setAuthStatus] = useState<'idle' | 'checking' | 'awaiting-signature' | 'error'>('idle');
  const [showFeedback, setShowFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Delay initialization to ensure UI renders first
  useEffect(() => {
    const insideNimiqPay = typeof window !== 'undefined' && !!window.nimiqPay;
    
    if (insideNimiqPay) {
      const initDelay = setTimeout(() => setIsReady(true), 1000);
      return () => clearTimeout(initDelay);
    } else {
      setIsReady(true);
    }
  }, []);

  // Silent session check on mount (no automatic signature prompts)
  useEffect(() => {
    if (!isReady || !wallet.connected || !wallet.address || hasCheckedSession) {
      return;
    }

    const walletAddress = wallet.address;
    setHasCheckedSession(true);

    // Check sessionStorage FIRST (instant, no network)
    const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
    const hasSessionFlag = sessionStorage.getItem(sessionAuthKey);

    if (hasSessionFlag === 'true') {
      console.log('[Auth] Session flag found - user is authenticated');
      useAppStore.getState().notifyAuthComplete();
      return;
    }

    // No session flag - check server silently for valid 24h session
    console.log('[Auth] Checking server for valid 24h session...');
    
    checkAuthStatus()
      .then((status) => {
        if (status.authenticated && status.wallet === walletAddress) {
          console.log('[Auth] Valid 24h session found - user is authenticated');
          sessionStorage.setItem(sessionAuthKey, 'true');
          useAppStore.getState().notifyAuthComplete();
        } else {
          console.log('[Auth] No valid session - user must sign in manually');
        }
      })
      .catch((err) => {
        console.error('[Auth] Session check failed:', err);
      });
  }, [isReady, wallet.connected, wallet.address, hasCheckedSession]);

  // Reset check flag when wallet disconnects
  useEffect(() => {
    if (!wallet.connected) {
      setHasCheckedSession(false);
    }
  }, [wallet.connected]);

  // Manual sign-in function (called from UI button)
  const handleSignIn = () => {
    if (!wallet.address || authStatus !== 'idle') return;

    const walletAddress = wallet.address;
    
    setAuthStatus('awaiting-signature');
    setErrorMessage('');
    setShowFeedback(true);

    // Trigger signature directly - no pre-check to avoid double wallet prompts
    signInWithWallet(walletAddress)
      .then(() => {
        console.log('[Auth] Successfully signed in');
        
        const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
        sessionStorage.setItem(sessionAuthKey, 'true');
        
        setShowFeedback(false);
        setAuthStatus('idle');
        useAppStore.getState().notifyAuthComplete();
      })
      .catch((error) => {
        console.error('[Auth] Sign-in failed:', error);
        setAuthStatus('error');
        
        // User-friendly error messages
        let friendlyError = 'Sign-in failed. Please try again.';
        if (error.message?.includes('cancelled') || error.message?.includes('reject')) {
          friendlyError = 'Sign-in cancelled. Tap to try again.';
        } else if (error.message?.includes('timeout')) {
          friendlyError = 'Sign-in timed out. Tap to retry.';
        } else if (error.message) {
          friendlyError = error.message;
        }
        
        setErrorMessage(friendlyError);
        setShowFeedback(true);
        
        // Auto-dismiss error after 8 seconds
        setTimeout(() => {
          setShowFeedback(false);
          setAuthStatus('idle');
        }, 8000);
      });
  };

  // Expose sign-in function globally for UI components to call
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__triggerManualAuth = handleSignIn;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__triggerManualAuth;
      }
    };
  }, [wallet.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render anything if status is idle
  if (authStatus === 'idle' || !showFeedback) {
    return null;
  }

  // Render feedback toast only during active authentication
  return (
    <div className="fixed bottom-[8rem] left-4 right-4 z-50 animate-fade-up">
      <div 
        className={`rounded-xl border shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 ${
          authStatus === 'error'
            ? 'border-red-300/80 dark:border-error/25 bg-red-50 dark:bg-[#1c0000] cursor-pointer hover:bg-red-100 dark:hover:bg-[#2c0000] transition-colors'
            : 'border-amber-300/80 dark:border-gold/25 bg-amber-50 dark:bg-[#1c1200] pointer-events-none'
        }`}
        onClick={authStatus === 'error' ? handleSignIn : undefined}
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
                Waiting for signature...
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
                Checking authentication...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
