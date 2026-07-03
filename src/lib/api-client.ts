// API client for NimAgent backend
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
import { getClientPlatformHeaders } from '@/lib/client-platform';



// Cache signature challenges
interface CachedSignature {
  nonce: string;
  signature: string;
  publicKey: string;
  expiresAt: string;
}

interface CachedWalletSession {
  walletAddress: string;
  expiresAt: string;
}

export interface WalletRequestOptions {
  requireWalletSession?: boolean;
}

export class WalletSessionRequiredError extends Error {
  status: number;

  constructor(message = 'Reconnect your wallet to refresh protected data.', status = 401) {
    super(message);
    this.name = 'WalletSessionRequiredError';
    this.status = status;
  }
}

export function isWalletSessionRequiredError(error: unknown): error is WalletSessionRequiredError {
  return error instanceof WalletSessionRequiredError;
}

const SIGNATURE_CACHE_KEY = 'nimagent-signature-cache';
const SESSION_CACHE_KEY = 'nimagent-wallet-session';

// Load signature cache from localStorage
const signatureCache: Record<string, CachedSignature> = (() => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(SIGNATURE_CACHE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
  return {};
})();

const sessionCache: Record<string, CachedWalletSession> = (() => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(SESSION_CACHE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
  return {};
})();

// Helper to save signature cache to localStorage
function saveSignatureCache() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SIGNATURE_CACHE_KEY, JSON.stringify(signatureCache));
  }
}

function clearCachedSignature(walletAddress: string) {
  const cleanAddress = walletAddress.replace(/\s/g, '').toUpperCase();
  if (!signatureCache[cleanAddress]) return;
  delete signatureCache[cleanAddress];
  saveSignatureCache();
}

function saveSessionCache() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(sessionCache));
  }
}

function getCachedSession(walletAddress: string): CachedWalletSession | null {
  const cleanAddress = walletAddress.replace(/\s/g, '').toUpperCase();
  const cached = sessionCache[cleanAddress];
  if (!cached) return null;
  if (new Date(cached.expiresAt) <= new Date()) {
    delete sessionCache[cleanAddress];
    saveSessionCache();
    return null;
  }
  return cached;
}

function setCachedSession(walletAddress: string, expiresAt: string) {
  const cleanAddress = walletAddress.replace(/\s/g, '').toUpperCase();
  sessionCache[cleanAddress] = {
    walletAddress: cleanAddress,
    expiresAt,
  };
  saveSessionCache();
}

async function ensureWalletSession(walletAddress: string): Promise<void> {
  const cleanAddress = walletAddress.replace(/\s/g, '').toUpperCase();
  if (getCachedSession(cleanAddress)) return;
  try {
    await loginWithWallet(cleanAddress);
  } catch (err: any) {
    // Login failure must not block API calls — the session cookie path may
    // still work, and most endpoints don't strictly require a verified wallet
    // session. Log for diagnostics but proceed.
    console.warn('[api-client] Wallet session login failed (non-fatal):', err?.message);
  }
}

/**
 * Fetch CSRF token from backend
 */
async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_URL}/csrf-token`, {
    credentials: 'include',
    headers: await getClientPlatformHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = await res.json();
  return data.csrfToken || '';
}

/**
 * Fetch a signature challenge for a wallet address
 */
async function fetchChallenge(walletAddress: string): Promise<{ nonce: string; challenge: string; expiresAt: string }> {
  const res = await fetch(`${API_URL}/auth/challenge?walletAddress=${encodeURIComponent(walletAddress)}`, {
    credentials: 'include',
    headers: await getClientPlatformHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch challenge');
  }
  return res.json();
}

/**
 * Sign a challenge using the wallet
 */
async function signChallenge(challenge: string): Promise<{ signature: string; publicKey: string }> {
  const { signMessage } = await import('./wallet');
  console.log('[signChallenge] signing challenge len:', challenge.length, 'val:', challenge.substring(0, 80));
  const result = await signMessage(challenge);
  if (!result.publicKey) {
    throw new Error('Public key not returned from wallet');
  }
  return { signature: result.signature, publicKey: result.publicKey };
}

/**
 * Get or create a valid signature for a wallet address.
 * Exported so connectWallet can pre-warm the cache before parallel API calls.
 */
export async function getSignature(walletAddress: string): Promise<{ nonce: string; signature: string; publicKey: string; expiresAt: string }> {
  const cleanAddress = walletAddress.replace(/\s/g, '').toUpperCase();
  
  // Check cache for valid signature
  const cached = signatureCache[cleanAddress];
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return cached;
  }
  
  // Fetch new challenge
  const { nonce, challenge, expiresAt } = await fetchChallenge(cleanAddress);
  
  // Sign challenge
  const { signature, publicKey } = await signChallenge(challenge);
  
  // Cache the signature and save to localStorage
  signatureCache[cleanAddress] = { nonce, signature, publicKey, expiresAt };
  saveSignatureCache();
  
  return { nonce, signature, publicKey, expiresAt };
}

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
 * Includes CSRF token for state-changing requests.
 * Wallet-scoped requests rely on the 24h backend session instead of re-sending
 * signed wallet proof on every call.
 */
async function getHeaders(
  method: string,
  walletAddress?: string,
  options: WalletRequestOptions = {}
): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(await getClientPlatformHeaders()),
  };

  if (walletAddress && options.requireWalletSession !== false) {
    await ensureWalletSession(walletAddress);
  }

  // Add CSRF token for state-changing requests
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const token = await fetchCsrfToken();
    headers['X-CSRF-Token'] = token;
  }

  return headers;
}

function assertWalletSessionResponse(res: Response, options: WalletRequestOptions = {}) {
  if (options.requireWalletSession === false && (res.status === 401 || res.status === 403)) {
    throw new WalletSessionRequiredError(undefined, res.status);
  }
}

export async function getWalletRequestHeaders(
  method: string,
  walletAddress?: string,
  options: WalletRequestOptions = {}
): Promise<HeadersInit> {
  return getHeaders(method, walletAddress, options);
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  action?: ActionCard | null; // include resolved action for context enrichment
}

export interface ChatResponse {
  message: string;
  action?: ActionCard | null;
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
    headers: await getHeaders('POST', walletAddress),
    credentials: 'include',
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
    headers: await getHeaders('POST', data.fromAddress),
    credentials: 'include',
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
    headers: await getHeaders('POST', data.walletAddress),
    credentials: 'include',
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
    headers: await getHeaders('POST', data.walletAddress),
    credentials: 'include',
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
    headers: await getHeaders('GET', walletAddress),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch orders');
  }
  
  const result = await res.json();
  return result.orders;
}

/**
 * Get wallet balances.
 * Balance is public on-chain data — no wallet signature required.
 */
export async function getBalances(address: string): Promise<{
  nim: { balance: number; balanceUSD: number; price: number };
  totalUSD: number;
}> {
  const cleanAddress = address.replace(/\s/g, '');
  const res = await fetch(`${API_URL}/balances/${cleanAddress}`, {
    // No walletAddress arg — balance is public, no signature needed
    headers: await getHeaders('GET'),
    credentials: 'include',
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
    throw new Error('Invalid NIM wallet address format');
  }
  
  // Validate sessionId format (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!data.sessionId || !uuidRegex.test(data.sessionId)) {
    throw new Error('Invalid session ID format');
  }
  
  const res = await fetch(`${API_URL}/chat/history`, {
    method: 'POST',
    headers: await getHeaders('POST', data.walletAddress),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorBody.error || 'Failed to save chat message');
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
  sessionId: string,
  walletAddress: string,
  options: WalletRequestOptions = {}
): Promise<any[]> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/chat/history/${sessionId}?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress, options),
    credentials: 'include',
  });

  assertWalletSessionResponse(res, options);
  
  if (!res.ok) {
    throw new Error('Failed to fetch chat history');
  }
  
  const result = await res.json();
  return result.messages;
}

/**
 * Get all chat sessions for a wallet
 */
export async function getChatSessions(
  walletAddress: string,
  options: WalletRequestOptions = {}
): Promise<any[]> {
  // FIX 4 FRONTEND: Validate address before API call
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/chat/sessions?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress, options),
    credentials: 'include',
  });

  assertWalletSessionResponse(res, options);
  
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
    headers: await getHeaders('DELETE', walletAddress),
    credentials: 'include',
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
    headers: await getHeaders('GET', walletAddress),
    credentials: 'include',
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
    headers: await getHeaders('POST', data.wallet),
    credentials: 'include',
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
/**
 * Update a saved address
 * Backend uses PUT /api/saved-addresses/:id
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
    method: 'PUT',
    headers: await getHeaders('PUT', wallet),
    credentials: 'include',
    body: JSON.stringify({ 
      wallet, 
      ...updates
    }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = 'Failed to update contact';
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
    headers: await getHeaders('DELETE', wallet),
    credentials: 'include',
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
    headers: await getHeaders('GET', wallet),
    credentials: 'include',
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
    headers: await getHeaders('GET', wallet),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch frequent addresses');
  }
  
  const result = await res.json();
  return result.addresses || [];
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
    headers: await getHeaders('GET'),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch country services');
  }
  
  return res.json();
}

// ============================================================================
// REFERRAL SYSTEM API
// ============================================================================

export async function getReferralLink(
  walletAddress: string,
  options: WalletRequestOptions = {}
): Promise<{
  success: boolean;
  referralLink: string;
  referralCode: string;
  referralCount: number;
  totalReferrals: number;
  qualifiedReferrals: number;
  totalEarnedUsd: number;
  totalEarnedNim: number;
  totalClaimableNim: number;
  totalClaimedNim: number;
  threshold: number;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/referrals/link?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress, options),
    credentials: 'include',
  });

  assertWalletSessionResponse(res, options);
  
  if (!res.ok) {
    throw new Error('Failed to fetch referral link');
  }
  
  return res.json();
}

export async function getReferralCount(walletAddress: string): Promise<{
  success: boolean;
  count: number;
  total: number;
  qualified: number;
  threshold: number;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/referrals/count?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch referral count');
  }
  
  return res.json();
}

export async function getReferralStatus(
  walletAddress: string,
  options: WalletRequestOptions = {}
): Promise<{
  success: boolean;
  isReferred: boolean;
  referrer: string | null;
  totalSpent: number;
  qualified: boolean;
  remaining: number;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/referrals/status?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress, options),
    credentials: 'include',
  });

  assertWalletSessionResponse(res, options);
  
  if (!res.ok) {
    throw new Error('Failed to fetch referral status');
  }
  
  return res.json();
}

export async function trackReferral(referredWallet: string, referralCode: string): Promise<{
  success: boolean;
  error?: string;
  referral?: any;
}> {
  if (!isValidNimAddress(referredWallet)) {
    throw new Error('Invalid NIM wallet address format for referredWallet');
  }
  
  const res = await fetch(`${API_URL}/referrals/track`, {
    method: 'POST',
    headers: await getHeaders('POST', referredWallet),
    credentials: 'include',
    body: JSON.stringify({
      referredWallet,
      referralCode,
    }),
  });
  
  return res.json();
}

export async function getLeaderboard(limit: number = 20): Promise<{
  success: boolean;
  leaderboard: Array<{
    wallet: string;
    referrals: number;
    totalInvited: number;
    totalEarned: number;
    totalEarnedNim?: number;
    totalClaimableNim?: number;
  }>;
  threshold: number;
}> {
  const res = await fetch(`${API_URL}/referrals/leaderboard?limit=${limit}`, {
    headers: await getHeaders('GET'),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch leaderboard');
  }
  
  return res.json();
}

export async function getReferrals(
  walletAddress: string,
  options: WalletRequestOptions = {}
): Promise<{
  success: boolean;
  referrals: Array<{
    id: number;
    referred_wallet: string;
    total_spent_usd: number;
    is_qualified: boolean;
    qualified_at: string | null;
    created_at: string;
    amount_earned_usd?: number;
    amount_earned_nim?: number;
    amount_claimable_nim?: number;
    amount_claimed_nim?: number;
  }>;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/referrals?wallet=${encodeURIComponent(walletAddress)}`, {
    headers: await getHeaders('GET', walletAddress, options),
    credentials: 'include',
  });

  assertWalletSessionResponse(res, options);
  
  if (!res.ok) {
    throw new Error('Failed to fetch referrals');
  }
  
  return res.json();
}

export async function claimReferralRewards(walletAddress: string): Promise<{
  success: boolean;
  amountNim?: number;
  txHash?: string;
  error?: string;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }

  const res = await fetch(`${API_URL}/referrals/claim`, {
    method: 'POST',
    headers: await getHeaders('POST', walletAddress),
    credentials: 'include',
    body: JSON.stringify({ wallet: walletAddress }),
  });

  return res.json();
}

export async function getCashback(walletAddress: string, limit: number = 50): Promise<{
  success: boolean;
  totalLuna: number;
  totalNim: number;
  history: Array<any>;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }
  
  const res = await fetch(`${API_URL}/cashback?wallet=${encodeURIComponent(walletAddress)}&limit=${limit}`, {
    headers: await getHeaders('GET', walletAddress),
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch cashback');
  }
  
  return res.json();
}

/**
 * Retrieve gift card redemption code for an order (for async delivery cases)
 */
export async function retrieveGiftCardCode(orderId: string, walletAddress: string): Promise<{
  code: string;
  pin: string | null;
  serialNumber: string | null;
  cached: boolean;
}> {
  const cleanAddress = walletAddress.replace(/\s/g, '');
  const res = await fetch(
    `${API_URL}/orders/${encodeURIComponent(orderId)}/retrieve-code?wallet=${encodeURIComponent(cleanAddress)}`,
    {
      headers: await getHeaders('GET', cleanAddress),
      credentials: 'include',
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to retrieve code');
  }

  return res.json();
}

// ============================================================================
// AUTH / SESSION API
// ============================================================================

export async function loginWithWallet(walletAddress: string): Promise<{
  success: boolean;
  walletAddress: string;
}> {
  if (!isValidNimAddress(walletAddress)) {
    throw new Error('Invalid NIM wallet address format');
  }

  const attemptLogin = async () => {
    const { nonce, signature, publicKey, expiresAt } = await getSignature(walletAddress);
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getClientPlatformHeaders()),
      },
      credentials: 'include',
      body: JSON.stringify({
        walletAddress,
        signature,
        publicKey,
        nonce,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Login failed');
    }

    const result = await res.json();
    setCachedSession(walletAddress, expiresAt);
    return result;
  };

  try {
    return await attemptLogin();
  } catch (error: any) {
    const message = String(error?.message || '');
    if (!/nonce|signature/i.test(message)) {
      throw error;
    }

    clearCachedSignature(walletAddress);
    return attemptLogin();
  }
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Logout failed');
  }

  Object.keys(sessionCache).forEach((key) => {
    delete sessionCache[key];
  });
  saveSessionCache();
  Object.keys(signatureCache).forEach((key) => {
    delete signatureCache[key];
  });
  saveSignatureCache();
}


