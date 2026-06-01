<<<<<<< HEAD
// Shared wallet adapter contract.
//
// NimHub runs in two environments:
//   - "hub":     standalone web build, wallet via the Nimiq Hub popup (@nimiq/hub-api)
//   - "miniapp": inside the Nimiq Pay app, wallet via the injected provider (@nimiq/mini-app-sdk)
//
// Both adapters implement this interface so the rest of the app
// (store, ActionCard) is agnostic to where it runs.

export type WalletKind = 'hub' | 'miniapp';

export interface SignResult {
  publicKey?: string;
  signature: string;
  [key: string]: unknown;
}

export interface PaymentRequest {
  /** Recipient Nimiq address (user-friendly format). */
  recipient: string;
  /** Amount in Luna (1 NIM = 100,000 Luna). */
  value: number;
  /** Optional text message / context attached to the transaction. */
  data?: string;
  /** Optional fee in Luna. Omit to let the wallet choose (often 0). */
  fee?: number;
  /** Optional sender address (skips address selection in Hub mode). */
  sender?: string;
}

export interface WalletAdapter {
  readonly kind: WalletKind;
  /** Prompt the user to share / choose an account, returning its address. */
  getUserAddress(): Promise<string>;
  /** Sign and send a NIM payment. Resolves with the transaction hash. */
  requestPayment(req: PaymentRequest): Promise<string>;
  /** Sign an arbitrary message for identity verification. */
  signMessage(message: string, signer?: string): Promise<SignResult>;
  /** Best-effort warm-up so the eventual wallet call resolves quickly. */
  prewarm(): void;
}
=======
// Shared wallet adapter contract.
//
// NimHub runs in two environments:
//   - "hub":     standalone web build, wallet via the Nimiq Hub popup (@nimiq/hub-api)
//   - "miniapp": inside the Nimiq Pay app, wallet via the injected provider (@nimiq/mini-app-sdk)
//
// Both adapters implement this interface so the rest of the app
// (store, ActionCard) is agnostic to where it runs.

export type WalletKind = 'hub' | 'miniapp';

export interface SignResult {
  publicKey?: string;
  signature: string;
  [key: string]: unknown;
}

export interface PaymentRequest {
  /** Recipient Nimiq address (user-friendly format). */
  recipient: string;
  /** Amount in Luna (1 NIM = 100,000 Luna). */
  value: number;
  /** Optional text message / context attached to the transaction. */
  data?: string;
  /** Optional fee in Luna. Omit to let the wallet choose (often 0). */
  fee?: number;
  /** Optional sender address (skips address selection in Hub mode). */
  sender?: string;
}

export interface WalletAdapter {
  readonly kind: WalletKind;
  /** Prompt the user to share / choose an account, returning its address. */
  getUserAddress(): Promise<string>;
  /** Sign and send a NIM payment. Resolves with the transaction hash. */
  requestPayment(req: PaymentRequest): Promise<string>;
  /** Sign an arbitrary message for identity verification. */
  signMessage(message: string, signer?: string): Promise<SignResult>;
  /** Best-effort warm-up so the eventual wallet call resolves quickly. */
  prewarm(): void;
}
>>>>>>> fe7c71977bd3a17b2432805024c7c963bcd1e6b5
