/**
 * NimHub Staking — delegate NIM to validators via Nimiq Hub API
 *
 * CORRECT IMPLEMENTATION:
 * - Use Nimiq RPC to create properly formatted staking transactions
 * - Sign with Hub API's signTransaction()
 * - Broadcast via JSON-RPC sendRawTransaction
 *
 * The RPC handles all the binary encoding - no need for @nimiq/core in browser.
 */

// Nimiq Staking Contract address — hardcoded in protocol
const STAKING_CONTRACT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0001';

const RPC_URL = process.env.NEXT_PUBLIC_NIMIQ_RPC_URL || 
  (process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet'
    ? 'https://rpc.nimiqwatch.com'
    : 'https://seed1.pos.nimiq-testnet.com:8648');

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

/**
 * Stake NIM with a validator - CORRECT IMPLEMENTATION
 * 
 * Uses Nimiq RPC to create a properly formatted staking transaction,
 * signs it with Hub API's signTransaction(), and broadcasts it.
 *
 * The RPC handles all binary encoding - we don't need @nimiq/core.
 *
 * @param senderAddress - User's wallet address (pays fee)
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

  console.log('[Staking] Creating stake transaction via RPC:', {
    sender: senderAddress,
    validator: validatorAddress,
    amount: amountLuna / 100000,
  });

  try {
    // Step 1: Create the staking transaction using RPC
    // RPC returns a plain object that Hub API can sign directly
    const createRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'createNewStakerTransaction',
        params: {
          wallet: senderAddress,
          validator: validatorAddress,
          value: amountLuna,
          fee: 0,
        },
        id: 1,
      }),
    });

    const createData = await createRes.json();
    
    if (createData.error) {
      console.error('[Staking] RPC create error:', createData.error);
      throw new Error(createData.error.message || 'Failed to create staking transaction');
    }

    const transactionObj = createData.result;
    console.log('[Staking] Transaction object created, requesting signature from Hub...');

    // Step 2: Sign with Hub API - it accepts the plain object from RPC
    const HubApi = (await import('@nimiq/hub-api')).default;
    const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');

    // Hub API signTransaction accepts the plain transaction object
    const signResult = await hub.signTransaction({
      ...transactionObj,
      appName: 'NimHub',
    });

    const signedTxHex = signResult.serializedTx || signResult.raw;
    console.log('[Staking] Transaction signed, broadcasting...');

    // Step 3: Broadcast
    const broadcastRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'sendRawTransaction',
        params: [signedTxHex],
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

    // Record transaction in history
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
      
      if (response.ok) {
        console.log('[Staking] ✓ Transaction recorded in history');
      }
    } catch (recordError) {
      console.warn('[Staking] Failed to record transaction (non-fatal)');
    }

    return txHash;
  } catch (error: any) {
    console.error('[Staking] Stake error:', error);
    throw error;
  }
}

/**
 * Begin unstaking — retire stake (move to inactive state).
 * User must wait ~1 epoch before they can withdraw.
 * 
 * @param senderAddress - User's wallet address
 * @param amountLuna - Amount to unstake in Luna
 * @returns Transaction hash
 */
export async function unstakeNIM(
  senderAddress: string,
  amountLuna: number
): Promise<string> {
  if (amountLuna <= 0) throw new Error('Must specify amount to unstake');

  console.log('[Staking] Creating unstake transaction via RPC:', {
    sender: senderAddress,
    amount: amountLuna / 100000,
  });

  try {
    // Step 1: Create retire stake transaction using RPC
    const createRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'createRetireStakeTransaction',
        params: {
          wallet: senderAddress,
          value: amountLuna,
          fee: 0,
        },
        id: 1,
      }),
    });

    const createData = await createRes.json();
    
    if (createData.error) {
      console.error('[Staking] RPC create unstake error:', createData.error);
      throw new Error(createData.error.message || 'Failed to create unstaking transaction');
    }

    const transactionObj = createData.result;
    console.log('[Staking] Unstake transaction object created, requesting signature...');

    // Step 2: Sign with Hub API
    const HubApi = (await import('@nimiq/hub-api')).default;
    const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');

    const signResult = await hub.signTransaction({
      ...transactionObj,
      appName: 'NimHub',
    });

    const signedTxHex = signResult.serializedTx || signResult.raw;
    console.log('[Staking] Unstake transaction signed, broadcasting...');

    // Step 3: Broadcast
    const broadcastRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'sendRawTransaction',
        params: [signedTxHex],
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

    // Record transaction in history
    try {
      const response = await fetch('/api/staking/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: senderAddress,
          validatorAddress: '',
          amountLuna,
          txHash,
          action: 'unstake',
        }),
      });
      
      if (response.ok) {
        console.log('[Staking] ✓ Unstake recorded in history');
      }
    } catch (recordError) {
      console.warn('[Staking] Failed to record unstake (non-fatal)');
    }

    return txHash;
  } catch (error: any) {
    console.error('[Staking] Unstake error:', error);
    throw error;
  }
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

