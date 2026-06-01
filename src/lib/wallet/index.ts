// Wallet facade — picks the right adapter at runtime and exposes a stable API.
//
// Detection: if the Nimiq Pay injected provider is available we use the
// mini-app adapter; otherwise we fall back to the Hub popup adapter. The
// chosen adapter is memoized for the session.
//
// The exported functions keep the same signatures the app already used with
// `@/lib/nimiq-hub`, so call sites (store, ActionCard) need only swap the
// import path.

import type { WalletAdapter, SignResult } from './types';
import { isInsideNimiqPay } from './detect';

let adapterPromise: Promise<WalletAdapter> | null = null;

async function resolveAdapter(): Promise<WalletAdapter> {
  const inside = await isInsideNimiqPay();
  if (inside) {
    const { miniAppAdapter } = await import('./miniapp-adapter');
    return miniAppAdapter;
  }
  const { hubAdapter } = await import('./hub-adapter');
  return hubAdapter;
}

/** Resolve (and cache) the active wallet adapter for this session. */
export function getWalletAdapter(): Promise<WalletAdapter> {
  if (!adapterPromise) adapterPromise = resolveAdapter();
  return adapterPromise;
}

/** Which wallet backend is active, once resolved. Useful for UI hints. */
export async function getWalletKind(): Promise<WalletAdapter['kind']> {
  return (await getWalletAdapter()).kind;
}

/**
 * Best-effort warm-up. Kicks off adapter detection immediately and warms the
 * underlying provider/popup so the eventual wallet call is fast and (in Hub
 * mode) keeps the click's user-activation.
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

/**
 * Send a NIM payment. Signature matches the legacy Hub helper:
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
  return adapter.requestPayment({
    recipient: recipientAddress,
    value: amountLuna,
    data,
    fee: 0,
    sender: senderAddress,
  });
}

/** Sign a message for identity verification. */
export async function signMessage(message: string, signerAddress?: string): Promise<SignResult> {
  const adapter = await getWalletAdapter();
  return adapter.signMessage(message, signerAddress);
}

export type { WalletAdapter, WalletKind, PaymentRequest, SignResult } from './types';
