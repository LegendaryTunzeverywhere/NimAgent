import type { Balance } from '@/types';
import { getBalances } from './api-client';
import { getClientPlatformHeaders } from './client-platform';

type BalanceResponse = {
  nim: { balance: number; balanceUSD: number; price: number };
  reloadly?: { balance: number; currency: string };
  totalUSD: number;
  meta?: { source: 'bff' | 'rpc-fallback' };
};

const NIM_LUNA = 100_000;

function getActiveNetwork(): 'mainnet' | 'testnet' {
  return process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
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
  const cleanAddress = address.replace(/\s/g, '');
  const platformHeaders = await getClientPlatformHeaders();

  const rpcRes = await fetch('/api/nimiq-rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...platformHeaders },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getAccountByAddress',
      params: [cleanAddress],
      id: 1,
    }),
  });

  if (rpcRes.ok) {
    const rpcData = await rpcRes.json();
    const luna =
      asNumber(rpcData?.result?.balance) ??
      asNumber(rpcData?.result?.data?.balance) ??
      asNumber(rpcData?.result?.account?.balance);

    if (luna != null) return luna / NIM_LUNA;
  }

  if (getActiveNetwork() === 'mainnet') {
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
    const data = await getBalances(address);
    return { ...data, meta: { source: 'bff' } };
  } catch {
    const [balance, price] = await Promise.all([
      fetchNimBalanceFromRpc(address),
      fetchNimUsdPrice().catch(() => 0),
    ]);

    const balanceUSD = balance * price;
    return {
      nim: { balance, balanceUSD, price },
      reloadly: { balance: 0, currency: 'USD' },
      totalUSD: balanceUSD,
      meta: { source: 'rpc-fallback' },
    };
  }
}

export function formatBalanceForUi(data: BalanceResponse): Balance {
  const nimBalance = Math.max(0, data.nim.balance || 0);
  const nimBalanceUSD = Math.max(0, data.nim.balanceUSD || 0);
  const reloadlyBalance = Math.max(0, data.reloadly?.balance || 0);
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
    usdt: {
      balance: reloadlyBalance,
      balanceFormatted: reloadlyBalance.toFixed(2),
      balanceUSD: reloadlyBalance.toFixed(2),
      network: 'Polygon',
    },
    totalUSD: totalUSD < 0.01 ? '0.00' : totalUSD.toFixed(2),
  };
}
