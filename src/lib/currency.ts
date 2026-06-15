// Currency conversion utilities for NimAgent

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  NGN: '₦',
  GBP: '£',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
  INR: '₹',
};

interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache: Record<string, PriceCache> = {};
const CACHE_DURATION = 60000; // 1 minute

/**
 * Get current NIM price in specified currency
 */
export async function getNimPrice(currency: string = 'USD'): Promise<number> {
  const key = currency.toUpperCase();
  
  // Check cache
  if (priceCache[key] && Date.now() - priceCache[key].timestamp < CACHE_DURATION) {
    return priceCache[key].price;
  }
  
  // Fetch from API
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const res = await fetch(`${apiUrl}/api/nim-price?currency=${key}`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch NIM price');
  }
  
  const data = await res.json();
  priceCache[key] = { price: data.price, timestamp: Date.now() };
  
  return data.price;
}

/**
 * Convert fiat amount to Luna (1 NIM = 100,000 Luna)
 */
export async function fiatToLuna(fiatAmount: number, currency: string): Promise<number> {
  const nimPrice = await getNimPrice(currency);
  const nimAmount = fiatAmount / nimPrice;
  return Math.round(nimAmount * 100000);
}

/**
 * Convert Luna to fiat amount
 */
export async function lunaToFiat(luna: number, currency: string): Promise<string> {
  const nimPrice = await getNimPrice(currency);
  const nim = luna / 100000;
  return (nim * nimPrice).toFixed(2);
}

/**
 * Format Luna as human-readable NIM
 */
export function formatNIM(luna: number): string {
  return (luna / 100000).toFixed(2) + ' NIM';
}

/**
 * Format fiat amount with currency symbol
 */
export function formatFiat(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Convert NIM to Luna
 */
export function nimToLuna(nim: number): number {
  return Math.round(nim * 100000);
}

/**
 * Convert Luna to NIM
 */
export function lunaToNim(luna: number): number {
  return luna / 100000;
}