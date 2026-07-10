'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
    // If no wallet connected, mark auth check as complete immediately
    if (!wallet.connected) {
      if (!wallet.authChecked) {
        useAppStore.setState((state) => ({
          wallet: { ...state.wallet, authChecked: true }
        }));
      }
      return;
    }
    
    if (!isReady || !wallet.address || hasCheckedSession) {
      return;
    }

    const walletAddress = wallet.address;
    setHasCheckedSession(true);

    // Check localStorage FIRST (instant, no network, survives app close)
    // localStorage persists across app suspensions, unlike sessionStorage
    const authCacheKey = `nimagent_auth_cache_${walletAddress}`;
    const authCache = localStorage.getItem(authCacheKey);
    
    if (authCache) {
      try {
        const cached = JSON.parse(authCache);
        const now = Date.now();
        
        // Auth cache is valid for 23 hours (less than server's 24h to avoid edge cases)
        if (cached.authenticated && cached.expiresAt > now) {
          console.log('[Auth] Valid auth cache found - user is authenticated');
          useAppStore.getState().notifyAuthComplete();
          
          // Also set sessionStorage for in-session performance
          sessionStorage.setItem(`nimagent_session_authenticated_${walletAddress}`, 'true');
          
          // Mark auth check as complete
          useAppStore.setState((state) => ({
            wallet: { ...state.wallet, authChecked: true }
          }));
          return;
        } else {
          console.log('[Auth] Auth cache expired - checking server');
          localStorage.removeItem(authCacheKey);
        }
      } catch (err) {
        console.warn('[Auth] Failed to parse auth cache:', err);
        localStorage.removeItem(authCacheKey);
      }
    }

    // No valid cache - check server silently for valid 24h session
    console.log('[Auth] Checking server for valid 24h session...');
    
    checkAuthStatus()
      .then((status) => {
        if (status.authenticated && status.wallet === walletAddress) {
          console.log('[Auth] Valid 24h session found - user is authenticated');
          
          // Cache the auth status in localStorage (23 hours)
          const expiresAt = Date.now() + (23 * 60 * 60 * 1000);
          localStorage.setItem(authCacheKey, JSON.stringify({
            authenticated: true,
            expiresAt
          }));
          
          // Also set sessionStorage for in-session performance
          sessionStorage.setItem(`nimagent_session_authenticated_${walletAddress}`, 'true');
          
          useAppStore.getState().notifyAuthComplete();
          
          // Mark auth check as complete
          useAppStore.setState((state) => ({
            wallet: { ...state.wallet, authChecked: true }
          }));
        } else {
          console.log('[Auth] No valid session - disconnecting stale wallet state');
          localStorage.removeItem(authCacheKey);
          
          // FIX: Disconnect wallet to clear stale connected state
          useAppStore.getState().disconnectWallet();
          
          // Mark auth check as complete (even though auth failed)
          useAppStore.setState((state) => ({
            wallet: { ...state.wallet, authChecked: true }
          }));
        }
      })
      .catch((err) => {
        console.error('[Auth] Session check failed:', err);
        localStorage.removeItem(authCacheKey);
        
        // FIX: Disconnect wallet on check failure to clear stale state
        useAppStore.getState().disconnectWallet();
        
        // Mark auth check as complete (even though check failed)
        useAppStore.setState((state) => ({
          wallet: { ...state.wallet, authChecked: true }
        }));
      });
  }, [isReady, wallet.connected, wallet.address, hasCheckedSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset check flag when wallet disconnects
  useEffect(() => {
    if (!wallet.connected) {
      setHasCheckedSession(false);
      setAuthStatus('idle');
      setShowFeedback(false);
      setErrorMessage('');
    }
  }, [wallet.connected]);

  // Manual sign-in function (called from UI button)
  const handleSignIn = useCallback(() => {
    if (!wallet.address) {
      console.log('[Auth] Cannot sign in - no wallet address');
      return;
    }
    
    // Guard against multiple simultaneous sign-in attempts
    if (authStatus !== 'idle') {
      console.log('[Auth] Sign-in already in progress - skipping');
      return;
    }

    const walletAddress = wallet.address;
    
    setAuthStatus('awaiting-signature');
    setErrorMessage('');
    setShowFeedback(true);

    // Trigger signature directly - no pre-check to avoid double wallet prompts
    signInWithWallet(walletAddress)
      .then(() => {
        console.log('[Auth] Successfully signed in');
        
        // Cache auth in both localStorage (survives app close) and sessionStorage (performance)
        const authCacheKey = `nimagent_auth_cache_${walletAddress}`;
        const sessionAuthKey = `nimagent_session_authenticated_${walletAddress}`;
        
        // Cache for 23 hours (less than server's 24h to avoid edge cases)
        const expiresAt = Date.now() + (23 * 60 * 60 * 1000);
        localStorage.setItem(authCacheKey, JSON.stringify({
          authenticated: true,
          expiresAt
        }));
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
  }, [wallet.address, authStatus]);

  // Expose sign-in function globally for UI components to call
  // Use useRef to avoid recreating the function on every wallet.address change
  const handleSignInRef = useRef(handleSignIn);
  
  useEffect(() => {
    handleSignInRef.current = handleSignIn;
  }, [handleSignIn]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__triggerManualAuth = () => handleSignInRef.current();
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__triggerManualAuth;
      }
    };
  }, []); // Empty deps - only set up once

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
            : 'border-amber-300/80 dark:border-gold/25 bg-[#E9B213]/10 dark:bg-[#1c1200] pointer-events-none'
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
              <p className="text-[10px] text-[#E9B213] dark:text-gold/70 mt-0.5">
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
