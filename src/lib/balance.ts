import type { Balance } from '@/types';
import { getBalances } from './api-client';
import { getClientPlatformHeaders } from './client-platform';

type BalanceResponse = {
  nim: { balance: number; balanceUSD: number; price: number };
  totalUSD: number;
  meta?: { source: 'bff' | 'rpc-fallback' };
};

export class NimiqSyncingError extends Error {
  constructor(message = 'Nimiq Pay is still syncing with the Nimiq network.') {
    super(message);
    this.name = 'NimiqSyncingError';
  }
}

const NIM_LUNA = 100_000;

function getActiveNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convert a Nimiq address to the user-friendly grouped format required by
 * the Nimiq RPC node (e.g. "NQ07 XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX").
 *
 * The Nimiq RPC rejects stripped addresses with "Unknown format / Invalid params".
 * This must be called before any RPC `getAccountByAddress` call.
 */
function toRpcAddress(address: string): string {
  const stripped = address.replace(/\s/g, '').toUpperCase();
  // NQ + 2 check digits + 32 base-32 chars = 36 chars total
  // Group into: NQ## + 8 groups of 4
  const prefix = stripped.slice(0, 4); // NQ##
  const rest = stripped.slice(4);       // 32 chars
  const groups = rest.match(/.{1,4}/g) ?? [];
  return [prefix, ...groups].join(' ');
}

/**
 * Strip spaces for REST API endpoints that need clean addresses.
 */
function toCleanAddress(address: string): string {
  return address.replace(/\s/g, '');
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
    // Fall back to CoinGecko below.
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

async function fetchNimBalanceFromRpc(address: string): Promise<number> {
  const rpcAddress = toRpcAddress(address);
  const cleanAddress = toCleanAddress(address);
  const platformHeaders = await getClientPlatformHeaders();
  console.log('[fetchNimBalanceFromRpc] rpcAddress:', rpcAddress);

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
    console.log('[fetchNimBalanceFromRpc] RPC response:', JSON.stringify(rpcData));
    const luna =
      asNumber(rpcData?.result?.data?.balance) ??
      asNumber(rpcData?.result?.balance) ??
      asNumber(rpcData?.result?.account?.balance);

    if (luna != null) {
      console.log('[fetchNimBalanceFromRpc] luna from RPC:', luna, '=', luna / NIM_LUNA, 'NIM');
      return luna / NIM_LUNA;
    }
  }

  if (getActiveNetwork() === 'mainnet') {
    // nimiq.watch REST API accepts both stripped and spaced addresses
    const watchRes = await fetch(`https://api.nimiq.watch/account/${cleanAddress}`, { cache: 'no-store' });
    if (watchRes.ok) {
      const watchData = await watchRes.json();
      const luna = asNumber(watchData?.balance);
      if (luna != null) return luna / NIM_LUNA;
    }
  }

  throw new Error('Failed to fetch NIM balance from public RPC');
}

export async function getBalancesWithFallback(address: string): Promise<BalanceResponse> {
  try {
    console.log('[getBalancesWithFallback] trying BFF for:', address.replace(/\s/g,''));
    const data = await getBalances(address);
    console.log('[getBalancesWithFallback] BFF success:', JSON.stringify(data));
    return { ...data, meta: { source: 'bff' } };
  } catch (err: any) {
    console.warn('[getBalancesWithFallback] BFF failed:', err?.message, '— trying RPC fallback');
    try {
      const { getNimiqNetworkState } = await import('@/lib/wallet');
      const networkState = await getNimiqNetworkState();
      if (!networkState.consensusEstablished) {
        throw new NimiqSyncingError();
      }
    } catch (error) {
      if (error instanceof NimiqSyncingError) throw error;
    }

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
