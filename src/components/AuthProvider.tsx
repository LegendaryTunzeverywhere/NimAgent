'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    // Only authenticate if wallet is connected and we have an address
    if (!wallet.connected || !wallet.address) {
      return;
    }

    // TypeScript type guard - at this point wallet.address is definitely non-null
    const walletAddress = wallet.address;

    // Track if we've already attempted authentication for this wallet
    // to avoid repeated signature prompts on every render
    const authKey = `nimagent_auth_attempt_${walletAddress}`;
    const lastAttempt = sessionStorage.getItem(authKey);
    const now = Date.now();

    // If we attempted auth in the last 5 minutes, don't try again
    // (the session lasts 24 hours, but we use 5 min here to handle
    // rapid reconnects without spamming signature requests)
    if (lastAttempt && now - parseInt(lastAttempt) < 5 * 60 * 1000) {
      return;
    }

    // Check if we already have a valid session before prompting for signature
    checkAuthStatus()
      .then((status) => {
        // If already authenticated with the correct wallet, don't re-prompt
        if (status.authenticated && status.wallet === walletAddress) {
          console.log('[Auth] Already authenticated with valid session');
          sessionStorage.setItem(authKey, now.toString());
          return;
        }

        // No valid session - trigger authentication
        return signInWithWallet(walletAddress)
          .then(() => {
            console.log('[Auth] Wallet authenticated successfully');
            sessionStorage.setItem(authKey, now.toString());
          })
          .catch((error) => {
            console.error('[Auth] Authentication failed:', error);
            // Don't retry immediately - the next page navigation or reconnect will trigger another attempt
          });
      })
      .catch((error) => {
        console.error('[Auth] Session check failed:', error);
        // If session check fails, don't attempt sign-in (might be network issue)
      });
  }, [wallet.connected, wallet.address]);

  // This component renders nothing - it's just for the authentication side effect
  return null;
}
