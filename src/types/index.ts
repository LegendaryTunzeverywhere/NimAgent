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
  usdt?: {
    balance: number;
    balanceFormatted: string;
    balanceUSD: string;
    network: string;
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
  type: 'send' | 'gift-card' | 'airtime' | 'bill' | 'qr-code' | 'qr-scan' | 'balance' | 'show-contacts' | 'list-contacts' | 'save-contact' | 'update-contact' | 'delete-contact' | 'lookup-contact' | 'support' | 'referral' | 'leaderboard';
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
    [key: string]: any;
  };
  // Referral fields
  referralLink?: string;
  referralCount?: number;
  qualifiedReferralCount?: number;
  // Leaderboard fields
  leaderboard?: Array<{ wallet_address: string; total_qualified?: number; total_referrals?: number; rank?: number }>;
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
}

export interface AppState {
  wallet: WalletState;
  transactions: Transaction[];
  messages: Message[];
  activeTab: 'home' | 'chat' | 'history';
  currentSessionId: string | null;
  theme: 'dark' | 'light';
  network: 'testnet' | 'mainnet';
  aiLoading: boolean;
  setActiveTab: (tab: 'home' | 'chat' | 'history') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setNetwork: (network: 'testnet' | 'mainnet') => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  fetchBalance: () => Promise<void>;
  loadOrCreateSession: () => Promise<void>;
  startNewSession: () => void;
  addMessage: (message: Message) => Promise<void>;
  updateActionState: (messageIndex: number, actionUpdates: Partial<ActionCard>) => Promise<void>;
  clearMessages: () => void;
  sendMessageToAI: (content: string, walletAddress?: string, options?: { bypassRateLimit?: boolean }) => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
}