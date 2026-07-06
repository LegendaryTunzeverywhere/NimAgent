/**
 * React Hook for Wallet Authentication
 * 
 * Provides authentication state and methods for React components
 */

import { useState, useEffect, useCallback } from 'react';
import {
  signInWithWallet,
  signOut,
  checkAuthStatus,
  isNimiqPayMiniApp,
} from '@/lib/auth';

interface AuthState {
  authenticated: boolean;
  wallet?: string;
  expiresAt?: string;
  loading: boolean;
  error?: string;
}

interface UseWalletAuthReturn extends AuthState {
  signIn: (walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isNimiqPay: boolean;
}

/**
 * Hook for managing wallet authentication state
 * 
 * @param autoCheck - Whether to automatically check auth status on mount (default: true)
 * @returns Authentication state and methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { authenticated, wallet, signIn, logout, loading } = useWalletAuth();
 * 
 *   if (loading) return <div>Loading...</div>;
 * 
 *   if (!authenticated) {
 *     return <button onClick={() => signIn(myWalletAddress)}>Sign In</button>;
 *   }
 * 
 *   return <div>Welcome, {wallet}! <button onClick={logout}>Sign Out</button></div>;
 * }
 * ```
 */
export function useWalletAuth(autoCheck = true): UseWalletAuthReturn {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    loading: autoCheck, // Only show loading if auto-checking
    error: undefined,
  });

  const isNimiqPay = isNimiqPayMiniApp();

  /**
   * Check current authentication status
   */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const session = await checkAuthStatus();
      setState({
        authenticated: session.authenticated,
        wallet: session.wallet,
        expiresAt: session.expiresAt,
        loading: false,
        error: undefined,
      });
    } catch (err) {
      console.error('[useWalletAuth] Failed to check auth status:', err);
      setState({
        authenticated: false,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to check authentication',
      });
    }
  }, []);

  /**
   * Sign in with wallet address
   */
  const signIn = useCallback(async (walletAddress: string) => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const session = await signInWithWallet(walletAddress);
      setState({
        authenticated: session.authenticated,
        wallet: session.wallet,
        expiresAt: session.expiresAt,
        loading: false,
        error: undefined,
      });
    } catch (err) {
      console.error('[useWalletAuth] Sign-in failed:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Sign-in failed',
      }));
      throw err;
    }
  }, []);

  /**
   * Sign out
   */
  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      await signOut();
      setState({
        authenticated: false,
        wallet: undefined,
        expiresAt: undefined,
        loading: false,
        error: undefined,
      });
    } catch (err) {
      console.error('[useWalletAuth] Sign-out failed:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Sign-out failed',
      }));
      throw err;
    }
  }, []);

  /**
   * Auto-check authentication status on mount
   */
  useEffect(() => {
    if (autoCheck) {
      refresh();
    }
  }, [autoCheck, refresh]);

  return {
    authenticated: state.authenticated,
    wallet: state.wallet,
    expiresAt: state.expiresAt,
    loading: state.loading,
    error: state.error,
    signIn,
    logout,
    refresh,
    isNimiqPay,
  };
}

/**
 * Hook for requiring authentication - redirects/prompts if not authenticated
 * 
 * @param requiredWallet - The wallet address that must be authenticated
 * @param onUnauthenticated - Optional callback when user is not authenticated
 * @returns Authentication state (will be authenticated or loading)
 * 
 * @example
 * ```tsx
 * function ProtectedComponent({ walletAddress }: { walletAddress: string }) {
 *   const { authenticated, loading } = useRequireAuth(walletAddress);
 * 
 *   if (loading) return <div>Authenticating...</div>;
 * 
 *   // This component only renders when authenticated
 *   return <div>Protected content for {walletAddress}</div>;
 * }
 * ```
 */
export function useRequireAuth(
  requiredWallet: string,
  onUnauthenticated?: () => void
): Pick<UseWalletAuthReturn, 'authenticated' | 'wallet' | 'loading' | 'error'> {
  const { authenticated, wallet, loading, error, signIn } = useWalletAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    async function checkAndAuthenticate() {
      // Skip if already loading or authenticating
      if (loading || isAuthenticating) return;

      // If authenticated with correct wallet, we're good
      if (authenticated && wallet === requiredWallet) return;

      // If not authenticated or wrong wallet, trigger authentication
      if (!authenticated || wallet !== requiredWallet) {
        setIsAuthenticating(true);

        try {
          if (onUnauthenticated) {
            onUnauthenticated();
          }

          // Attempt automatic sign-in
          await signIn(requiredWallet);
        } catch (err) {
          console.error('[useRequireAuth] Auto sign-in failed:', err);
        } finally {
          setIsAuthenticating(false);
        }
      }
    }

    checkAndAuthenticate();
  }, [authenticated, wallet, requiredWallet, loading, isAuthenticating, signIn, onUnauthenticated]);

  return {
    authenticated,
    wallet,
    loading: loading || isAuthenticating,
    error,
  };
}
