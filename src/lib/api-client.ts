// API client for NimHub backend

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

import type { ActionCard } from '@/types';

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
  const res = await fetch(`${API_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_URL}/api/orders/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_URL}/api/orders?wallet=${encodeURIComponent(walletAddress)}`);
  
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
  const res = await fetch(`${API_URL}/api/balances/${cleanAddress}`);
  
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
  const res = await fetch(`${API_URL}/api/chat/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    console.error('Failed to save chat message');
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(sessionId: string, walletAddress: string): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/chat/history/${sessionId}?wallet=${encodeURIComponent(walletAddress)}`);
  
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
  const res = await fetch(`${API_URL}/api/chat/sessions?wallet=${encodeURIComponent(walletAddress)}`);
  
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
  const res = await fetch(`${API_URL}/api/chat/history/${sessionId}?wallet=${encodeURIComponent(walletAddress)}`, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete chat session');
  }
}
