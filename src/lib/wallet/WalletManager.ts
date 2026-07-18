/**
 * Multi-Chain Wallet Manager
 * 
 * Manages wallet connections across multiple blockchains.
 * Ensures the correct address is used for each payment network.
 */

import { connectEthereum, getCurrentChainId, switchToPolygon, POLYGON_CHAIN_ID_DECIMAL } from './evm';
import { getUserAddress as getNimiqAddress } from './index';

export interface WalletAddresses {
  nimiq: string | null;
  polygon: string | null;
  ethereum: string | null;
  bitcoin: string | null;
}

export interface WalletConnectionState {
  nimiq: { connected: boolean; connecting: boolean };
  polygon: { connected: boolean; connecting: boolean };
  ethereum: { connected: boolean; connecting: boolean };
  bitcoin: { connected: boolean; connecting: boolean };
}

export type SupportedChain = 'nimiq' | 'polygon' | 'ethereum' | 'bitcoin';
export type PaymentCoin = 'NIM' | 'USDT' | 'ETH' | 'BTC';

const COIN_TO_CHAIN_MAP: Record<PaymentCoin, SupportedChain> = {
  NIM: 'nimiq',
  USDT: 'polygon',
  ETH: 'ethereum',
  BTC: 'bitcoin',
};

class WalletManager {
  private addresses: WalletAddresses = {
    nimiq: null,
    polygon: null,
    ethereum: null,
    bitcoin: null,
  };

  private connectionState: WalletConnectionState = {
    nimiq: { connected: false, connecting: false },
    polygon: { connected: false, connecting: false },
    ethereum: { connected: false, connecting: false },
    bitcoin: { connected: false, connecting: false },
  };

  /**
   * Get all connected wallet addresses
   */
  getAddresses(): WalletAddresses {
    return { ...this.addresses };
  }

  /**
   * Get address for a specific chain
   */
  getAddress(chain: SupportedChain): string | null {
    return this.addresses[chain];
  }

  /**
   * Get connection state for all chains
   */
  getConnectionState(): WalletConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if a specific chain is connected
   */
  isConnected(chain: SupportedChain): boolean {
    return this.connectionState[chain].connected && !!this.addresses[chain];
  }

  /**
   * Connect to Nimiq wallet (via Nimiq Pay mini-app)
   */
  async connectNimiq(): Promise<string> {
    if (this.addresses.nimiq && this.connectionState.nimiq.connected) {
      console.log('[WalletManager] Nimiq already connected:', this.addresses.nimiq);
      return this.addresses.nimiq;
    }

    if (this.connectionState.nimiq.connecting) {
      throw new Error('Nimiq wallet connection already in progress');
    }

    try {
      this.connectionState.nimiq.connecting = true;
      console.log('[WalletManager] Connecting to Nimiq wallet...');

      const address = await getNimiqAddress();
      
      this.addresses.nimiq = address;
      this.connectionState.nimiq.connected = true;
      
      console.log('[WalletManager] ✅ Nimiq wallet connected:', address);
      return address;
    } catch (error) {
      console.error('[WalletManager] Nimiq connection failed:', error);
      throw new Error(`Failed to connect Nimiq wallet: ${(error as Error).message}`);
    } finally {
      this.connectionState.nimiq.connecting = false;
    }
  }

  /**
   * Connect to Polygon wallet (via window.ethereum in Nimiq Pay)
   */
  async connectPolygon(): Promise<string> {
    if (this.addresses.polygon && this.connectionState.polygon.connected) {
      console.log('[WalletManager] Polygon already connected:', this.addresses.polygon);
      return this.addresses.polygon;
    }

    if (this.connectionState.polygon.connecting) {
      throw new Error('Polygon wallet connection already in progress');
    }

    try {
      this.connectionState.polygon.connecting = true;
      console.log('[WalletManager] Connecting to Polygon wallet...');

      // Connect to Ethereum provider
      const address = await connectEthereum();
      
      // Switch to Polygon network
      await switchToPolygon();
      
      // Verify we're on Polygon
      const chainId = await getCurrentChainId();
      const chainIdDecimal = parseInt(chainId, 16);
      
      if (chainIdDecimal !== POLYGON_CHAIN_ID_DECIMAL) {
        throw new Error(`Not on Polygon network. Current chain ID: ${chainIdDecimal}`);
      }
      
      this.addresses.polygon = address;
      this.connectionState.polygon.connected = true;
      
      console.log('[WalletManager] ✅ Polygon wallet connected:', address);
      return address;
    } catch (error) {
      console.error('[WalletManager] Polygon connection failed:', error);
      throw new Error(`Failed to connect Polygon wallet: ${(error as Error).message}`);
    } finally {
      this.connectionState.polygon.connecting = false;
    }
  }

  /**
   * Connect to Ethereum wallet (mainnet)
   */
  async connectEthereum(): Promise<string> {
    if (this.addresses.ethereum && this.connectionState.ethereum.connected) {
      console.log('[WalletManager] Ethereum already connected:', this.addresses.ethereum);
      return this.addresses.ethereum;
    }

    if (this.connectionState.ethereum.connecting) {
      throw new Error('Ethereum wallet connection already in progress');
    }

    try {
      this.connectionState.ethereum.connecting = true;
      console.log('[WalletManager] Connecting to Ethereum wallet...');

      const address = await connectEthereum();
      
      this.addresses.ethereum = address;
      this.connectionState.ethereum.connected = true;
      
      console.log('[WalletManager] ✅ Ethereum wallet connected:', address);
      return address;
    } catch (error) {
      console.error('[WalletManager] Ethereum connection failed:', error);
      throw new Error(`Failed to connect Ethereum wallet: ${(error as Error).message}`);
    } finally {
      this.connectionState.ethereum.connecting = false;
    }
  }

  /**
   * Connect to Bitcoin wallet (placeholder for future implementation)
   */
  async connectBitcoin(): Promise<string> {
    throw new Error('Bitcoin wallet not yet implemented');
  }

  /**
   * Get the correct wallet address for a payment coin
   * Automatically connects the wallet if not already connected
   */
  async getPaymentAddress(coin: PaymentCoin): Promise<string> {
    const chain = COIN_TO_CHAIN_MAP[coin];
    
    if (!chain) {
      throw new Error(`Unsupported payment coin: ${coin}`);
    }

    console.log(`[WalletManager] Getting payment address for ${coin} (chain: ${chain})`);

    // Check if already connected
    if (this.isConnected(chain)) {
      const address = this.addresses[chain]!;
      console.log(`[WalletManager] Using cached ${chain} address:`, address);
      return address;
    }

    // Auto-connect the required wallet
    console.log(`[WalletManager] ${chain} wallet not connected, connecting now...`);
    
    switch (chain) {
      case 'nimiq':
        return await this.connectNimiq();
      case 'polygon':
        return await this.connectPolygon();
      case 'ethereum':
        return await this.connectEthereum();
      case 'bitcoin':
        return await this.connectBitcoin();
      default:
        throw new Error(`Unknown chain: ${chain}`);
    }
  }

  /**
   * Validate that an address format matches the expected chain
   */
  validateAddressFormat(address: string, chain: SupportedChain): boolean {
    switch (chain) {
      case 'nimiq':
        // NQ followed by 34 alphanumeric characters
        return /^NQ[0-9A-Z]{34}$/i.test(address.replace(/\s/g, ''));
      
      case 'polygon':
      case 'ethereum':
        // 0x followed by 40 hexadecimal characters
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      
      case 'bitcoin':
        // bc1 (Bech32) or 1/3 (legacy)
        return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}$/.test(address);
      
      default:
        return false;
    }
  }

  /**
   * Disconnect a specific wallet
   */
  disconnect(chain: SupportedChain): void {
    this.addresses[chain] = null;
    this.connectionState[chain].connected = false;
    console.log(`[WalletManager] Disconnected ${chain} wallet`);
  }

  /**
   * Disconnect all wallets
   */
  disconnectAll(): void {
    Object.keys(this.addresses).forEach(chain => {
      this.disconnect(chain as SupportedChain);
    });
    console.log('[WalletManager] Disconnected all wallets');
  }

  /**
   * Reset the wallet manager (for testing)
   */
  reset(): void {
    this.disconnectAll();
  }
}

// Export singleton instance
export const walletManager = new WalletManager();

// Export convenience functions
export async function getPaymentAddress(coin: PaymentCoin): Promise<string> {
  return walletManager.getPaymentAddress(coin);
}

export function isWalletConnected(chain: SupportedChain): boolean {
  return walletManager.isConnected(chain);
}

export function validateAddressFormat(address: string, chain: SupportedChain): boolean {
  return walletManager.validateAddressFormat(address, chain);
}
