/**
 * Pending Sync Queue - Durable client-side queue for backend sync operations
 * 
 * When an on-chain payment succeeds but backend recording fails, we queue the
 * transaction for retry rather than showing "Payment Failed" to the user.
 * This ensures successful payments always get recorded, even with transient
 * network/backend issues.
 */

interface PendingSync {
  id: string;                      // UUID, generated client-side
  kind: 'send' | 'order';          // Type of transaction
  txHash: string;                  // On-chain transaction hash
  payload: Record<string, any>;    // Data for recordTransaction/createOrder
  createdAt: number;               // Timestamp when queued
  attempts: number;                // Number of retry attempts
  lastAttemptAt?: number;          // Timestamp of last retry
}

const STORAGE_KEY = 'nimagent_pending_sync_queue';
const MAX_ATTEMPTS = 10;
const BACKOFF_BASE_MS = 10000; // 10 seconds base delay

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get the current queue from localStorage
 */
export function getPendingSyncQueue(): PendingSync[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const queue = JSON.parse(stored);
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    console.error('[PendingSyncQueue] Failed to read queue:', err);
    return [];
  }
}

/**
 * Save the queue to localStorage
 */
function saveQueue(queue: PendingSync[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[PendingSyncQueue] Failed to save queue:', err);
  }
}

/**
 * Add a new entry to the pending sync queue
 * Returns the generated ID
 */
export function enqueuePendingSync(
  entry: Omit<PendingSync, 'id' | 'createdAt' | 'attempts'>
): string {
  const id = generateUUID();
  const newEntry: PendingSync = {
    ...entry,
    id,
    createdAt: Date.now(),
    attempts: 0,
  };
  
  const queue = getPendingSyncQueue();
  queue.push(newEntry);
  saveQueue(queue);
  
  console.log(`[PendingSyncQueue] Enqueued ${entry.kind} sync for tx ${entry.txHash.slice(0, 8)}...`);
  return id;
}

/**
 * Remove an entry from the queue (after successful sync)
 */
export function removePendingSync(id: string): void {
  const queue = getPendingSyncQueue();
  const filtered = queue.filter(entry => entry.id !== id);
  
  if (filtered.length !== queue.length) {
    saveQueue(filtered);
    console.log(`[PendingSyncQueue] Removed sync entry ${id}`);
  }
}

/**
 * Update attempt count and timestamp for an entry
 */
export function updatePendingSyncAttempt(id: string): void {
  const queue = getPendingSyncQueue();
  const entry = queue.find(e => e.id === id);
  
  if (entry) {
    entry.attempts += 1;
    entry.lastAttemptAt = Date.now();
    saveQueue(queue);
  }
}

/**
 * Get entries that are ready for retry (respecting backoff)
 */
export function getRetryableEntries(): PendingSync[] {
  const queue = getPendingSyncQueue();
  const now = Date.now();
  
  return queue.filter(entry => {
    // Skip entries that have exceeded max attempts
    if (entry.attempts >= MAX_ATTEMPTS) {
      return false;
    }
    
    // If never attempted, it's ready
    if (!entry.lastAttemptAt) {
      return true;
    }
    
    // Exponential backoff: wait longer after each failure
    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, entry.attempts);
    const timeSinceLastAttempt = now - entry.lastAttemptAt;
    
    return timeSinceLastAttempt >= backoffMs;
  });
}

/**
 * Get entries that have exceeded max attempts and need manual intervention
 */
export function getFailedEntries(): PendingSync[] {
  const queue = getPendingSyncQueue();
  return queue.filter(entry => entry.attempts >= MAX_ATTEMPTS);
}

/**
 * Clear all failed entries (after user has been notified)
 */
export function clearFailedEntries(): void {
  const queue = getPendingSyncQueue();
  const active = queue.filter(entry => entry.attempts < MAX_ATTEMPTS);
  saveQueue(active);
}

/**
 * Get total count of pending syncs
 */
export function getPendingSyncCount(): number {
  return getPendingSyncQueue().length;
}

/**
 * Check if a specific transaction hash is already in the pending sync queue
 * This prevents double-submission of the same transaction
 */
export function isTxHashPending(txHash: string): boolean {
  const queue = getPendingSyncQueue();
  return queue.some(entry => entry.txHash.toLowerCase() === txHash.toLowerCase());
}

/**
 * Check if an action is already being processed by looking at the pending sync queue
 * Returns the pending entry if found, null otherwise
 */
export function findPendingByActionDetails(
  type: string,
  details: Record<string, any>
): PendingSync | null {
  const queue = getPendingSyncQueue();
  
  // For orders, match by order type and key details
  if (type === 'gift-card' || type === 'airtime' || type === 'bill') {
    return queue.find(entry => {
      if (entry.kind !== 'order') return false;
      const payload = entry.payload;
      return (
        payload.type === type &&
        payload.details?.product === details.product &&
        payload.details?.recipient === details.recipient
      );
    }) || null;
  }
  
  // For sends, match by recipient and amount
  if (type === 'send') {
    return queue.find(entry => {
      if (entry.kind !== 'send') return false;
      const payload = entry.payload;
      return (
        payload.toAddress === details.recipient &&
        payload.amountLuna === details.amountLuna
      );
    }) || null;
  }
  
  return null;
}

/**
 * Get all pending syncs for a specific wallet address
 */
export function getPendingSyncsForWallet(walletAddress: string): PendingSync[] {
  const queue = getPendingSyncQueue();
  return queue.filter(entry => {
    const entryWallet = entry.payload?.walletAddress || entry.payload?.fromAddress;
    return entryWallet?.toLowerCase() === walletAddress.toLowerCase();
  });
}
