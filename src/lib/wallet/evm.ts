// EVM/Ethereum provider helper for USDT payments on Polygon
// Mirrors the retry pattern from detect.ts for the Nimiq provider
//
// Nimiq Pay injects window.ethereum (EIP-1193) alongside window.nimiqPay.
// The same cold-start issues that affected window.nimiqPay can affect
// window.ethereum — treat its mere existence as insufficient proof of readiness.

import { encodeFunctionData, parseUnits } from 'viem';

// USDT contract on Polygon (6 decimals)
export const USDT_POLYGON_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as const;
export const POLYGON_CHAIN_ID = '0x89' as const; // 137 in decimal
export const POLYGON_CHAIN_ID_DECIMAL = 137;

// ERC20 transfer ABI (just the transfer function)
export const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

// Ethereum provider error types
export class EthereumProviderError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'EthereumProviderError';
  }
}

export class ChainNotAddedError extends EthereumProviderError {
  constructor() {
    super('Polygon network not configured in wallet', 4902);
    this.name = 'ChainNotAddedError';
  }
}

/**
 * Get window.ethereum provider with cold-start retry pattern
 * Mirrors getNimiqProvider() retry logic from detect.ts
 * 
 * IMPORTANT: Don't assume window.ethereum is ready just because it exists!
 * On cold start, the provider may need time to initialize properly.
 */
export async function getEthereumProvider(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new EthereumProviderError('Not running in browser context');
  }

  if (!window.ethereum) {
    throw new EthereumProviderError(
      'Not running inside Nimiq Pay\'s Ethereum-capable context. ' +
      'Please open this app in Nimiq Pay to use USDT payments.'
    );
  }

  return window.ethereum;
}

/**
 * Connect to Ethereum wallet (request accounts)
 * Uses retry pattern similar to Nimiq provider — first failure isn't permanent
 * 
 * @returns Connected Ethereum address (checksummed)
 */
export async function connectEthereum(): Promise<string> {
  const provider = await getEthereumProvider();

  // Retry pattern: try twice with a delay, don't cache rejection permanently
  const attempts = [
    { wait: 0 },
    { wait: 1000 }, // 1s delay before retry
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    if (attempt.wait > 0) {
      await new Promise(resolve => setTimeout(resolve, attempt.wait));
    }

    try {
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new EthereumProviderError('No Ethereum accounts available');
      }

      return accounts[0] as string;
    } catch (err: any) {
      lastError = err;
      console.warn(`[EVM] eth_requestAccounts attempt failed:`, err);
      
      // User rejection is final, don't retry
      if (err.code === 4001 || err.message?.includes('rejected')) {
        throw new EthereumProviderError('User rejected account access', 4001);
      }
      
      // Otherwise continue to retry
    }
  }

  // All attempts failed
  throw lastError || new EthereumProviderError('Failed to connect Ethereum wallet');
}

/**
 * Switch to Polygon network (or add it if not present)
 * Handles both wallet_switchEthereumChain and wallet_addEthereumChain
 */
export async function switchToPolygon(): Promise<void> {
  const provider = await getEthereumProvider();

  try {
    // Try to switch to Polygon
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
  } catch (switchError: any) {
    // Chain not added yet (error 4902)
    if (switchError.code === 4902) {
      try {
        // Add Polygon network
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: POLYGON_CHAIN_ID,
              chainName: 'Polygon',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com'],
            },
          ],
        });
      } catch (addError: any) {
        if (addError.code === 4001) {
          throw new EthereumProviderError('User rejected adding Polygon network', 4001);
        }
        throw new EthereumProviderError(
          `Failed to add Polygon network: ${addError.message || 'Unknown error'}`
        );
      }
    } else if (switchError.code === 4001) {
      throw new EthereumProviderError('User rejected network switch', 4001);
    } else {
      throw new EthereumProviderError(
        `Failed to switch to Polygon: ${switchError.message || 'Unknown error'}`
      );
    }
  }
}

/**
 * Send USDT on Polygon network
 * 
 * @param to - Recipient Ethereum address (0x...)
 * @param amountDecimal - USDT amount as decimal string (e.g., "10.5" for 10.5 USDT)
 * @returns Transaction hash
 */
export async function sendUSDT(to: string, amountDecimal: string): Promise<string> {
  const provider = await getEthereumProvider();

  // Get connected account
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new EthereumProviderError('No connected account. Please connect wallet first.');
  }
  const from = accounts[0];

  // Validate recipient address
  if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new EthereumProviderError('Invalid recipient address format');
  }

  // Convert USDT amount to smallest unit (6 decimals)
  let amountWei: bigint;
  try {
    amountWei = parseUnits(amountDecimal, 6); // USDT has 6 decimals
  } catch (err) {
    throw new EthereumProviderError('Invalid amount format');
  }

  // Encode ERC20 transfer function call
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amountWei],
  });

  // Send transaction
  try {
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from,
          to: USDT_POLYGON_ADDRESS,
          data,
          value: '0x0', // No native MATIC sent, only token transfer
        },
      ],
    });

    if (!txHash) {
      throw new EthereumProviderError('Transaction failed: no hash returned');
    }

    return txHash as string;
  } catch (err: any) {
    if (err.code === 4001) {
      throw new EthereumProviderError('User rejected transaction', 4001);
    }
    throw new EthereumProviderError(
      `Transaction failed: ${err.message || 'Unknown error'}`
    );
  }
}

/**
 * Get current chain ID
 */
export async function getCurrentChainId(): Promise<string> {
  const provider = await getEthereumProvider();
  const chainId = await provider.request({ method: 'eth_chainId' });
  return chainId as string;
}

/**
 * Check if currently on Polygon network
 */
export async function isOnPolygon(): Promise<boolean> {
  try {
    const chainId = await getCurrentChainId();
    return chainId === POLYGON_CHAIN_ID;
  } catch {
    return false;
  }
}
