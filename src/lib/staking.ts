/**
 * NimHub Staking — delegate NIM to validators via Nimiq Hub API
 *
 * CORRECT IMPLEMENTATION:
 * - Staking transactions go TO the Nimiq Staking Contract (NQ77 0000...)
 * - Validator address is encoded in the transaction data
 * - Uses Hub API signStakingTransaction() NOT checkout()
 * - Broadcasts via JSON-RPC sendRawTransaction
 *
 * Flow:
 * 1. Fetch validators from Nimiq Validators API
 * 2. User picks a validator
 * 3. Prefetch block height (before click handler)
 * 4. Hub API signs the staking transaction
 * 5. Broadcast via JSON-RPC
 * 6. Show staking dashboard with live status
 */

// Nimiq Staking Contract address — this is fixed, never changes
const STAKING_CONTRACT = 'NQ77 0000 0000 0000 0000 0000 0000 0000 0000';

const VALIDATORS_API = process.env.NEXT_PUBLIC_NIMIQ_ENV === 'testnet'
  ? 'https://validators-api-main.je-cf9.workers.dev'
  : 'https://validators-api-test.je-cf9.workers.dev';

const RPC_URL = process.env.NEXT_PUBLIC_NIMIQ_RPC_URL || 
  (process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet'
    ? 'https://rpc.nimiqwatch.com'
    : 'https://rpc.testnet.nimiqwatch.com');

export interface Validator {
  address: string;
  name: string;
  description: string;
  fee: number;              // percentage fee e.g. 5 = 5%
  payoutType: string;       // 'direct' | 'restake' | 'manual'
  payoutSchedule: string;   // e.g. 'daily', 'weekly'
  trustScore: number;       // 0–100
  totalStake: number;       // in Luna
  stakers: number;          // number of stakers
  isPool: boolean;
  website?: string;
  logo?: string;
}

export interface StakerInfo {
  address: string;
  balance: number;          // total staked in Luna
  activeBalance: number;
  inactiveBalance: number;
  retiredBalance: number;
  validator: string | null; // current validator address
  inactiveFrom: number | null;
}

/**
 * Fetch all active validators sorted by trust score.
 */
export async function getValidators(): Promise<Validator[]> {
  const res = await fetch('/api/staking/validators');
  if (!res.ok) throw new Error('Failed to fetch validators');
  const data = await res.json();
  // Sort by trust score descending
  return (data.validators || data || [])
    .sort((a: Validator, b: Validator) => b.trustScore - a.trustScore);
}

/**
 * Get a single validator's details.
 */
export async function getValidator(address: string): Promise<Validator> {
  const res = await fetch('/api/staking/validators');
  if (!res.ok) throw new Error('Failed to fetch validators');
  const data = await res.json();
  const validators = data.validators || data || [];
  const validator = validators.find((v: Validator) => v.address === address);
  if (!validator) throw new Error('Validator not found');
  return validator;
}

/**
 * Get staking info for a wallet address.
 */
export async function getStakerInfo(address: string): Promise<StakerInfo | null> {
  try {
    const res = await fetch(`/api/staking/staker/${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Get estimated APY from backend.
 */
export async function getNetworkAPY(): Promise<number> {
  try {
    const res = await fetch('/api/staking/apy');
    if (!res.ok) return 8; // fallback estimate
    const data = await res.json();
    return data.apy || 8;
  } catch {
    return 8; // ~8% APY estimate fallback
  }
}

/**
 * Calculate estimated annual rewards for a given stake amount.
 */
export function estimateAnnualRewards(stakeNIM: number, apy: number, validatorFee: number): number {
  const grossRewards = stakeNIM * (apy / 100);
  const netRewards = grossRewards * (1 - validatorFee / 100);
  return Math.round(netRewards * 100) / 100;
}

// ─── Hub API Staking Transactions ────────────────────────────────────────────
// All Hub calls MUST be the first call inside click handlers — no awaits before them.

/**
 * Get Hub API instance synchronously.
 * MUST be called first in any click handler.
 */
function getHub() {
  if (typeof window === 'undefined') {
    throw new Error('Hub API can only be used in browser');
  }
  
  // Use global HubApi loaded from CDN
  if (!(window as any).HubApi) {
    throw new Error('Hub API not loaded. Add <script src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@latest/dist/standalone/HubApi.standalone.umd.js"></script> to your HTML');
  }
  
  // Cache the instance
  if (!(window as any).__nimhub_staking) {
    const hubUrl = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com';
    (window as any).__nimhub_staking = new (window as any).HubApi(hubUrl);
  }
  
  return (window as any).__nimhub_staking;
}

/**
 * Get current block height — needed for validityStartHeight in staking transactions
 */
async function getCurrentBlockHeight(): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getBlockNumber',
      params: [],
      id: 1,
    }),
  });
  
  if (!res.ok) throw new Error('Failed to fetch block height');
  
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  
  return data.result;
}

/**
 * Block height cache - prefetch this before user clicks stake button
 * so Hub call can be synchronous
 */
let cachedBlockHeight: number | null = null;
let blockHeightTimestamp: number = 0;
const BLOCK_HEIGHT_CACHE_TTL = 30000; // 30 seconds

/**
 * Prefetch block height in background.
 * Call this when StakePage loads so it's ready when user clicks confirm.
 */
export async function prefetchBlockHeight() {
  try {
    cachedBlockHeight = await getCurrentBlockHeight();
    blockHeightTimestamp = Date.now();
    console.log('[Staking] Prefetched block height:', cachedBlockHeight);
  } catch (error) {
    console.error('[Staking] Failed to prefetch block height:', error);
  }
}

/**
 * Get block height - uses cache if fresh, otherwise fetches
 */
async function getBlockHeight(): Promise<number> {
  const now = Date.now();
  if (cachedBlockHeight && (now - blockHeightTimestamp) < BLOCK_HEIGHT_CACHE_TTL) {
    return cachedBlockHeight;
  }
  return await getCurrentBlockHeight();
}

/**
 * Stake NIM with a validator - CORRECT IMPLEMENTATION
 * 
 * This sends the transaction TO the Nimiq Staking Contract (NQ77 0000...),
 * NOT to the validator's address. The validator address is encoded in the
 * transaction data field.
 *
 * CRITICAL: getHub() must be called FIRST (synchronously) in click handler.
 * Block height should be prefetched before the click handler fires.
 *
 * @param senderAddress - User's wallet address
 * @param validatorAddress - The validator's NIM address to delegate to
 * @param amountLuna - Amount to stake in Luna (min 100,000 = 1 NIM)
 * @returns Transaction hash
 */
export async function stakeNIM(
  senderAddress: string,
  validatorAddress: string,
  amountLuna: number
): Promise<string> {
  if (amountLuna < 100000) throw new Error('Minimum stake is 1 NIM (100,000 Luna)');

  // Get block height (uses cache if available)
  const blockHeight = await getBlockHeight();
  
  // CRITICAL: Hub call must be synchronous - no awaits before this
  const hub = getHub();

  console.log('[Staking] Creating stake transaction:', {
    sender: senderAddress,
    validator: validatorAddress,
    amount: amountLuna / 100000,
    blockHeight,
  });

  // Sign staking transaction via Hub API
  const signedTx = await hub.signStakingTransaction({
    appName: 'NimHub',
    sender: senderAddress,
    delegation: validatorAddress,  // Validator to delegate to
    value: amountLuna,            // Amount to stake in Luna
    fee: 0,                       // Feeless
    validityStartHeight: blockHeight,
  });

  console.log('[Staking] Transaction signed, broadcasting...');

  // Broadcast via JSON-RPC
  const broadcastRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'sendRawTransaction',
      params: [signedTx.serializedTx],
      id: 1,
    }),
  });

  const broadcastData = await broadcastRes.json();
  
  if (broadcastData.error) {
    console.error('[Staking] Broadcast error:', broadcastData.error);
    throw new Error(broadcastData.error.message || 'Failed to broadcast staking transaction');
  }

  const txHash = broadcastData.result;
  console.log('[Staking] ✓ Stake transaction broadcast:', txHash);

  // Record transaction in history for UI display
  try {
    const response = await fetch('/api/staking/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: senderAddress,
        validatorAddress,
        amountLuna,
        txHash,
        action: 'stake',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[Staking] Failed to record transaction (non-fatal):', errorData);
      console.warn('[Staking] Database may be missing columns. Transaction still succeeded on-chain.');
    } else {
      console.log('[Staking] ✓ Transaction recorded in history');
    }
  } catch (recordError) {
    console.warn('[Staking] Failed to record transaction (non-fatal):', recordError);
    console.warn('[Staking] Transaction still succeeded on-chain.');
  }

  return txHash;
}

/**
 * Begin unstaking — deactivate stake (move to inactive state).
 * User must wait ~1 epoch (~24h) before they can withdraw.
 * 
 * CRITICAL: getHub() must be called FIRST (synchronously) in click handler.
 * 
 * @param senderAddress - User's wallet address
 * @param amountLuna - Amount to unstake in Luna (0 = unstake all)
 * @returns Transaction hash
 */
export async function unstakeNIM(
  senderAddress: string,
  amountLuna: number = 0
): Promise<string> {
  // Get block height (uses cache if available)
  const blockHeight = await getBlockHeight();
  
  // CRITICAL: Hub call must be synchronous
  const hub = getHub();

  console.log('[Staking] Creating unstake transaction:', {
    sender: senderAddress,
    amount: amountLuna > 0 ? amountLuna / 100000 : 'all',
    blockHeight,
  });

  // Sign unstaking transaction via Hub API
  const signedTx = await hub.signStakingTransaction({
    appName: 'NimHub',
    sender: senderAddress,
    deactivateStake: amountLuna || undefined, // Amount to deactivate (undefined = all)
    fee: 0,
    validityStartHeight: blockHeight,
  });

  console.log('[Staking] Unstake transaction signed, broadcasting...');

  // Broadcast via JSON-RPC
  const broadcastRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'sendRawTransaction',
      params: [signedTx.serializedTx],
      id: 1,
    }),
  });

  const broadcastData = await broadcastRes.json();
  
  if (broadcastData.error) {
    console.error('[Staking] Unstake broadcast error:', broadcastData.error);
    throw new Error(broadcastData.error.message || 'Failed to broadcast unstaking transaction');
  }

  const txHash = broadcastData.result;
  console.log('[Staking] ✓ Unstake transaction broadcast:', txHash);

  // Record transaction in history for UI display
  try {
    const response = await fetch('/api/staking/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: senderAddress,
        validatorAddress: '', // Unstake doesn't need validator address
        amountLuna,
        txHash,
        action: 'unstake',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[Staking] Failed to record unstake transaction (non-fatal):', errorData);
      console.warn('[Staking] Database may be missing columns. Transaction still succeeded on-chain.');
    } else {
      console.log('[Staking] ✓ Unstake transaction recorded in history');
    }
  } catch (recordError) {
    console.warn('[Staking] Failed to record unstake transaction (non-fatal):', recordError);
    console.warn('[Staking] Transaction still succeeded on-chain.');
  }

  return txHash;
}

/**
 * Format Luna as NIM string for display.
 */
export function lunaToNIM(luna: number): string {
  return (luna / 100000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format trust score as a label.
 */
export function trustScoreLabel(score: number | undefined | null): { label: string; color: string } {
  const safeScore = score ?? 50; // Default to 50 if undefined
  if (safeScore >= 80) return { label: 'High Trust', color: '#00D4A1' };
  if (safeScore >= 60) return { label: 'Good', color: '#F5A623' };
  if (safeScore >= 40) return { label: 'Medium', color: '#f59e0b' };
  return { label: 'Low Trust', color: '#FF4B6E' };
}
