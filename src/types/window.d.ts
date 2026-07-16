// Global window object type extensions

interface Window {
  /**
   * Nimiq Pay host context object
   * Injected by Nimiq Pay before page scripts run
   */
  nimiqPay?: any;

  /**
   * EIP-1193 Ethereum provider
   * Injected by Nimiq Pay for EVM/Ethereum interactions
   * Follows the standard Ethereum provider interface
   */
  ethereum?: {
    request(args: { method: string; params?: any[] }): Promise<any>;
    on?(event: string, callback: (...args: any[]) => void): void;
    removeListener?(event: string, callback: (...args: any[]) => void): void;
    isMetaMask?: boolean;
    isConnected?: () => boolean;
  };
}
