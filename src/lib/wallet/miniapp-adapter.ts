// Mini-app adapter — runs inside the Nimiq Pay app.
//
// Wallet operations go through the injected Nimiq provider obtained via the
// Mini App SDK init() helper. There is no popup: every sensitive action
// triggers a native Nimiq Pay confirmation dialog, so no gesture/prewarm
// workaround is needed.

import type { ErrorResponse, NimiqProvider, SignatureResult } from '@nimiq/mini-app-sdk';
import type { WalletAdapter, PaymentRequest, SignResult, NetworkState } from './types';
import { getNimiqProvider } from './detect';

const APP_NAME = 'NimAgent';

/** Narrow the `T | ErrorResponse` union the provider returns. */
function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ErrorResponse).error?.message === 'string'
  );
}

function unwrap<T>(value: T | ErrorResponse): T {
  if (isErrorResponse(value)) {
    console.error('[miniapp-adapter] Error response:', value);
    throw new Error(value.error.message || 'Wallet request was rejected.');
  }
  return value;
}

async function provider(): Promise<NimiqProvider> {
  console.log('[miniapp-adapter] Getting provider...');
  const p = await getNimiqProvider();
  if (!p) throw new Error('Nimiq Pay provider unavailable. Open NimAgent inside the Nimiq Pay app.');
  console.log('[miniapp-adapter] Provider obtained!');
  return p;
}

export const miniAppAdapter: WalletAdapter = {
  kind: 'miniapp',

  prewarm() {
    // No popup to warm; just kick off provider resolution so the first call
    // doesn't pay the init() cost. Best-effort.
    console.log('[miniapp-adapter] Prewarming...');
    void getNimiqProvider().catch(() => {/* ignore */});
  },

  async getUserAddress(): Promise<string> {
    console.log('[miniapp-adapter] getUserAddress called');
    const nimiq = await provider();
    console.log('[miniapp-adapter] Listing accounts...');
    const accounts = unwrap(await nimiq.listAccounts());
    console.log('[miniapp-adapter] Accounts:', accounts);
    if (!accounts.length) throw new Error('No Nimiq account available in Nimiq Pay.');

    // If only one account, return it immediately.
    if (accounts.length === 1) return accounts[0];

    // Multiple accounts: pick the one with the highest on-chain balance so
    // we always connect to the funded wallet, not an empty secondary account.
    try {
      const balanceResults = await Promise.all(
        accounts.map(async (addr) => {
          try {
            const clean = addr.replace(/\s/g, '');
            const res = await fetch(`https://api.nimiq.watch/account/${clean}`, {
              cache: 'no-store',
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return { addr, balance: 0 };
            const data = await res.json();
            return { addr, balance: Number(data?.balance ?? 0) };
          } catch {
            return { addr, balance: 0 };
          }
        })
      );

      balanceResults.sort((a, b) => b.balance - a.balance);
      console.log('[miniapp-adapter] Account balances:', balanceResults);
      return balanceResults[0].addr;
    } catch {
      // Fallback: return first account if balance check fails
      return accounts[0];
    }
  },

  async requestPayment(req: PaymentRequest): Promise<string> {
    console.log('[miniapp-adapter] requestPayment called with req:', req);
    const nimiq = await provider();
    console.log('[miniapp-adapter] Provider ready, sending transaction...');

    // Use the data-carrying variant when a memo/context is supplied, matching
    // the Hub adapter's extraData behavior. The backend verifies recipient +
    // value by tx hash and ignores the data, so either path fulfills orders.
    let txHash;
    try {
      txHash = req.data
        ? unwrap(
            await nimiq.sendBasicTransactionWithData({
              recipient: req.recipient,
              value: req.value,
              data: req.data,
              ...(req.fee != null ? { fee: req.fee } : {}),
              ...(req.validityStartHeight != null ? { validityStartHeight: req.validityStartHeight } : {}),
            }),
          )
        : unwrap(
            await nimiq.sendBasicTransaction({
              recipient: req.recipient,
              value: req.value,
              ...(req.fee != null ? { fee: req.fee } : {}),
              ...(req.validityStartHeight != null ? { validityStartHeight: req.validityStartHeight } : {}),
            }),
          );
    } catch (err) {
      console.error('[miniapp-adapter] Transaction failed:', err);
      throw err;
    }

    console.log('[miniapp-adapter] Transaction sent, hash:', txHash);
    return txHash;
  },

  async signMessage(message: string): Promise<SignResult> {
    console.log('[miniapp-adapter] signMessage called, message length:', message.length);
    const nimiq = await provider();
    const result = unwrap<SignatureResult>(await nimiq.sign(message));
    // Log key details so we can diagnose server-side verification failures
    console.log('[miniapp-adapter] sign result:', {
      publicKeyLength: result.publicKey?.length,
      signatureLength: result.signature?.length,
      publicKeyPrefix: result.publicKey?.substring(0, 16),
      signaturePrefix: result.signature?.substring(0, 16),
    });
    return { publicKey: result.publicKey, signature: result.signature };
  },

  async getNetworkState(): Promise<NetworkState> {
    const nimiq = await provider();
    const consensusEstablished = unwrap(await nimiq.isConsensusEstablished());
    let blockNumber: number | null = null;

    if (consensusEstablished) {
      try {
        const currentHeight = unwrap(await nimiq.getBlockNumber());
        blockNumber = typeof currentHeight === 'number' ? currentHeight : null;
      } catch {
        blockNumber = null;
      }
    }

    return {
      consensusEstablished,
      blockNumber,
    };
  },
};

// APP_NAME kept for parity/future use (native dialogs label the app themselves).
void APP_NAME;
