// Runtime detection: are we running inside the Nimiq Pay mini-app WebView?
//
// Nimiq Pay injects `window.nimiqPay` (host context) before page scripts run,
// and a Nimiq provider that the SDK's init() resolves against. The most
// reliable signal is whether the SDK provider becomes ready within a timeout;
// `window.nimiqPay` gives us a fast synchronous hint.

import type { NimiqProvider } from '@nimiq/mini-app-sdk';

let cachedProvider: NimiqProvider | null = null;
let detection: Promise<boolean> | null = null;

/**
 * Synchronous hint that we're inside Nimiq Pay. Safe to read during init
 * because Nimiq Pay seeds `window.nimiqPay` before the page script runs.
 * Not 100% authoritative — use `isInsideNimiqPay()` to confirm the provider.
 */
export function hasNimiqPayHostHint(): boolean {
  return typeof window !== 'undefined' && !!window.nimiqPay;
}

/**
 * Resolve (and cache) the injected Nimiq provider, or null if not present.
 * Detection runs once; subsequent calls return the cached result.
 */
export async function getNimiqProvider(timeout = 2500): Promise<NimiqProvider | null> {
  if (typeof window === 'undefined') return null;
  if (cachedProvider) return cachedProvider;

  try {
    const { init } = await import('@nimiq/mini-app-sdk');
    const provider = await init({ timeout });
    cachedProvider = provider;
    return provider;
  } catch {
    // init() rejects/times out when not running inside Nimiq Pay.
    return null;
  }
}

/**
 * True when the Nimiq Pay injected provider is available (mini-app mode).
 * Memoized so we only probe once per session.
 */
export function isInsideNimiqPay(timeout = 2500): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!detection) {
    // If there's no host hint, skip the full timeout — fail fast to Hub mode.
    const probeTimeout = hasNimiqPayHostHint() ? timeout : 600;
    detection = getNimiqProvider(probeTimeout).then((p) => p !== null);
  }
  return detection;
}
