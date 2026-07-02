// Wallet facade — resolves the Nimiq Pay mini-app adapter and exposes a stable API.
//
// The exported functions keep the same signatures the app already used with
// `@/lib/nimiq-hub`, so call sites (store, ActionCard) need only swap the
// import path.

import type { WalletAdapter, SignResult, NetworkState } from './types';
import { isInsideNimiqPay } from './detect';

let adapterPromise: Promise<WalletAdapter> | null = null;

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
    adapterPromise = resolveAdapter();
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
  const adapter = await getWalletAdapter();
  return adapter.getUserAddress();
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
 * Send a NIM payment. Signature matches the legacy helper:
 *   requestPayment(recipient, amountLuna, context, memo?, sender?)
 * `context` and `memo` are combined into the transaction data (as before).
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
  const networkState = await adapter.getNetworkState();
  if (!networkState.consensusEstablished) {
    throw new Error('Nimiq Pay is still syncing with the Nimiq network. Please wait a moment and try again.');
  }

  return adapter.requestPayment({
    recipient: recipientAddress,
    value: amountLuna,
    data,
    ...(networkState.blockNumber != null ? { validityStartHeight: networkState.blockNumber } : {}),
    sender: senderAddress,
  });
}

/** Sign a message for identity verification. */
export async function signMessage(message: string, signerAddress?: string): Promise<SignResult> {
  const adapter = await getWalletAdapter();
  return adapter.signMessage(message, signerAddress);
}

export type { WalletAdapter, WalletKind, PaymentRequest, SignResult } from './types';
