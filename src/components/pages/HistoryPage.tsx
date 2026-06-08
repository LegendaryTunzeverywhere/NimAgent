'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon, { type IconName } from '@/components/Icon';

interface Transaction {
  id: string;
  type: string;
  from_address?: string;
  to_address?: string;
  amount_luna: number;
  tx_hash?: string;
  status: string;
  created_at: string;
  details?: any;
}

const TRANSACTION_ICONS: Record<string, IconName> = {
  send: 'send',
  receive: 'receive',
  'gift-card': 'gift-card',
  airtime: 'airtime',
  bill: 'bill',
  swap: 'swap',
  stake: 'lock',
  unstake: 'unlock',
};

const TRANSACTION_COLORS: Record<string, string> = {
  send: '#F87171',
  receive: '#34D399',
  'gift-card': '#2B6BD6',
  airtime: '#2B6BD6',
  bill: '#2B6BD6',
  swap: '#F5A623',
  stake: '#D4AF37',
  unstake: '#F59E0B',
};

export default function HistoryPage() {
  const { wallet } = useAppStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchTransactions = useCallback(async (showLoading = false) => {
    if (!wallet.address) return;
    
    if (showLoading) {
      setLoading(true);
    }
    setLastFetch(Date.now());
    
    try {
      // Normalize wallet address - remove spaces for consistent querying
      const normalizedAddress = wallet.address.replace(/\s/g, '');
      
      console.log('[HistoryPage] Fetching for wallet:', wallet.address);
      console.log('[HistoryPage] Normalized:', normalizedAddress);
      
      // Use BFF proxy (same-origin request)
      
      // Fetch from both transactions and orders tables
      const [transactionsRes, ordersRes] = await Promise.all([
        fetch(`/api/transactions?wallet=${encodeURIComponent(normalizedAddress)}`),
        fetch(`/api/orders?wallet=${encodeURIComponent(normalizedAddress)}`)
      ]);
      
      let allTransactions: Transaction[] = [];
      
      // Add regular transactions (send/receive)
      if (transactionsRes.ok) {
        const transData = await transactionsRes.json();
        const rawTransactions = transData.transactions || [];
        
        console.log('[HistoryPage] Raw transactions from API:', rawTransactions.length);
        
        // Determine transaction type based on wallet address
        const processedTransactions = rawTransactions.map((tx: any) => {
          // Clean addresses for comparison (remove spaces)
          const cleanWalletAddr = wallet.address?.replace(/\s/g, '').toLowerCase();
          const cleanFromAddr = tx.from_address?.replace(/\s/g, '').toLowerCase();
          const cleanToAddr = tx.to_address?.replace(/\s/g, '').toLowerCase();
          
          console.log('[HistoryPage] Processing tx:', {
            id: tx.id,
            from: cleanFromAddr?.slice(0, 10),
            to: cleanToAddr?.slice(0, 10),
            wallet: cleanWalletAddr?.slice(0, 10),
            originalType: tx.type
          });
          
          // Preserve special transaction types (stake, unstake, orders)
          // Only override if type is null/undefined
          let type = tx.type;
          
          // Don't override stake/unstake/order types
          if (type && ['stake', 'unstake', 'gift-card', 'airtime', 'bill'].includes(type)) {
            console.log('[HistoryPage] Preserving type:', type);
            return {
              ...tx,
              type,
            };
          }
          
          // For regular transactions without a type, determine if it's send or receive
          // If from_address matches wallet, it's a send
          if (cleanFromAddr && cleanFromAddr === cleanWalletAddr) {
            type = 'send';
            console.log('[HistoryPage] Detected SEND (from matches wallet)');
          } 
          // If to_address matches wallet, it's a receive
          else if (cleanToAddr && cleanToAddr === cleanWalletAddr) {
            type = 'receive';
            console.log('[HistoryPage] Detected RECEIVE (to matches wallet)');
          }
          // If type is not set and we have both addresses
          else if (!type && cleanFromAddr && cleanToAddr) {
            // Default to send if we can't determine
            type = 'send';
            console.log('[HistoryPage] Defaulting to SEND (unclear)');
          }
          
          return {
            ...tx,
            type,
          };
        });
        
        console.log('[HistoryPage] Processed transaction types:', processedTransactions.map((t: any) => t.type));
        
        allTransactions = processedTransactions;
      }
      
      // Add orders (gift cards, airtime, bills) as transactions
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const orderTransactions = (ordersData.orders || []).map((order: any) => ({
          id: `order-${order.id}`,
          type: order.type,
          from_address: order.wallet_address,
          to_address: null,
          amount_luna: order.amount_luna,
          tx_hash: order.tx_hash,
          status: order.status,
          created_at: order.created_at,
          details: order.details,
        }));
        allTransactions = [...allTransactions, ...orderTransactions];
      }
      
      // Sort by date (newest first)
      allTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log('[HistoryPage] Fetched transactions:', allTransactions.length);
      console.log('[HistoryPage] Transaction types:', allTransactions.map(t => t.type));
      
      setTransactions(allTransactions);
      // Don't reset expandedTx - preserve the expanded state
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [wallet.address, isInitialLoad]);

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      fetchTransactions(true); // Initial load with loading state
    }
  }, [wallet.connected, wallet.address, fetchTransactions]);

  // Auto-refresh when tab becomes visible or every 10 seconds
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && wallet.connected && wallet.address) {
        // Only refresh if last fetch was more than 3 seconds ago
        if (Date.now() - lastFetch > 3000) {
          fetchTransactions(false); // Silent refresh
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Auto-refresh every 10 seconds when page is visible
    const interval = setInterval(() => {
      if (!document.hidden && wallet.connected && wallet.address) {
        fetchTransactions(false); // Silent refresh
      }
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [wallet.connected, wallet.address, lastFetch, fetchTransactions]);

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'All') return true;
    if (filter === 'Sent') return tx.type === 'send';
    if (filter === 'Received') return tx.type === 'receive';
    if (filter === 'Staking') return tx.type === 'stake' || tx.type === 'unstake';
    if (filter === 'Bills') return tx.type === 'bill';
    if (filter === 'Gift Cards') return tx.type === 'gift-card';
    if (filter === 'Airtime') return tx.type === 'airtime';
    return true;
  });

  const formatAmount = (luna: number, type: string) => {
    const nim = (luna / 100000).toFixed(2);
    // Receive shows +, stake/unstake show no sign, everything else shows -
    const sign = type === 'receive' ? '+' : (type === 'stake' || type === 'unstake') ? '' : '-';
    return `${sign}${nim} NIM`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getTransactionLabel = (tx: Transaction) => {
    if (tx.type === 'send' && tx.to_address) {
      return `Sent to ${tx.to_address.slice(0, 4)}…${tx.to_address.slice(-4)}`;
    }
    if (tx.type === 'receive' && tx.from_address) {
      return `Received from ${tx.from_address.slice(0, 4)}…${tx.from_address.slice(-4)}`;
    }
    if (tx.type === 'stake') {
      if (tx.to_address) {
        return `Staked with ${tx.to_address.slice(0, 4)}…${tx.to_address.slice(-4)}`;
      }
      return 'NIM Staked';
    }
    if (tx.type === 'unstake') {
      return 'NIM Unstaked';
    }
    if (tx.type === 'gift-card') {
      const product = tx.details?.product || 'Gift Card';
      return `${product} Purchase`;
    }
    if (tx.type === 'airtime') {
      const phone = tx.details?.phone;
      return phone ? `Airtime to ${phone.slice(-4)}` : 'Airtime Top-up';
    }
    if (tx.type === 'bill') {
      const service = tx.details?.service || 'Bill';
      return `${service} Payment`;
    }
    return 'Transaction';
  };

  const openExplorer = (txHash: string) => {
    const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://nimiq.watch/#' 
      : 'https://test.nimiq.watch/#';
    window.open(`${baseUrl}${txHash}`, '_blank');
  };

  // Calculate stats
  const totalSent = transactions
    .filter(tx => tx.type === 'send')
    .reduce((sum, tx) => sum + tx.amount_luna, 0) / 100000;
  const totalReceived = transactions
    .filter(tx => tx.type === 'receive')
    .reduce((sum, tx) => sum + tx.amount_luna, 0) / 100000;
  
  const stats = {
    totalSent,
    totalReceived,
    netChange: totalReceived - totalSent,
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon name="history" size={20} className="text-amber-600 dark:text-gold" />
          Transaction History
        </h1>
        {wallet.connected && (
          <button
            onClick={() => fetchTransactions(true)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright transition-colors disabled:opacity-50"
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              className={loading ? 'animate-spin' : ''}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {loading ? 'Loading' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Filter Pills with Scroll Indicators */}
      <div className="relative">
        {/* Left scroll indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-background-primary to-transparent flex items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400 dark:text-white/30 ml-1"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        
        {/* Right scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l from-white dark:from-background-primary to-transparent flex items-center justify-end">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400 dark:text-white/30 mr-1 animate-pulse"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {['All', 'Sent', 'Received', 'Staking', 'Bills', 'Gift Cards', 'Airtime'].map((filterOption) => (
            <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`rounded-full px-3 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
              filter === filterOption
                ? 'bg-amber-600 dark:bg-gold text-white dark:text-background-primary'
                : 'glass text-gray-600 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/70'
            }`}
          >
            {filterOption}
          </button>
        ))}
        </div>
      </div>

      {/* Transactions List */}
      {wallet.connected ? (
        <>
          {loading ? (
            <div className="card-premium rounded-2xl p-8 text-center">
              <div className="w-10 h-10 mx-auto mb-3 border-2 border-amber-200 dark:border-gold/30 border-t-amber-600 dark:border-t-gold rounded-full animate-spin" />
              <p className="text-sm text-gray-600 dark:text-white/60">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="card-premium rounded-2xl overflow-hidden">
                  <div
                    onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                    className="px-4 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${TRANSACTION_COLORS[tx.type] || '#F5A623'}18`,
                        color: TRANSACTION_COLORS[tx.type] || '#F5A623',
                        border: `1px solid ${TRANSACTION_COLORS[tx.type] || '#F5A623'}30`,
                      }}
                    >
                      <Icon name={TRANSACTION_ICONS[tx.type] || 'wallet'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {getTransactionLabel(tx)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400 dark:text-white/30">{formatDate(tx.created_at)}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-success/12 text-success">
                          <Icon name="check" size={9} strokeWidth={3} /> {tx.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-sm font-bold"
                        style={{ 
                          color: tx.type === 'receive' ? '#34D399' : 'inherit' 
                        }}
                      >
                        {formatAmount(tx.amount_luna, tx.type)}
                      </p>
                      {tx.tx_hash && (
                        <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 font-mono">
                          {tx.tx_hash.slice(0, 6)}...
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-1">
                      <Icon
                        name="chevron-down"
                        size={16}
                        strokeWidth={2}
                        className={`text-gray-400 dark:text-white/30 transition-transform ${expandedTx === tx.id ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedTx === tx.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-white/5 space-y-2 animate-fade-up">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/40">Type:</span>
                        <span className="text-xs text-gray-700 dark:text-white/70 capitalize">{tx.type.replace('-', ' ')}</span>
                      </div>
                      {tx.from_address && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-gray-500 dark:text-white/40">From:</span>
                          <span className="text-xs text-gray-700 dark:text-white/70 font-mono text-right break-all">
                            {tx.from_address}
                          </span>
                        </div>
                      )}
                      {tx.to_address && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-gray-500 dark:text-white/40">To:</span>
                          <span className="text-xs text-gray-700 dark:text-white/70 font-mono text-right break-all">
                            {tx.to_address}
                          </span>
                        </div>
                      )}
                      {/* Order-specific details */}
                      {tx.details && tx.type === 'gift-card' && (
                        <>
                          {tx.details.product && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Product:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70">{tx.details.product}</span>
                            </div>
                          )}
                          {tx.details.recipientEmail && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Sent to:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70">{tx.details.recipientEmail}</span>
                            </div>
                          )}
                        </>
                      )}
                      {tx.details && tx.type === 'airtime' && (
                        <>
                          {tx.details.phone && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Phone:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70 font-mono">{tx.details.phone}</span>
                            </div>
                          )}
                          {tx.details.operator && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Operator:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70">{tx.details.operator}</span>
                            </div>
                          )}
                        </>
                      )}
                      {tx.details && tx.type === 'bill' && (
                        <>
                          {tx.details.service && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Service:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70">{tx.details.service}</span>
                            </div>
                          )}
                          {tx.details.accountNumber && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-white/40">Account:</span>
                              <span className="text-xs text-gray-700 dark:text-white/70 font-mono">{tx.details.accountNumber}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/40">Amount:</span>
                        <span className="text-xs text-gray-700 dark:text-white/70 font-mono">
                          {(tx.amount_luna / 100000).toFixed(5)} NIM
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/40">Status:</span>
                        <span className="text-xs text-success font-semibold capitalize">
                          {tx.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/40">Date & Time:</span>
                        <span className="text-xs text-gray-700 dark:text-white/70">
                          {new Date(tx.created_at).toLocaleString()}
                        </span>
                      </div>
                      {tx.tx_hash && (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-gray-500 dark:text-white/40">TX Hash:</span>
                            <span className="text-xs text-gray-700 dark:text-white/70 font-mono text-right break-all">
                              {tx.tx_hash}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openExplorer(tx.tx_hash!);
                            }}
                            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-gold/10 text-amber-600 dark:text-gold border border-amber-200 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Icon name="explorer" size={13} strokeWidth={2} /> View on Explorer
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card-premium rounded-2xl p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-white/30">
                <Icon name="history" size={26} />
              </div>
              <p className="text-sm text-gray-600 dark:text-white/60">No transactions yet</p>
              <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                Your transaction history will appear here
              </p>
            </div>
          )}

          {/* Stats Summary */}
          {filteredTransactions.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="card-premium rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-white/40 mb-1">Total Sent</p>
                <p className="text-lg font-bold text-error tabular-nums">{stats.totalSent.toFixed(2)}</p>
                <p className="text-xs text-gray-400 dark:text-white/30">NIM</p>
              </div>
              <div className="card-premium rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-white/40 mb-1">Total Received</p>
                <p className="text-lg font-bold text-success tabular-nums">{stats.totalReceived.toFixed(2)}</p>
                <p className="text-xs text-gray-400 dark:text-white/30">NIM</p>
              </div>
              <div className="card-premium rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-white/40 mb-1">Net Change</p>
                <p className={`text-lg font-bold tabular-nums ${stats.netChange >= 0 ? 'text-success' : 'text-error'}`}>
                  {stats.netChange >= 0 ? '+' : ''}{stats.netChange.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/30">NIM</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-premium rounded-2xl p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 dark:bg-gold/10 flex items-center justify-center text-amber-600 dark:text-gold">
            <Icon name="wallet" size={26} />
          </div>
          <p className="text-sm text-gray-600 dark:text-white/60 mb-2">Connect your wallet</p>
          <p className="text-xs text-gray-400 dark:text-white/40">
            Connect your wallet to view your transaction history
          </p>
        </div>
      )}
    </div>
  );
}