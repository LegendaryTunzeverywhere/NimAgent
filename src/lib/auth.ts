/**
 * Client-Side Wallet Authentication Utility
 * 
 * Provides a simple interface for signing in with Nimiq wallets
 * using the challenge-response authentication system.
 */

// Extend window interface for Nimiq Pay mini-app and Hub API
declare global {
  interface Window {
    nimiqPay?: {
      signMessage?: (params: SignMessageParams) => Promise<SignedMessage>;
      // Add other mini-app methods as needed
    };
    // Nimiq Hub API is typically exposed via dynamic import or script tag
    HubApi?: any;
  }
}

interface SignMessageParams {
  message: string;
  signer: string;
  appName?: string;
}

interface SignedMessage {
  signer: string;
  signerPublicKey: Uint8Array;
  signature: Uint8Array;
}

interface AuthSession {
  authenticated: boolean;
  wallet?: string;
  expiresAt?: string;
}

interface AuthChallenge {
  message: string;
  expiresAt: string;
}

/**
 * Check if running inside Nimiq Pay mini-app
 */
export function isNimiqPayMiniApp(): boolean {
  return typeof window !== 'undefined' && !!window.nimiqPay;
}

/**
 * Sign a message using either Nimiq Pay mini-app or Hub API
 */
async function signMessage(message: string, walletAddress: string): Promise<SignedMessage> {
  // Try Nimiq Pay mini-app first (if available)
  if (window.nimiqPay?.signMessage) {
    try {
      return await window.nimiqPay.signMessage({
        message,
        signer: walletAddress,
        appName: 'NimAgent',
      });
    } catch (err) {
      console.error('Nimiq Pay signMessage failed:', err);
      throw new Error('Failed to sign message with Nimiq Pay');
    }
  }

  // Fallback to Hub API (must be loaded separately)
  // The Hub API is typically loaded via CDN: <script src="https://hub.nimiq.com/v1/hub.js"></script>
  // Or via dynamic import in your application
  if (typeof window !== 'undefined' && window.HubApi) {
    try {
      const hubApi = new window.HubApi();
      return await hubApi.signMessage({
        appName: 'NimAgent',
        message,
        signer: walletAddress,
      });
    } catch (err) {
      console.error('Hub API signMessage failed:', err);
      throw new Error('Failed to sign message with Nimiq Hub');
    }
  }

  throw new Error(
    'No signing method available. Please ensure you are using Nimiq Pay or have the Hub API loaded.'
  );
}

/**
 * Request an authentication challenge from the server
 */
async function requestChallenge(walletAddress: string): Promise<AuthChallenge> {
  const response = await fetch('/api/auth/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ wallet: walletAddress }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to request challenge');
  }

  return response.json();
}

/**
 * Verify a signed challenge with the server
 */
async function verifyChallenge(
  walletAddress: string,
  signerPublicKey: string,
  signature: string
): Promise<{ success: boolean; wallet: string }> {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      wallet: walletAddress,
      signerPublicKey,
      signature,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to verify signature');
  }

  return response.json();
}

/**
 * Main sign-in function - handles full authentication flow
 * 
 * @param walletAddress - The Nimiq wallet address to authenticate
 * @returns Promise resolving to authenticated session info
 * @throws Error if authentication fails or user cancels
 */
export async function signInWithWallet(walletAddress: string): Promise<AuthSession> {
  try {
    // Step 1: Request challenge from server
    const { message, expiresAt } = await requestChallenge(walletAddress);
    
    console.log('[Auth] Challenge received, requesting signature...');

    // Step 2: Sign the message with wallet
    let signedMessage: SignedMessage;
    
    try {
      signedMessage = await signMessage(message, walletAddress);
    } catch (err) {
      console.error('[Auth] User cancelled signing or signing failed:', err);
      throw new Error('Authentication cancelled. Please try again.');
    }

    console.log('[Auth] Message signed, verifying with server...');

    // Step 3: Convert Uint8Array to hex strings for JSON transmission
    const signerPublicKey = Buffer.from(signedMessage.signerPublicKey).toString('hex');
    const signature = Buffer.from(signedMessage.signature).toString('hex');

    // Step 4: Verify signature with server
    const result = await verifyChallenge(walletAddress, signerPublicKey, signature);

    if (result.success) {
      console.log('[Auth] Authentication successful!');
      return {
        authenticated: true,
        wallet: result.wallet,
      };
    }

    throw new Error('Authentication failed');
  } catch (err) {
    console.error('[Auth] Sign-in error:', err);
    throw err;
  }
}

/**
 * Check current authentication status
 * 
 * @returns Promise resolving to current session info
 */
export async function checkAuthStatus(): Promise<AuthSession> {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    return response.json();
  } catch (err) {
    console.error('[Auth] Failed to check auth status:', err);
    return { authenticated: false };
  }
}

/**
 * Sign out and destroy session
 * 
 * @returns Promise resolving when sign-out is complete
 */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    console.log('[Auth] Signed out successfully');
  } catch (err) {
    console.error('[Auth] Sign-out error:', err);
    throw err;
  }
}

/**
 * Ensure user is authenticated before making API calls
 * Redirects to sign-in if not authenticated
 * 
 * @param walletAddress - The wallet address that should be authenticated
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export async function ensureAuthenticated(walletAddress: string): Promise<boolean> {
  const session = await checkAuthStatus();

  if (session.authenticated && session.wallet === walletAddress) {
    return true;
  }

  // Not authenticated or wrong wallet - need to sign in
  try {
    await signInWithWallet(walletAddress);
    return true;
  } catch (err) {
    console.error('[Auth] Authentication required but failed:', err);
    return false;
  }
}

/**
 * HOC/wrapper for API calls that require authentication
 * Automatically handles authentication before making the API call
 * 
 * @param apiCall - The API call function to execute
 * @param walletAddress - The wallet address that should be authenticated
 * @returns Promise resolving to the API call result
 */
export async function withAuth<T>(
  apiCall: () => Promise<T>,
  walletAddress: string
): Promise<T> {
  const isAuthenticated = await ensureAuthenticated(walletAddress);

  if (!isAuthenticated) {
    throw new Error('Authentication required but user is not signed in');
  }

  return apiCall();
}
