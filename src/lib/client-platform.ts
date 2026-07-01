export const NIMIQ_PAY_PLATFORM = 'nimiq-pay-miniapp';
export const WEB_BROWSER_PLATFORM = 'web-browser';

import { hasNimiqPayHostHint, isInsideNimiqPay } from '@/lib/wallet/detect';

export async function getClientPlatform(): Promise<string> {
  if (typeof window === 'undefined') return WEB_BROWSER_PLATFORM;
  if (hasNimiqPayHostHint()) return NIMIQ_PAY_PLATFORM;

  try {
    return (await isInsideNimiqPay()) ? NIMIQ_PAY_PLATFORM : WEB_BROWSER_PLATFORM;
  } catch {
    return WEB_BROWSER_PLATFORM;
  }
}

export async function getClientPlatformHeaders(): Promise<Record<string, string>> {
  const platform = await getClientPlatform();
  return {
    'X-Client-Platform': platform,
    'X-Wallet-Kind': platform === NIMIQ_PAY_PLATFORM ? 'miniapp' : 'unsupported',
  };
}
