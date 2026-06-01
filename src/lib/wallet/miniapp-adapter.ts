// Mini-app adapter — runs inside the Nimiq Pay app.
//
// Wallet operations go through the injected Nimiq provider obtained via the
// Mini App SDK init() helper. There is no popup: every sensitive action
// triggers a native Nimiq Pay confirmation dialog, so no gesture/prewarm
// workaround is needed.

import type { ErrorResponse, NimiqProvider, SignatureResult } from '@nimiq/mini-app-sdk';
import type { WalletAdapter, PaymentRequest, SignResult } from './types';
import { getNimiqProvider } from './detect';

const APP_NAME = 'NimHub';

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
    throw new Error(value.error.message || 'Wallet request was rejected.');
  }
  return value;
}

async function provider(): Promise<NimiqProvider> {
  const p = await getNimiqProvider();
  if (!p) throw new Error('Nimiq Pay provider unavailable. Open NimHub inside the Nimiq Pay app.');
  return p;
}

export const miniAppAdapter: WalletAdapter = {
  kind: 'miniapp',

  prewarm() {
    // No popup to warm; just kick off provider resolution so the first call
    // doesn't pay the init() cost. Best-effort.
    void getNimiqProvider().catch(() => {/* ignore */});
  },

  async getUserAddress(): Promise<string> {
    const nimiq = await provider();
    const accounts = unwrap(await nimiq.listAccounts());
    if (!accounts.length) throw new Error('No Nimiq account available in Nimiq Pay.');
    return accounts[0];
  },

  async requestPayment(req: PaymentRequest): Promise<string> {
    const nimiq = await provider();

    // Use the data-carrying variant when a memo/context is supplied, matching
    // the Hub adapter's extraData behavior. The backend verifies recipient +
    // value by tx hash and ignores the data, so either path fulfills orders.
    const txHash = req.data
      ? unwrap(
          await nimiq.sendBasicTransactionWithData({
            recipient: req.recipient,
            value: req.value,
            data: req.data,
            ...(req.fee != null ? { fee: req.fee } : {}),
          }),
        )
      : unwrap(
          await nimiq.sendBasicTransaction({
            recipient: req.recipient,
            value: req.value,
            ...(req.fee != null ? { fee: req.fee } : {}),
          }),
        );

    return txHash;
  },

  async signMessage(message: string): Promise<SignResult> {
    const nimiq = await provider();
    const result = unwrap<SignatureResult>(await nimiq.sign(message));
    return { publicKey: result.publicKey, signature: result.signature };
  },
};

// APP_NAME kept for parity/future use (native dialogs label the app themselves).
void APP_NAME;