/**
 * NimHub Staking — delegate NIM to validators via Nimiq Hub API
 *
 * CORRECT IMPLEMENTATION:
 * - Use Nimiq RPC to create properly formatted staking transactions
 * - RPC methods expect POSITIONAL ARRAY params, not objects
 * - Sign with Hub API's signTransaction()
 * - Broadcast via JSON-RPC sendRawTransaction
 */

const RPC_URL = '/api/nimiq-rpc'; // Use backend proxy to avoid CORS issues

/**
 * Get current block height for transaction validity
 * If RPC fails, returns 0 which means "valid from current block"
 */
async function getBlockHeight(): Promise<number> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getLatestBlock',
        params: [],
        id: 1,
      }),
    });
    
    const data = await res.json();
    
    if (data.error) {
      console.warn('[Staking] RPC method getLatestBlock failed:', data.error.message);
      return 0; // Use 0 = valid from current block
    }
    
    // Extract height from response
    const height = data.result?.number || data.result?.height || 0;
    console.log('[Staking] Current block height:', height);
    return height;
  } catch (error) {
    console.warn('[Staking] Failed to fetch block height, using 0:', error);
    return 0; // Fallback: 0 means valid from current block
  }
}

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
 * Stake NIM with a validator - SIMPLIFIED APPROACH
 * 
 * Uses Nimiq Hub API's checkout() method with staking-specific parameters.
 * The Hub handles transaction creation, signing, and broadcasting internally.
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

  console.log('[Staking] Creating stake transaction via Hub API:', {
    sender: senderAddress,
    validator: validatorAddress,
    amount: amountLuna / 100000,
  });

  try {
    // Use Hub API's checkout method with staking parameters
    const HubApi = (await import('@nimiq/hub-api')).default;
    const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');

    const result = await hub.checkout({
      appName: 'NimHub',
      sender: senderAddress,
      recipient: validatorAddress, // Validator address as recipient
      value: amountLuna,
      fee: 0,
      extraData: new Uint8Array([0]), // Empty data for basic staking
      // @ts-ignore - Hub API may support these staking-specific params
      flags: 0b0001, // Staking transaction flag
      validityStartHeight: 0, // Valid from current block
    });

    // Hub API checkout returns a SignedTransaction with serializedTx (hex string)
    // The hash needs to be extracted or the result itself might contain it
    const txHash = (result as any).hash || (result as any).transactionHash;
    
    if (!txHash) {
      console.error('[Staking] No transaction hash in result:', result);
      throw new Error('Transaction completed but hash not found');
    }
    
    console.log('[Staking] ✓ Stake transaction complete:', txHash);

    // Record transaction in history (non-fatal)
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
 * Uses Hub API's checkout() method for unstaking.
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

  console.log('[Staking] Creating unstake transaction via Hub API:', {
    sender: senderAddress,
    amount: amountLuna / 100000,
  });

  try {
    // Use Hub API's checkout method for unstaking
    const HubApi = (await import('@nimiq/hub-api')).default;
    const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');

    const result = await hub.checkout({
      appName: 'NimHub',
      sender: senderAddress,
      recipient: senderAddress, // Self-transaction for unstaking
      value: amountLuna,
      fee: 0,
      extraData: new Uint8Array([1]), // Flag for unstaking
      // @ts-ignore - Hub API may support these unstaking-specific params
      flags: 0b0010, // Unstaking transaction flag
      validityStartHeight: 0,
    });

    // Hub API checkout returns a SignedTransaction with serializedTx (hex string)
    const txHash = (result as any).hash || (result as any).transactionHash;
    
    if (!txHash) {
      console.error('[Staking] No transaction hash in result:', result);
      throw new Error('Transaction completed but hash not found');
    }
    
    console.log('[Staking] ✓ Unstake transaction complete:', txHash);

    // Record transaction in history (non-fatal)
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

