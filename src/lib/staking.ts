/**
 * NimHub Staking — delegate NIM to validators via Nimiq Hub API
 *
 * CORRECT IMPLEMENTATION:
 * - Send to staking contract (NQ77...0001 for testnet)
 * - Use Hub API checkout() with extraData field
 * - extraData contains validator address for staking
 */

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
 * Stake NIM with a validator - CORRECT APPROACH
 * 
 * Sends NIM to the Nimiq staking contract (NQ77 0000... for testnet) with validator address in data field.
 * This is the proper way to stake in Nimiq Albatross.
 *
 * @param senderAddress - User's wallet address
 * @param validatorAddress - The validator's NIM address
 * @param amountLuna - Amount to stake in Luna (min 100,000 = 1 NIM)
 * @returns Transaction hash
 */
export async function stakeNIM(
  senderAddress: string,
  validatorAddress: string,
  amountLuna: number
): Promise<string> {
  if (amountLuna < 100000) throw new Error('Minimum stake is 1 NIM (100,000 Luna)');

  // Nimiq Staking Contract - hardcoded in protocol (testnet)
  const STAKING_CONTRACT = 'NQ77 0000 0000 0000 0000 0000 0000 0000 0001';

  console.log('[Staking] Creating stake transaction via Hub API:', {
    sender: senderAddress,
    validator: validatorAddress,
    amount: amountLuna / 100000,
  });

  try {
    const HubApi = (await import('@nimiq/hub-api')).default;
    const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');

    // Create data field with validator address for the staking contract
    const dataString = `stake:${validatorAddress}`;
    const encoder = new TextEncoder();
    const extraData = encoder.encode(dataString);

    // Use checkout with extraData - this will send to staking contract with validator in data
    const result = await hub.checkout({
      appName: 'NimHub',
      recipient: STAKING_CONTRACT, // Send to staking contract, not validator directly
      value: amountLuna,
      fee: 0,
      extraData, // Validator address in data field as Uint8Array
    });

    const txHash = result.hash;
    
    if (!txHash) {
      console.error('[Staking] No transaction hash in result:', result);
      throw new Error('Transaction completed but hash not found');
    }
    
    console.log('[Staking] ✓ Stake transaction sent to contract:', txHash);

    // Record transaction in history (non-fatal)
    try {
      console.log('[Staking] Recording transaction in history...');
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
        const result = await response.json();
        console.log('[Staking] ✓ Transaction recorded in history:', result);
      } else {
        const errorText = await response.text();
        console.error('[Staking] Failed to record transaction:', response.status, errorText);
      }
    } catch (recordError) {
      console.error('[Staking] Error recording transaction:', recordError);
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
 * Sends transaction to staking contract with unstake instruction.
 * 
 * @param senderAddress - User's wallet address
 * @param amountLuna - Amount to unstake in Luna
 * @param hubInstance - Pre-loaded Hub API instance (required to prevent popup blocking)
 * @returns Transaction hash
 */
export async function unstakeNIM(
  senderAddress: string,
  amountLuna: number,
  hubInstance?: any
): Promise<string> {
  if (amountLuna <= 0) throw new Error('Must specify amount to unstake');

  // Nimiq Staking Contract (testnet)
  const STAKING_CONTRACT = 'NQ77 0000 0000 0000 0000 0000 0000 0000 0001';

  console.log('[Staking] Creating unstake transaction via Hub API:', {
    sender: senderAddress,
    amount: amountLuna / 100000,
  });

  try {
    // Use pre-loaded Hub instance to avoid popup blocking, or fallback to dynamic import
    let hub = hubInstance;
    if (!hub) {
      const HubApi = (await import('@nimiq/hub-api')).default;
      hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');
    }

    // Create data field with unstake instruction
    const dataString = 'unstake';
    const encoder = new TextEncoder();
    const extraData = encoder.encode(dataString);

    // Use checkout with extraData
    const result = await hub.checkout({
      appName: 'NimHub',
      recipient: STAKING_CONTRACT, // Send to staking contract
      value: amountLuna,
      fee: 0,
      extraData, // Unstake instruction as Uint8Array
    });

    const txHash = result.hash;
    
    if (!txHash) {
      console.error('[Staking] No transaction hash in result:', result);
      throw new Error('Transaction completed but hash not found');
    }
    
    console.log('[Staking] ✓ Unstake transaction sent to contract:', txHash);

    // Record transaction in history (non-fatal)
    try {
      console.log('[Staking] Recording unstake transaction in history...');
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
        const result = await response.json();
        console.log('[Staking] ✓ Unstake recorded in history:', result);
      } else {
        const errorText = await response.text();
        console.error('[Staking] Failed to record unstake:', response.status, errorText);
      }
    } catch (recordError) {
      console.error('[Staking] Error recording unstake:', recordError);
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
