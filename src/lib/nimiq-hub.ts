<<<<<<< HEAD
// DEPRECATED shim — kept for backward compatibility.
//
// Wallet logic now lives in `@/lib/wallet`, which auto-selects between the
// Nimiq Pay mini-app provider and the Hub popup. Import from `@/lib/wallet`
// going forward. This file just re-exports the facade.

export {
  getUserAddress,
  requestPayment,
  signMessage,
  prewarmHub,
  getWalletAdapter,
  getWalletKind,
} from '@/lib/wallet';

import { getWalletAdapter } from '@/lib/wallet';

/**
 * Legacy helper retained for compatibility. The Hub adapter cached the chosen
 * address internally; the app now keeps the address in the Zustand store, so
 * this returns null. Use the store's `wallet.address` instead.
 */
export function getCachedAddress(): string | null {
  return null;
}

/**
 * Legacy cashlink payment-request helper. Not supported by the mini-app
 * provider; only meaningful in Hub mode. Kept as a no-throw stub to avoid
 * breaking older imports. Prefer building receive flows via QR / address.
 */
export async function createPaymentRequest(): Promise<string> {
  void getWalletAdapter; // keep import referenced
  throw new Error('createPaymentRequest is no longer supported. Use a QR/address receive flow.');
}
=======
// DEPRECATED shim — kept for backward compatibility.
//
// Wallet logic now lives in `@/lib/wallet`, which auto-selects between the
// Nimiq Pay mini-app provider and the Hub popup. Import from `@/lib/wallet`
// going forward. This file just re-exports the facade.

export {
  getUserAddress,
  requestPayment,
  signMessage,
  prewarmHub,
  getWalletAdapter,
  getWalletKind,
} from '@/lib/wallet';

import { getWalletAdapter } from '@/lib/wallet';

/**
 * Legacy helper retained for compatibility. The Hub adapter cached the chosen
 * address internally; the app now keeps the address in the Zustand store, so
 * this returns null. Use the store's `wallet.address` instead.
 */
export function getCachedAddress(): string | null {
  return null;
}

/**
 * Legacy cashlink payment-request helper. Not supported by the mini-app
 * provider; only meaningful in Hub mode. Kept as a no-throw stub to avoid
 * breaking older imports. Prefer building receive flows via QR / address.
 */
export async function createPaymentRequest(): Promise<string> {
  void getWalletAdapter; // keep import referenced
  throw new Error('createPaymentRequest is no longer supported. Use a QR/address receive flow.');
}
>>>>>>> fe7c71977bd3a17b2432805024c7c963bcd1e6b5
