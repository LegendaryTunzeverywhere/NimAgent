// Wallet facade — resolves the Nimiq Pay mini-app adapter and exposes a stable API.
//
// The exported functions keep the same signatures the app already used with
// `@/lib/nimiq-hub`, so call sites (store, ActionCard) need only swap the
// import path.

import type { WalletAdapter, SignResult, NetworkState } from './types';
import { isInsideNimiqPay } from './detect';

let adapterPromise: Promise<WalletAdapter> | null = null;

// Global lock to prevent concurrent getUserAddress calls (prevents double wallet popups)
let gettingAddress = false;
let addressPromise: Promise<string> | null = null;

/**
 * Reset the adapter cache (used for retry on cold-start failures).
 * Exported for use by store's connectWallet retry logic.
 */
export function _resetAdapterCache(): void {
  adapterPromise = null;
  gettingAddress = false;
  addressPromise = null;
}

async function resolveAdapter(): Promise<WalletAdapter> {
  const inside = await isInsideNimiqPay();
  if (!inside) {
    throw new Error('NimAgent is available only inside the Nimiq Pay app.');
  }
  const { miniAppAdapter } = await import('./miniapp-adapter');
  return miniAppAdapter;
}

/** Resolve (and cache) the active wallet adapter for this session. */
export async function getWalletAdapter(): Promise<WalletAdapter> {
  if (!adapterPromise) {
    adapterPromise = resolveAdapter().catch((error) => {
      // Reset adapterPromise on failure so retry attempts can probe fresh
      adapterPromise = null;
      throw error;
    });
  }
  return adapterPromise;
}

/** Which wallet backend is active, once resolved. Useful for UI hints. */
export async function getWalletKind(): Promise<WalletAdapter['kind']> {
  return (await getWalletAdapter()).kind;
}

/**
 * Best-effort warm-up. Kicks off provider resolution so the eventual wallet
 * call is fast inside the Nimiq Pay mini app.
 */
export function prewarmHub(): void {
  if (typeof window === 'undefined') return;
  getWalletAdapter()
    .then((adapter) => adapter.prewarm())
    .catch(() => {/* best-effort */});
}

/** Prompt the user to share/choose an account; returns the address. */
export async function getUserAddress(): Promise<string> {
  // Deduplicate concurrent calls - if already getting address, return that promise
  if (gettingAddress && addressPromise) {
    console.log('[Wallet] getUserAddress already in progress - returning existing promise');
    return addressPromise;
  }

  gettingAddress = true;
  
  addressPromise = (async () => {
    try {
      const adapter = await getWalletAdapter();
      const address = await adapter.getUserAddress();
      return address;
    } finally {
      // Reset lock after completion (success or failure)
      gettingAddress = false;
      addressPromise = null;
    }
  })();

  return addressPromise;
}

/** Read-only Nimiq wallet/network state exposed by the mini-app provider. */
export async function getNimiqNetworkState(): Promise<NetworkState> {
  const adapter = await getWalletAdapter();
  return adapter.getNetworkState();
}

/**
 * Fetch NIM balance in Luna directly from the Nimiq Pay provider's RPC.
 * Returns null if unavailable (e.g. consensus not yet established).
 */
export async function getNimBalanceFromProvider(address: string): Promise<number | null> {
  const adapter = await getWalletAdapter();
  return adapter.getNimBalance(address);
}

/**
 * Fetch total NIM balance including active outgoing HTLC contracts.
 * Nimiq Pay uses HTLCs for atomic swaps — NIM is locked in a contract
 * temporarily, making the basic account show 0 until settlement.
 */
export async function getTotalNimBalanceFromProvider(address: string): Promise<number | null> {
  const adapter = await getWalletAdapter();
  return adapter.getTotalNimBalance(address);
}

/**
 * Send a NIM payment. Waits for consensus before sending — retries with
 * offline detection and faster polling to avoid long waits.
 */
export async function requestPayment(
  recipientAddress: string,
  amountLuna: number,
  context: string,
  memo?: string,
  senderAddress?: string,
): Promise<string> {
  const adapter = await getWalletAdapter();
  const data = memo ? `${context}:${memo}` : context;

  // Check network connectivity first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  // Wait for consensus with timeout and faster retries
  const startTime = Date.now();
  const MAX_WAIT_MS = 10_000; // 10 seconds total
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    const state = await adapter.getNetworkState();
    if (state.consensusEstablished) break;
    await new Promise(r => setTimeout(r, 2000)); // 2s intervals
  }

  const final = await adapter.getNetworkState();
  if (!final.consensusEstablished) {
    throw new Error('Nimiq Pay is still syncing. Please wait and try again.');
  }

  return adapter.requestPayment({
    recipient: recipientAddress,
    value: amountLuna,
    data,
    ...(final.blockNumber != null ? { validityStartHeight: final.blockNumber } : {}),
    sender: senderAddress,
  });
}

/** Sign a message for identity verification. */
export async function signMessage(message: string, signerAddress?: string): Promise<SignResult> {
  const adapter = await getWalletAdapter();
  return adapter.signMessage(message, signerAddress);
}

export type { WalletAdapter, WalletKind, PaymentRequest, SignResult } from './types';
