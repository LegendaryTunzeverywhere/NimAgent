import type { Balance } from '@/types';
import { getBalances } from './api-client';
import { getClientPlatformHeaders } from './client-platform';

type BalanceResponse = {
  nim: { balance: number; balanceUSD: number; price: number };
  totalUSD: number;
  meta?: { source: 'bff' | 'rpc-fallback' };
};

export class NimiqSyncingError extends Error {
  constructor(message = 'Nimiq Pay is still syncing with the Nimiq network. Please wait a moment.') {
    super(message);
    this.name = 'NimiqSyncingError';
  }
}

// 1 NIM = 100,000 Luna — NEVER skip this division or balance reads as zero
const NIM_LUNA = 100_000;

function getActiveNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convert to the human-friendly grouped format required by Nimiq RPC nodes.
 * Stripped addresses are rejected with "Unknown format / Invalid params".
 */
function toRpcAddress(address: string): string {
  const stripped = address.replace(/\s/g, '').toUpperCase();
  const prefix = stripped.slice(0, 4);
  const rest = stripped.slice(4);
  const groups = rest.match(/.{1,4}/g) ?? [];
  return [prefix, ...groups].join(' ');
}

function toCleanAddress(address: string): string {
  return address.replace(/\s/g, '');
}

/**
 * Wait for Nimiq Pay consensus before querying balance.
 * As per Nimiq integration guide: always wait for onConsensusEstablished
 * before running balance-check functions, otherwise you may get 0 temporarily.
 *
 * Retries up to `maxAttempts` times with 2s delay between each.
 */
async function waitForConsensus(maxAttempts = 5): Promise<void> {
  try {
    const { getNimiqNetworkState } = await import('@/lib/wallet');
    for (let i = 0; i < maxAttempts; i++) {
      const state = await getNimiqNetworkState();
      if (state.consensusEstablished) return;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new NimiqSyncingError();
  } catch (err) {
    if (err instanceof NimiqSyncingError) throw err;
    // If we can't determine consensus state, proceed anyway (best-effort)
  }
}

async function fetchNimUsdPrice(): Promise<number> {
  try {
    const platformHeaders = await getClientPlatformHeaders();
    const res = await fetch('/api/nim-price?currency=usd', {
      cache: 'no-store',
      headers: platformHeaders,
    });
    if (res.ok) {
      const data = await res.json();
      const price = asNumber(data?.price);
      if (price != null && price >= 0) return price;
    }
  } catch {
    // fall through to CoinGecko
  }

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd',
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Failed to fetch NIM price');
  const data = await res.json();
  const price = asNumber(data?.['nimiq-2']?.usd);
  if (price == null) throw new Error('Invalid NIM price response');
  return price;
}

/**
 * Fetch NIM balance via the RPC proxy.
 * Divides Luna by 100,000 to get NIM — skipping this returns 0 NIM incorrectly.
 */
async function fetchNimBalanceFromRpc(address: string): Promise<number> {
  const rpcAddress = toRpcAddress(address);
  const cleanAddress = toCleanAddress(address);
  const platformHeaders = await getClientPlatformHeaders();

  const rpcRes = await fetch('/api/nimiq-rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...platformHeaders },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getAccountByAddress',
      params: [rpcAddress],
      id: 1,
    }),
  });

  if (rpcRes.ok) {
    const rpcData = await rpcRes.json();
    // RPC response: { result: { data: { balance: <luna>, ... }, metadata: {...} } }
    const luna =
      asNumber(rpcData?.result?.data?.balance) ??
      asNumber(rpcData?.result?.balance) ??
      asNumber(rpcData?.result?.account?.balance);

    // Always divide by NIM_LUNA — raw value is in Luna, not NIM
    if (luna != null) return luna / NIM_LUNA;
  }

  if (getActiveNetwork() === 'mainnet') {
    // nimiq.watch REST API as fallback — also returns Luna
    const watchRes = await fetch(
      `https://api.nimiq.watch/account/${cleanAddress}`,
      { cache: 'no-store' }
    );
    if (watchRes.ok) {
      const watchData = await watchRes.json();
      const luna = asNumber(watchData?.balance);
      if (luna != null) return luna / NIM_LUNA;
    }
  }

  throw new Error('Failed to fetch NIM balance from public RPC');
}

/**
 * Primary balance fetch with full fallback chain:
 *
 * 1. BFF → Railway backend (most reliable, uses nimiq.watch REST internally)
 * 2. If BFF fails → wait for Nimiq consensus, then query RPC directly
 *
 * Per Nimiq integration guide:
 * - Always wait for consensusEstablished before querying
 * - Always divide Luna by 100,000 to get NIM
 * - Verify you're querying the correct address (the one holding the NIM)
 */
export async function getBalancesWithFallback(address: string): Promise<BalanceResponse> {
  // Primary path: BFF → Railway → nimiq.watch
  try {
    const data = await getBalances(address);
    // BFF returns balance already in NIM (the server divides by Luna)
    return { ...data, meta: { source: 'bff' } };
  } catch {
    // BFF unavailable — fall through to direct RPC
  }

  // Fallback path: wait for consensus, then query RPC directly
  // This handles the case where the app loaded before the blockchain peer connected
  await waitForConsensus();

  const [balance, price] = await Promise.all([
    fetchNimBalanceFromRpc(address),
    fetchNimUsdPrice().catch(() => 0),
  ]);

  const balanceUSD = balance * price;
  return {
    nim: { balance, balanceUSD, price },
    totalUSD: balanceUSD,
    meta: { source: 'rpc-fallback' },
  };
}

export function formatBalanceForUi(data: BalanceResponse): Balance {
  const nimBalance = Math.max(0, data.nim.balance || 0);
  const nimBalanceUSD = Math.max(0, data.nim.balanceUSD || 0);
  const totalUSD = Math.max(0, data.totalUSD || nimBalanceUSD);

  return {
    nim: {
      balance: nimBalance,
      balanceFormatted: nimBalance < 0.01
        ? '0.00'
        : nimBalance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      balanceUSD: nimBalanceUSD < 0.01 ? '0.00' : nimBalanceUSD.toFixed(2),
    },
    totalUSD: totalUSD < 0.01 ? '0.00' : totalUSD.toFixed(2),
  };
}
