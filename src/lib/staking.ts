/**
 * NimHub Staking — delegate NIM to validators via Nimiq Hub API
 *
 * Flow:
 * 1. Fetch validators from Nimiq Validators API
 * 2. User picks a validator
 * 3. Hub API signs and broadcasts the stake transaction
 * 4. Show staking dashboard with live status
 */

const VALIDATORS_API = process.env.NEXT_PUBLIC_NIMIQ_ENV === 'testnet'
  ? 'https://validators-api-main.je-cf9.workers.dev'
  : 'https://validators-api-test.je-cf9.workers.dev';

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
 * Import Hub API dynamically via hub-adapter for consistency with rest of app
 */
async function getHub() {
  if (typeof window === 'undefined') {
    throw new Error('Hub API can only be used in browser');
  }
  
  // Use dynamic import to load Hub API
  const { default: HubApi } = await import('@nimiq/hub-api');
  const hubUrl = process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com';
  
  // Cache the instance
  if (!(window as any).__nimhub_staking) {
    (window as any).__nimhub_staking = new HubApi(hubUrl);
  }
  
  return (window as any).__nimhub_staking;
}

/**
 * Prewarm the Hub API so it's ready when user clicks stake button.
 * Call this early (e.g. when StakePage loads) to avoid popup blocking.
 */
export function prewarmStakingHub() {
  if (typeof window !== 'undefined') {
    getHub().catch(() => {
      // Silent fail - will retry when actually needed
    });
  }
}

/**
 * Stake NIM with a validator.
 * CRITICAL: Must be called synchronously inside a click handler — no awaits before this.
 *
 * @param validatorAddress - The validator's NIM address
 * @param amountLuna - Amount to stake in Luna (min 100,000,000 = 1,000 NIM)
 * @returns Transaction hash
 */
export async function stakeNIM(validatorAddress: string, amountLuna: number): Promise<string> {
  if (amountLuna < 100000000) throw new Error('Minimum stake is 1,000 NIM');

  const hub = await getHub();

  const result = await hub.checkout({
    appName: 'NimHub',
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', // staking contract address
    value: amountLuna,
    extraData: `stake:${validatorAddress}`,
    fee: 0,
  });

  return result.hash;
}

/**
 * Begin unstaking — moves stake to inactive state.
 * User must wait ~1 epoch before they can withdraw.
 * CRITICAL: Must be called synchronously inside a click handler.
 */
export async function unstakeNIM(amountLuna: number): Promise<string> {
  const hub = await getHub();

  const result = await hub.checkout({
    appName: 'NimHub',
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
    value: 0,
    extraData: `deactivate:${amountLuna}`,
    fee: 0,
  });

  return result.hash;
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
