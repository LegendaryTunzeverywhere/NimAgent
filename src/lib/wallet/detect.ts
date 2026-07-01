// Runtime detection: are we running inside the Nimiq Pay mini-app WebView?
//
// Nimiq Pay injects `window.nimiqPay` (host context) before page scripts run,
// and a Nimiq provider that the SDK's init() resolves against. The most
// reliable signal is whether the SDK provider becomes ready within a timeout;
// `window.nimiqPay` gives us a fast synchronous hint.

import type { NimiqProvider } from '@nimiq/mini-app-sdk';

let cachedProvider: NimiqProvider | null = null;
let detection: Promise<boolean> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Synchronous hint that we're inside Nimiq Pay. Safe to read during init
 * because Nimiq Pay seeds `window.nimiqPay` before the page script runs.
 * Not 100% authoritative — use `isInsideNimiqPay()` to confirm the provider.
 */
export function hasNimiqPayHostHint(): boolean {
  const hasHint = typeof window !== 'undefined' && !!window.nimiqPay;
  if (typeof window !== 'undefined') {
    console.log('[detect] hasNimiqPayHostHint():', hasHint, 'window.nimiqPay:', window.nimiqPay);
  }
  return hasHint;
}

/**
 * Resolve (and cache) the injected Nimiq provider, or null if not present.
 * Detection runs once; subsequent calls return the cached result.
 */
export async function getNimiqProvider(timeout = 2500): Promise<NimiqProvider | null> {
  console.log('[detect] getNimiqProvider called, timeout:', timeout);
  if (typeof window === 'undefined') return null;
  if (cachedProvider) {
    console.log('[detect] Using cached provider');
    return cachedProvider;
  }

  try {
    console.log('[detect] Importing @nimiq/mini-app-sdk...');
    const { init } = await import('@nimiq/mini-app-sdk');
    console.log('[detect] Calling init()...');
    const provider = await init({ timeout });
    console.log('[detect] Got provider:', provider);
    cachedProvider = provider;
    return provider;
  } catch (err) {
    console.error('[detect] init() failed:', err);
    // init() rejects/times out when not running inside Nimiq Pay.
    return null;
  }
}

/**
 * True when the Nimiq Pay injected provider is available (mini-app mode).
 * Memoized so we only probe once per session.
 */
export function isInsideNimiqPay(timeout = 2500): Promise<boolean> {
  console.log('[detect] isInsideNimiqPay called');
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!detection) {
    detection = (async () => {
      const attempts = hasNimiqPayHostHint()
        ? [{ wait: 0, timeout }, { wait: 250, timeout }]
        : [{ wait: 0, timeout: 900 }, { wait: 300, timeout: 1200 }, { wait: 700, timeout: 1800 }];

      for (const attempt of attempts) {
        if (attempt.wait) await delay(attempt.wait);
        const provider = await getNimiqProvider(attempt.timeout);
        if (provider) {
          console.log('[detect] isInsideNimiqPay result: true');
          return true;
        }
      }

      console.log('[detect] isInsideNimiqPay result: false');
      return false;
    })();
  }
  return detection;
}
