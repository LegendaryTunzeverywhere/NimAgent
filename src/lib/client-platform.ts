export const NIMIQ_PAY_PLATFORM = 'nimiq-pay-miniapp';
export const WEB_BROWSER_PLATFORM = 'web-browser';

export function getClientPlatform(): string {
  if (typeof window === 'undefined') return WEB_BROWSER_PLATFORM;
  return window.nimiqPay ? NIMIQ_PAY_PLATFORM : WEB_BROWSER_PLATFORM;
}

export function getClientPlatformHeaders(): Record<string, string> {
  const platform = getClientPlatform();
  return {
    'X-Client-Platform': platform,
    'X-Wallet-Kind': platform === NIMIQ_PAY_PLATFORM ? 'miniapp' : 'unsupported',
  };
}
