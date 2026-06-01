// Hub adapter — standalone web build.
//
// Wraps @nimiq/hub-api (the Nimiq Hub popup). This is the original NimHub
// wallet behavior, kept intact so the app still works outside Nimiq Pay.

import type { WalletAdapter, PaymentRequest, SignResult } from './types';

const HUB_URL = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com';
const APP_NAME = 'NimHub';

let hubApiInstance: any = null;
let cachedAddress: string | null = null;

async function getHubApi() {
  if (hubApiInstance) return hubApiInstance;
  if (typeof window === 'undefined') {
    throw new Error('Hub API can only be used in the browser');
  }
  const HubApi = (await import('@nimiq/hub-api')).default;
  hubApiInstance = new HubApi(HUB_URL);
  return hubApiInstance;
}

export const hubAdapter: WalletAdapter = {
  kind: 'hub',

  prewarm() {
    // Browsers only allow the wallet popup to appear within a user gesture
    // that has no blocking async gap before it. Warming the Hub here means the
    // eventual checkout()/chooseAddress() call resolves through a microtask
    // instead of a fresh dynamic import, preserving the click's activation.
    if (typeof window !== 'undefined' && !hubApiInstance) {
      getHubApi().catch(() => {/* best-effort warm-up */});
    }
  },

  async getUserAddress(): Promise<string> {
    const hub = await getHubApi();
    const account = await hub.chooseAddress({ appName: APP_NAME });
    cachedAddress = account.address;
    return account.address;
  },

  async requestPayment(req: PaymentRequest): Promise<string> {
    const hub = await getHubApi();
    const fromAddress = req.sender || cachedAddress;

    const checkoutOptions: any = {
      appName: APP_NAME,
      recipient: req.recipient,
      value: req.value,
      fee: req.fee ?? 0,
    };
    if (req.data) checkoutOptions.extraData = req.data;
    if (fromAddress) checkoutOptions.sender = fromAddress;

    console.log('[Hub] Initiating checkout with options:', checkoutOptions);
    
    try {
      const result = await hub.checkout(checkoutOptions);
      console.log('[Hub] Checkout result:', result);
      return result.hash;
    } catch (error) {
      console.error('[Hub] Checkout error:', error);
      throw error;
    }
  },

  async signMessage(message: string, signer?: string): Promise<SignResult> {
    const hub = await getHubApi();
    const signOptions: any = { appName: APP_NAME, message };
    if (signer || cachedAddress) signOptions.signer = signer || cachedAddress;
    const result = await hub.signMessage(signOptions);
    return {
      publicKey: result?.signerPublicKey,
      signature: result?.signature,
      ...result,
    };
  },
};
