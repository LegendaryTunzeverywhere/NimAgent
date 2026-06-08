// API client for NimHub backend
//
// This client now uses the BFF (Backend-for-Frontend) pattern.
// Instead of calling Railway directly, it calls Next.js API routes
// which proxy requests to Railway with the API secret on the server.
//
// Flow: Browser → /api/* (Next.js) → Railway Backend
//
// Benefits:
// - API secret never exposed to browser
// - No CORS issues (same-origin requests)
// - Additional security layer

const API_URL = '/api'; // BFF proxy endpoint (same-origin)

import type { ActionCard } from '@/types';

/**
 * FIX 4 FRONTEND: Validate NIM address format client-side
 * Prevents sending invalid addresses to backend
 */
function isValidNimAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const cleaned = address.replace(/\s/g, '').toUpperCase();
  return /^NQ[0-9A-Z]{34}$/.test(cleaned);
}

/**
 * Get headers for API requests
 * No API key needed - handled by BFF layer on server
 */
function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface ChatResponse {
  message: string;
  action?: ActionCard;
  data?: any;
}

export interface Transaction {
  id: string;
  type: string;
  from_address?: string;
  to_address?: string;
  amount_luna: number;
  tx_hash?: string;
  status: string;
  created_at: string;
}

export interface Order {
  id: string;
  type: string;
  wallet_address: string;
  tx_hash?: string;
  amount_luna: number;
  details: any;
  status: string;
  fulfillment_data?: any;
  created_at: string;
  completed_at?: string;
}

/**
 * Send message to AI agent
 */
export async function chatWithAgent(
  message: string,
  history: ChatMessage[],
  walletAddress?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/agent/chat`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message, history, walletAddress }),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to chat with agent (${res.status})`);
  }
  
  return res.json();
}

/**
 * Record a transaction
 */
export async function recordTransaction(data: {
  type: string;
  fromAddress?: string;
  toAddress?: string;
  amountLuna: number;
  txHash?: string;
  status?: string;
}): Promise<Transaction> {
  const res = await fetch(`${API_URL}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    throw new Error('Failed to record transaction');
  }
  
  const result = await res.json();
  return result.transaction;
}

/**
 * Validate an order before payment
 */
export async function validateOrder(data: {
  type: string;
  details: any;
  walletAddress?: string;
}): Promise<{ valid: boolean; error?: string; quoteId?: string; expiresAt?: string; [key: string]: any }> {
  const res = await fetch(`${API_URL}/orders/validate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    throw new Error('Failed to validate order');
  }
  
  return res.json();
}

/**
 * Create and fulfill an order. The backend verifies the on-chain payment
 * to the service wallet before releasing any goods.
 */
export async function createOrder(data: {
  type: string;
  txHash: string;
  amountLuna: number;
  details: any;
  walletAddress: string;
  quoteId?: string;
}): Promise<any> {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Surface the backend's specific reason (payment unverified, replay, etc.)
    throw new Error(body?.error || body?.message || `Order failed (${res.status})`);
  }

  return body;
}

/**
 * Get order history for a wallet
 */
export async function getOrders(walletAddress: string): Promise<Order[]> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/orders?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch orders');
  }
  
  const result = await res.json();
  return result.orders;
}

/**
 * Get wallet balances
 */
export async function getBalances(address: string): Promise<{
  nim: { balance: number; balanceUSD: number; price: number };
  reloadly: { balance: number; currency: string };
  totalUSD: number;
}> {
  const cleanAddress = address.replace(/\s/g, '');
  const res = await fetch(`${API_URL}/balances/${cleanAddress}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch balances');
  }
  
  return res.json();
}

/**
 * Save a chat message to history
 */
export async function saveChatMessage(data: {
  walletAddress: string;
  sessionId: string;
  role: 'user' | 'ai';
  content: string;
  action?: ActionCard;
}): Promise<void> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(data.walletAddress)) {
    console.error('[API Client] Invalid wallet address format:', data.walletAddress.slice(0, 10));
    throw new Error('Invalid NIM wallet address format');
  }
  
  // Validate sessionId format (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!data.sessionId || !uuidRegex.test(data.sessionId)) {
    console.error('[API Client] Invalid sessionId format:', data.sessionId?.slice(0, 20));
    throw new Error('Invalid session ID format');
  }
  
  const res = await fetch(`${API_URL}/chat/history`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API Client] Failed to save chat message:', res.status, errorBody);
    throw new Error(errorBody.error || 'Failed to save chat message');
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(sessionId: string, walletAddress: string): Promise<any[]> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/chat/history/${sessionId}?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch chat history');
  }
  
  const result = await res.json();
  return result.messages;
}

/**
 * Get all chat sessions for a wallet
 */
export async function getChatSessions(walletAddress: string): Promise<any[]> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/chat/sessions?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch chat sessions');
  }
  
  const result = await res.json();
  return result.sessions;
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string, walletAddress: string): Promise<void> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/chat/history/${sessionId}?wallet=${encodeURIComponent(walletAddress)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete chat session');
  }
}


// ============================================================================
// SAVED ADDRESSES / CONTACT BOOK API
// ============================================================================

export interface SavedAddress {
  id: string;
  wallet_address: string;
  nickname: string;
  recipient_address: string;
  category: 'personal' | 'merchant' | 'friend' | 'family' | 'other';
  notes?: string;
  transaction_count: number;
  last_used_at?: string;
  created_at: string;
}

/**
 * Get all saved addresses for a wallet
 */
export async function getSavedAddresses(walletAddress: string): Promise<SavedAddress[]> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch saved addresses');
  }
  
  const result = await res.json();
  return result.addresses || [];
}

/**
 * Save a new address with nickname
 */
export async function saveAddress(data: {
  wallet: string;
  nickname: string;
  recipientAddress: string;
  category?: 'personal' | 'merchant' | 'friend' | 'family' | 'other';
  notes?: string;
}): Promise<{ success: boolean; address?: SavedAddress; error?: string; message?: string }> {
  if (!isValidNimAddress(data.wallet)) {
    throw new Error('Invalid wallet address format');
  }
  
  if (!isValidNimAddress(data.recipientAddress)) {
    throw new Error('Invalid recipient address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  const result = await res.json();
  
  if (!res.ok) {
    throw new Error(result.error || 'Failed to save address');
  }
  
  return result;
}

/**
 * Update a saved address
 */
export async function updateSavedAddress(
  id: string,
  wallet: string,
  updates: {
    nickname?: string;
    category?: string;
    notes?: string;
  }
): Promise<{ success: boolean; address?: SavedAddress; error?: string }> {
  if (!isValidNimAddress(wallet)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ wallet, ...updates }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = 'Failed to update address';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  const result = await res.json();
  return result;
}

/**
 * Delete a saved address
 */
export async function deleteSavedAddress(id: string, wallet: string): Promise<void> {
  if (!isValidNimAddress(wallet)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses/${id}?wallet=${encodeURIComponent(wallet)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    const result = await res.json().catch(() => ({ error: 'Failed to delete address' }));
    throw new Error(result.error || 'Failed to delete address');
  }
}

/**
 * Find address by nickname (for AI lookups)
 */
export async function findAddressByNickname(wallet: string, nickname: string): Promise<{
  success: boolean;
  found: boolean;
  address?: SavedAddress;
  suggestions?: SavedAddress[];
  error?: string;
}> {
  if (!isValidNimAddress(wallet)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses/find?wallet=${encodeURIComponent(wallet)}&nickname=${encodeURIComponent(nickname)}`, {
    headers: getHeaders(),
  });
  
  const result = await res.json();
  
  if (!res.ok) {
    throw new Error(result.error || 'Failed to find address');
  }
  
  return result;
}

/**
 * Get frequently used addresses
 */
export async function getFrequentAddresses(wallet: string, limit: number = 5): Promise<SavedAddress[]> {
  if (!isValidNimAddress(wallet)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/saved-addresses/frequent?wallet=${encodeURIComponent(wallet)}&limit=${limit}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch frequent addresses');
  }
  
  const result = await res.json();
  return result.addresses || [];
}


// ============================================================================
// STAKING API
// ============================================================================

export interface Validator {
  address: string;
  name: string;
  description?: string;
  fee: number;
  payoutType: string;
  payoutSchedule: string;
  trustScore: number;
  totalStake: number;
  stakers: number;
  isPool: boolean;
  website?: string;
  logo?: string;
}

export interface StakerInfo {
  address: string;
  balance: number;
  activeStake?: number;
  inactiveStake?: number;
  retired?: boolean;
}

/**
 * Get list of validators
 */
export async function getValidators(): Promise<Validator[]> {
  const res = await fetch(`${API_URL}/staking/validators`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch validators');
  }
  
  const result = await res.json();
  return result.validators || [];
}

/**
 * Get staker information for an address
 */
export async function getStakerInfo(address: string): Promise<StakerInfo | null> {
  if (!isValidNimAddress(address)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const cleanAddress = address.replace(/\s/g, '');
  const res = await fetch(`${API_URL}/staking/staker/${cleanAddress}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch staker info');
  }
  
  return res.json();
}

/**
 * Get staking APY
 */
export async function getStakingAPY(): Promise<number> {
  const res = await fetch(`${API_URL}/staking/apy`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch staking APY');
  }
  
  const result = await res.json();
  return result.apy || 8;
}

/**
 * Record a staking transaction
 */
export async function recordStakingTransaction(data: {
  walletAddress: string;
  validatorAddress: string;
  amountLuna: number;
  txHash: string;
  action: 'stake' | 'unstake' | 'withdraw';
}): Promise<{ success: boolean; transaction?: any; error?: string }> {
  if (!isValidNimAddress(data.walletAddress)) {
    throw new Error('Invalid wallet address format');
  }
  
  if (!isValidNimAddress(data.validatorAddress)) {
    throw new Error('Invalid validator address format');
  }
  
  const res = await fetch(`${API_URL}/staking/record`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  const result = await res.json();
  
  if (!res.ok) {
    throw new Error(result.error || 'Failed to record staking transaction');
  }
  
  return result;
}


// ============================================================================
// SERVICES DISCOVERY API
// ============================================================================

/**
 * Get available services for a country
 */
export async function getCountryServices(
  country: string,
  type?: 'bill' | 'airtime' | 'giftcard' | 'all'
): Promise<any> {
  const res = await fetch(`${API_URL}/services/${country.toUpperCase()}${type ? `?type=${type}` : ''}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch country services');
  }
  
  return res.json();
}

// ============================================================================
// CRYPTO SWAP API
// ============================================================================

/**
 * Get current swap rates
 */
export async function getSwapRates(): Promise<any> {
  const res = await fetch(`${API_URL}/swap/rates`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch swap rates');
  }
  
  return res.json();
}

/**
 * Get swap quote: NIM → BTC
 */
export async function getSwapQuoteNIMtoBTC(nimAmount: number): Promise<any> {
  const res = await fetch(`${API_URL}/swap/quote/nim-to-btc`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ nimAmount }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to get NIM→BTC quote');
  }
  
  return res.json();
}

/**
 * Get swap quote: BTC → NIM
 */
export async function getSwapQuoteBTCtoNIM(btcAmount: number): Promise<any> {
  const res = await fetch(`${API_URL}/swap/quote/btc-to-nim`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ btcAmount }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to get BTC→NIM quote');
  }
  
  return res.json();
}

/**
 * Get swap rate for a specific pair
 */
export async function getSwapRate(from: string, to: string): Promise<any> {
  const res = await fetch(`${API_URL}/swap/rate/${from.toUpperCase()}/${to.toUpperCase()}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to get swap rate');
  }
  
  return res.json();
}

// ============================================================================
// COINIFY (BUY NIM) API  
// ============================================================================

/**
 * Get a quote for buying NIM with fiat
 */
export async function getCoinifyQuote(amountFiat: number, currency: string): Promise<any> {
  const res = await fetch(`${API_URL}/coinify/quote`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ amountFiat, currency }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to get Coinify quote');
  }
  
  return res.json();
}

/**
 * Initiate KYC process
 */
export async function initiateCoinifyKYC(email: string, walletAddress: string): Promise<any> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/coinify/initiate-kyc`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, walletAddress }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to initiate KYC');
  }
  
  return res.json();
}

/**
 * Verify email code
 */
export async function verifyCoinifyCode(email: string, code: string, walletAddress: string): Promise<any> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }
  
  const res = await fetch(`${API_URL}/coinify/verify-code`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, code, walletAddress }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to verify code');
  }
  
  return res.json();
}

/**
 * Create a Coinify trade
 */
export async function createCoinifyTrade(data: {
  quoteId: string;
  email: string;
  walletAddress: string;
  nimAddress: string;
}): Promise<any> {
  if (!isValidNimAddress(data.walletAddress) || !isValidNimAddress(data.nimAddress)) {
    throw new Error('Invalid address format');
  }
  
  const res = await fetch(`${API_URL}/coinify/create-trade`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    throw new Error('Failed to create Coinify trade');
  }
  
  return res.json();
}

/**
 * Get trade status
 */
export async function getCoinifyTradeStatus(tradeId: string): Promise<any> {
  const res = await fetch(`${API_URL}/coinify/trade-status/${tradeId}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error('Failed to get trade status');
  }
  
  return res.json();
}
