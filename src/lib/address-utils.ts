/**
 * Nimiq Address Utilities
 * 
 * Centralized address normalization and formatting functions
 * to ensure consistent address handling across the application.
 */

/**
 * Normalize a Nimiq address for storage and comparison.
 * Removes all whitespace and converts to uppercase.
 * 
 * @param address - Nimiq address in any format
 * @returns Normalized address (no spaces, uppercase)
 * @throws Error if address format is invalid
 * 
 * @example
 * normalizeAddress("NQ53 RQM7 E6CB...") // "NQ53RQM7E6CB..."
 * normalizeAddress("nq53rqm7e6cb...")   // "NQ53RQM7E6CB..."
 */
export function normalizeAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error(`Invalid address: ${address}`);
  }

  // Remove all whitespace and convert to uppercase
  const normalized = address.replace(/\s+/g, '').toUpperCase();

  // Validate Nimiq address format: NQ + 34 alphanumeric = 36 total
  if (!/^NQ[0-9A-Z]{34}$/.test(normalized)) {
    throw new Error(
      `Invalid Nimiq address format: "${address}" ` +
      `(normalized: "${normalized}", length: ${normalized.length})`
    );
  }

  return normalized;
}

/**
 * Format a Nimiq address with spaces for display (human-readable).
 * 
 * @param address - Nimiq address (with or without spaces)
 * @returns Formatted address with spaces: "NQ53 RQM7 E6CB ..."
 * 
 * @example
 * formatAddress("NQ53RQM7E6CB...") // "NQ53 RQM7 E6CB ..."
 */
export function formatAddress(address: string): string {
  // First normalize to ensure consistent input
  const normalized = normalizeAddress(address);

  // Split into 4-character groups
  const groups = normalized.match(/.{1,4}/g);

  if (!groups) {
    throw new Error(`Failed to format address: ${address}`);
  }

  return groups.join(' ');
}

/**
 * Check if two Nimiq addresses are equal (case-insensitive, space-insensitive).
 * 
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns True if addresses match after normalization
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  try {
    return normalizeAddress(addr1) === normalizeAddress(addr2);
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid Nimiq address format.
 * 
 * @param address - String to validate
 * @returns True if valid Nimiq address
 */
export function isValidAddress(address: string): boolean {
  try {
    normalizeAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate an address for display with ellipsis.
 * 
 * @param address - Nimiq address
 * @param prefixLength - Number of characters to show at start (default: 8)
 * @param suffixLength - Number of characters to show at end (default: 6)
 * @returns Truncated address like "NQ53RQM7...XC4V1A"
 */
export function truncateAddress(
  address: string,
  prefixLength: number = 8,
  suffixLength: number = 6
): string {
  const normalized = normalizeAddress(address);
  if (normalized.length <= prefixLength + suffixLength) {
    return normalized;
  }
  return `${normalized.slice(0, prefixLength)}...${normalized.slice(-suffixLength)}`;
}
