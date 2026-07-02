// Mini-app adapter — runs inside the Nimiq Pay app.

import type { ErrorResponse, NimiqProvider, SignatureResult } from '@nimiq/mini-app-sdk';
import type { WalletAdapter, PaymentRequest, SignResult, NetworkState } from './types';
import { getNimiqProvider } from './detect';

const APP_NAME = 'NimAgent';

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ErrorResponse).error?.message === 'string'
  );
}

function unwrap<T>(value: T | ErrorResponse): T {
  if (isErrorResponse(value)) {
    console.error('[miniapp-adapter] Error response:', value);
    throw new Error(value.error.message || 'Wallet request was rejected.');
  }
  return value;
}

async function provider(): Promise<NimiqProvider> {
  const p = await getNimiqProvider();
  if (!p) throw new Error('Nimiq Pay provider unavailable. Open NimAgent inside the Nimiq Pay app.');
  return p;
}

/** Convert any Nimiq address format to the spaced RPC format "NQ## XXXX …" */
function toRpcAddr(address: string): string {
  const s = address.replace(/\s/g, '').toUpperCase();
  const groups = s.match(/.{1,4}/g) ?? [];
  return groups.join(' ');
}

export const miniAppAdapter: WalletAdapter = {
  kind: 'miniapp',

  prewarm() {
    void getNimiqProvider().catch(() => {});
  },

  async getUserAddress(): Promise<string> {
    const nimiq = await provider();
    const accounts = unwrap(await nimiq.listAccounts());
    if (!accounts.length) throw new Error('No Nimiq account available in Nimiq Pay.');
    if (accounts.length === 1) return accounts[0];

    // Multiple accounts — pick the one with the highest total balance
    // (including HTLCs) so we connect to the funded wallet.
    try {
      const totals = await Promise.all(
        accounts.map(async (addr) => {
          const luna = await miniAppAdapter.getTotalNimBalance(addr);
          return { addr, balance: luna ?? 0 };
        })
      );
      totals.sort((a, b) => b.balance - a.balance);
      console.log('[miniapp-adapter] Account totals:', totals);
      return totals[0].addr;
    } catch {
      return accounts[0];
    }
  },

  async requestPayment(req: PaymentRequest): Promise<string> {
    const nimiq = await provider();
    let txHash;
    try {
      txHash = req.data
        ? unwrap(await nimiq.sendBasicTransactionWithData({
            recipient: req.recipient,
            value: req.value,
            data: req.data,
            ...(req.fee != null ? { fee: req.fee } : {}),
            ...(req.validityStartHeight != null ? { validityStartHeight: req.validityStartHeight } : {}),
          }))
        : unwrap(await nimiq.sendBasicTransaction({
            recipient: req.recipient,
            value: req.value,
            ...(req.fee != null ? { fee: req.fee } : {}),
            ...(req.validityStartHeight != null ? { validityStartHeight: req.validityStartHeight } : {}),
          }));
    } catch (err) {
      console.error('[miniapp-adapter] Transaction failed:', err);
      throw err;
    }
    console.log('[miniapp-adapter] Transaction sent, hash:', txHash);
    return txHash;
  },

  async signMessage(message: string): Promise<SignResult> {
    const nimiq = await provider();
    const result = unwrap<SignatureResult>(await nimiq.sign(message));

    const normaliseHex = (value: string): string => {
      if (!value) return value;
      const stripped = value.startsWith('0x') ? value.slice(2) : value;
      if (!/^[0-9a-fA-F]+$/.test(stripped)) {
        try {
          const bytes = Uint8Array.from(atob(stripped), c => c.charCodeAt(0));
          return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch { return stripped; }
      }
      return stripped.toLowerCase();
    };

    const publicKey = normaliseHex(result.publicKey);
    const signature = normaliseHex(result.signature);
    console.log('[miniapp-adapter] sign result:', {
      publicKeyLength: publicKey?.length,
      signatureLength: signature?.length,
    });
    return { publicKey, signature };
  },

  async getNetworkState(): Promise<NetworkState> {
    const nimiq = await provider();
    const consensusEstablished = unwrap(await nimiq.isConsensusEstablished());
    let blockNumber: number | null = null;
    if (consensusEstablished) {
      try {
        const h = unwrap(await nimiq.getBlockNumber());
        blockNumber = typeof h === 'number' ? h : null;
      } catch { blockNumber = null; }
    }
    return { consensusEstablished, blockNumber };
  },

  /** Basic account balance only (Luna). */
  async getNimBalance(address: string): Promise<number | null> {
    try {
      const nimiq  = await provider();
      const result = await nimiq.request({ method: 'getAccountByAddress', params: [toRpcAddr(address)] }) as any;
      const luna   = result?.data?.balance ?? result?.balance ?? result?.account?.balance;
      return typeof luna === 'number' ? luna : null;
    } catch { return null; }
  },

  /**
   * Total NIM balance = basic account + active outgoing HTLC contracts.
   *
   * Nimiq Pay uses HTLCs for atomic swaps. When NIM is purchased or swapped
   * it gets locked in an HTLC contract (type=2) until the hash pre-image is
   * revealed. During this period the basic account shows 0, but the NIM
   * belongs to the user. We discover these by checking recent outgoing
   * transactions where toType===2 and we're the sender, then summing any
   * that haven't timed out yet.
   */
  async getTotalNimBalance(address: string): Promise<number | null> {
    try {
      const nimiq     = await provider();
      const rpcAddr   = toRpcAddr(address);
      const cleanAddr = address.replace(/\s/g, '').toUpperCase();

      // Basic balance
      const basicResult = await nimiq.request({
        method: 'getAccountByAddress',
        params: [rpcAddr],
      }) as any;
      const basicLuna: number =
        basicResult?.data?.balance ?? basicResult?.balance ?? 0;

      // Recent transactions — getTransactionsByAddress(address, max, startAt)
      // startAt=null means from the latest block backwards
      let htlcAddresses: string[] = [];
      try {
        const txResult = await nimiq.request({
          method: 'getTransactionsByAddress',
          params: [rpcAddr, 20, null],
        }) as any;

        const txList: any[] = txResult?.data ?? txResult ?? [];
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days

        htlcAddresses = txList
          .filter((tx: any) =>
            tx.toType === 2 &&                                         // sent to HTLC
            tx.from?.replace(/\s/g, '') === cleanAddr &&               // we sent it
            (tx.timestamp ?? 0) > cutoff                               // within 30 days
          )
          .map((tx: any) => tx.to as string);

        console.log('[miniapp-adapter] Found HTLC addresses:', htlcAddresses);
      } catch (e) {
        console.warn('[miniapp-adapter] Could not fetch tx history:', e);
        return basicLuna || null;
      }

      if (!htlcAddresses.length) return basicLuna || null;

      // Query each HTLC — only count non-expired ones (timeout > now)
      const now = Date.now();
      const htlcResults = await Promise.all(
        htlcAddresses.map(async (htlcAddr: string) => {
          try {
            const r = await nimiq.request({
              method: 'getAccountByAddress',
              params: [toRpcAddr(htlcAddr)],
            }) as any;
            const d = r?.data ?? r;
            if (d?.type === 'htlc' && typeof d.timeout === 'number' && d.timeout > now) {
              return typeof d.balance === 'number' ? d.balance : 0;
            }
            return 0;
          } catch { return 0; }
        })
      );

      const htlcLuna = htlcResults.reduce((s: number, v: number) => s + v, 0);
      const total    = basicLuna + htlcLuna;
      console.log(`[miniapp-adapter] basic=${basicLuna} htlc=${htlcLuna} total=${total} luna`);
      return total > 0 ? total : null;
    } catch { return null; }
  },
};

void APP_NAME;
