export interface Transaction {
  id: number;
  type: 'send' | 'receive' | 'bill' | 'gift' | 'airtime' | 'swap';
  label: string;
  amount: string;
  usd?: string;
  time: string;
  icon: string;
  color: string;
  status: 'confirmed' | 'pending' | 'failed';
  category: string;
  hash?: string;
  recipient?: string;
  sender?: string;
}

export interface Balance {
  nim: {
    balance: number;
    balanceFormatted: string;
    balanceUSD: string;
    error?: string;
  };
  totalUSD: string;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp?: number;
  action?: ActionCard;
}

export interface ActionCard {
  type: 'send' | 'gift-card' | 'airtime' | 'bill' | 'qr-code' | 'qr-scan' | 'balance' | 'show-contacts' | 'list-contacts' | 'save-contact' | 'update-contact' | 'delete-contact' | 'lookup-contact' | 'support' | 'referral' | 'leaderboard' | 'browse-catalog';
  recipient?: string;
  recipientAddress?: string;
  nickname?: string;
  oldNickname?: string;
  newNickname?: string;
  category?: string;
  notes?: string;
  contactId?: number;
  amountLuna?: number;
  fiatAmount?: string;
  currency?: string;
  product?: string;
  productId?: string;
  country?: string;        // ISO country code — used by gift-card, airtime, bill validation
  countryCode?: string;    // For browse-catalog action
  phone?: string;
  operator?: string;
  operatorId?: string;
  service?: string;
  accountNumber?: string;
  billerId?: string;
  address?: string;
  message?: string;       // Payment request message / label
  fromCoin?: string;
  toCoin?: string;
  amount?: string;
  recipientEmail?: string;
  formUrl?: string;       // Support form URL
  // Catalog-supplied hints (set by validation, shown as UX context in the card)
  availableAmounts?: number[];   // FIXED denominations the server confirmed are valid
  minAmount?: number;            // Lower bound for RANGE products
  maxAmount?: number;            // Upper bound for RANGE products
  // Payment status fields (persisted)
  completed?: boolean;
  failed?: boolean;
  txHash?: string;
  locked?: boolean;      // Amount locked — cannot be changed by sender (payment request)
  // Fulfillment data — stored after successful order so AI can reference it in follow-ups
  fulfillmentData?: {
    code?: string;       // Gift card redemption code
    pin?: string;        // Gift card PIN or airtime voucher PIN
    serialNumber?: string;
    token?: string;      // Utility prepaid meter token
    reloadlyTransactionId?: number | string;
    reference?: string;
    deliveredAmount?: number;
    deliveredAmountCurrency?: string;
    // Cryptorefills-specific fields (crypto payment flow)
    cryptorefillsOrderId?: string;      // Cryptorefills order ID
    paymentAddress?: string;            // Crypto wallet address to send payment to
    paymentAmount?: string;             // Required crypto amount
    paymentCurrency?: string;           // Crypto currency (e.g., "USDT")
    network?: string;                   // Blockchain network (e.g., "Polygon")
    expiresAt?: string;                 // Payment window expiration
    instructions?: string;              // Redemption instructions
    [key: string]: any;
  };
  // Payment method selection (for orders that support multiple payment types)
  paymentMethod?: 'nim' | 'usdt-polygon';  // Selected payment method
  // Referral fields
  referralLink?: string;
  referralCount?: number;
  qualifiedReferralCount?: number;
  // Leaderboard fields
  leaderboard?: Array<{ wallet_address: string; total_qualified?: number; total_referrals?: number; rank?: number }>;
  // Browse catalog fields
  catalogData?: {
    country: { code: string; name: string };
    productTypes: string[];
    brands: {
      giftcard?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
      physical?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
      airtime?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
      data?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
      esim?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
      bills?: Array<{ name: string; family: string; brandId: string; category?: string; min?: string; max?: string; logoUrl?: string }>;
    };
    summary: {
      totalBrands: number;
      byType: Record<string, number>;
    };
  };
}

export interface QuickAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  action: string;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  balance: Balance | null;
  loading: boolean;
  error: string | null;
  authCompleted: number;
  authChecked: boolean;  // Set to true after mount-time auth check completes
}

export interface AppState {
  wallet: WalletState;
  transactions: Transaction[];
  messages: Message[];
  activeTab: 'home' | 'chat' | 'history';
  currentSessionId: string | null;
  theme: 'dark' | 'light';
  aiLoading: boolean;
  aiStatus: string | null;
  pendingLinkAction: {
    type: 'payment' | 'referral';
    to?: string;
    amount?: string | null;
    message?: string | null;
    ref?: string;
  } | null;
  setActiveTab: (tab: 'home' | 'chat' | 'history') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAiStatus: (status: string | null) => void;
  setPendingLinkAction: (action: AppState['pendingLinkAction']) => void;
  connectWallet: (options?: { isRetry?: boolean }) => Promise<void>;
  disconnectWallet: () => void;
  notifyAuthComplete: () => void;
  fetchBalance: () => Promise<void>;
  loadOrCreateSession: () => Promise<void>;
  startNewSession: () => void;
  addMessage: (message: Message, sessionIdOverride?: string) => Promise<void>;
  updateActionState: (messageIndex: number, actionUpdates: Partial<ActionCard>) => Promise<void>;
  clearMessages: () => void;
  sendMessageToAI: (content: string, walletAddress?: string, options?: { bypassRateLimit?: boolean }) => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
}
