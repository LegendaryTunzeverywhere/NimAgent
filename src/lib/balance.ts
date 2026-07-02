import type { Balance } from '@/types';
import { getBalances } from './api-client';
import { getClientPlatformHeaders } from './client-platform';

type BalanceResponse = {
  nim: { balance: number; balanceUSD: number; price: number };
  totalUSD: number;
  meta?: { source: 'provider' | 'bff' | 'rpc-fallback' };
};

// 1 NIM = 100,000 Luna
const NIM_LUNA = 100_000;

function getActiveNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function toRpcAddress(address: string): string {
  const stripped = address.replace(/\s/g, '').toUpperCase();
  const prefix = stripped.slice(0, 4);
  const rest   = stripped.slice(4);
  const groups = rest.match(/.{1,4}/g) ?? [];
  return [prefix, ...groups].join(' ');
}

function toCleanAddress(address: string): string {
  return address.replace(/\s/g, '');
}

async function fetchNimUsdPrice(): Promise<number> {
  try {
    const headers = await getClientPlatformHeaders();
    const res = await fetch('/api/nim-price?currency=usd', { cache: 'no-store', headers });
    if (res.ok) {
      const data = await res.json();
      const price = asNumber(data?.price);
      if (price != null && price >= 0) return price;
    }
  } catch { /* fall through */ }

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

async function fetchNimBalanceFromRpc(address: string): Promise<number> {
  const rpcAddress   = toRpcAddress(address);
  const cleanAddress = toCleanAddress(address);
  const headers      = await getClientPlatformHeaders();

  const rpcRes = await fetch('/api/nimiq-rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getAccountByAddress',
      params: [rpcAddress],
      id: 1,
    }),
  });

  if (rpcRes.ok) {
    const d = await rpcRes.json();
    const luna =
      asNumber(d?.result?.data?.balance) ??
      asNumber(d?.result?.balance) ??
      asNumber(d?.result?.account?.balance);
    if (luna != null) return luna / NIM_LUNA;
  }

  // nimiq.watch REST fallback (mainnet only)
  if (getActiveNetwork() === 'mainnet') {
    const watchRes = await fetch(
      `https://api.nimiq.watch/account/${cleanAddress}`,
      { cache: 'no-store' },
    );
    if (watchRes.ok) {
      const d = await watchRes.json();
      const luna = asNumber(d?.balance);
      if (luna != null) return luna / NIM_LUNA;
    }
  }

  throw new Error('Failed to fetch NIM balance from public RPC');
}

/**
 * Fetch balance with three-tier fallback:
 *
 * 1. Nimiq Pay provider RPC — the same source Nimiq Pay uses itself,
 *    already connected and synced. Returns Luna → divide by 100,000.
 * 2. BFF → Railway backend → nimiq.watch (server-side)
 * 3. Direct RPC proxy → nimiq.watch REST
 */
export async function getBalancesWithFallback(address: string): Promise<BalanceResponse> {
  const price = await fetchNimUsdPrice().catch(() => 0);

  // Tier 1: Ask the Nimiq Pay provider directly — always in sync,
  // and includes HTLC contract balances that the basic account omits.
  // (Nimiq Pay uses HTLCs for atomic swaps; basic account shows 0 during lock.)
  try {
    const { getTotalNimBalanceFromProvider } = await import('@/lib/wallet');
    const luna = await getTotalNimBalanceFromProvider(address);
    if (luna != null) {
      const nim = luna / NIM_LUNA;
      return {
        nim: { balance: nim, balanceUSD: nim * price, price },
        totalUSD: nim * price,
        meta: { source: 'provider' },
      };
    }
  } catch { /* fall through */ }

  // Tier 2: BFF → Railway
  try {
    const data = await getBalances(address);
    return { ...data, meta: { source: 'bff' } };
  } catch { /* fall through */ }

  // Tier 3: Direct RPC
  const balance    = await fetchNimBalanceFromRpc(address);
  const balanceUSD = balance * price;
  return {
    nim: { balance, balanceUSD, price },
    totalUSD: balanceUSD,
    meta: { source: 'rpc-fallback' },
  };
}

export function formatBalanceForUi(data: BalanceResponse): Balance {
  const nimBalance    = Math.max(0, data.nim.balance    || 0);
  const nimBalanceUSD = Math.max(0, data.nim.balanceUSD || 0);
  const totalUSD      = Math.max(0, data.totalUSD       || nimBalanceUSD);

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
