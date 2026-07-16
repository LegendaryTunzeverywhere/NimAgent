'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { retrieveGiftCardCode, getWalletRequestHeaders } from '@/lib/api-client';
import { openExternalUrl } from '@/lib/external-links';
import Icon, { type IconName } from '@/components/Icon';
import { PageLoading } from '@/components/LoadingSpinner';

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
  fulfillment_data?: {
    // Bill payments
    token?: string;
    tokenInfo1?: string;
    tokenInfo2?: string;
    tokenInfo3?: string;
    deliveryAmount?: number;
    deliveryAmountCurrency?: string;
    serviceType?: string;
    billerName?: string;
    reference?: string;
    // Gift cards
    code?: string;
    pin?: string;
    serialNumber?: string;
    instructionLink?: string;
    productName?: string;
    // Airtime
    operatorName?: string;
    operatorTransactionId?: string;
    deliveredAmount?: number;
    deliveredAmountCurrency?: string;
    requestedAmount?: number;
    requestedAmountCurrency?: string;
    pinSerial?: string;
    pinInfo?: string;
    // Shared
    reloadlyTransactionId?: number | string;
    status?: string;
    [key: string]: any;
  };
  cashback?: {
    amount_luna: number;
    amount_nim: number;
    status?: string;
    paid_tx_hash?: string;
    failure_reason?: string;
  };
}

const TRANSACTION_ICONS: Record<string, IconName> = {
  send: 'send',
  receive: 'receive',
  'gift-card': 'gift-card',
  airtime: 'airtime',
  bill: 'bill',
  swap: 'swap',
};

const TRANSACTION_COLORS: Record<string, string> = {
  send: '#D94432',      // Nimiq Red for outgoing
  receive: '#21BCA5',   // Nimiq Green for incoming
  'gift-card': '#0582CA', // Nimiq Light Blue for commerce
  airtime: '#0582CA',   // Nimiq Light Blue for commerce
  bill: '#0582CA',      // Nimiq Light Blue for commerce
};

export default function HistoryPage() {
  const { wallet } = useAppStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  // Gift card code retrieval state: orderId → { loading, code, pin, error }
  const [codeRetrievals, setCodeRetrievals] = useState<Record<string, { loading: boolean; code?: string; pin?: string | null; error?: string }>>({});

  const handleRetrieveCode = async (orderId: string) => {
    if (!wallet.address) return;
    setCodeRetrievals(prev => ({ ...prev, [orderId]: { loading: true } }));
    try {
      const result = await retrieveGiftCardCode(orderId, wallet.address);
      setCodeRetrievals(prev => ({ ...prev, [orderId]: { loading: false, code: result.code, pin: result.pin ?? null } }));
    } catch (err: any) {
      // If order is pending refund, tell the user clearly
      const msg = err.message?.includes('completed')
        ? 'This order failed and is pending a refund — code not available.'
        : (err.message || 'Failed to retrieve code');
      setCodeRetrievals(prev => ({ ...prev, [orderId]: { loading: false, error: msg } }));
    }
  };

  const fetchTransactions = useCallback(async (
    showLoading = false,
    options?: { requireWalletSession?: boolean }
  ) => {
    if (!wallet.address) return;
    
    if (showLoading) {
      setLoading(true);
    }
    setLastFetch(Date.now());
    
    try {
      // Normalize wallet address - remove spaces for consistent querying
      const normalizedAddress = wallet.address.replace(/\s/g, '');
      
      // No logs
      
      // Use BFF proxy (same-origin request)
      
      // Build query params with date filters
      const params = new URLSearchParams();
      params.set('wallet', normalizedAddress);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const walletHeaders = await getWalletRequestHeaders('GET', normalizedAddress, options);
      
      // Fetch from both transactions and orders tables
      const [transactionsRes, ordersRes] = await Promise.all([
        fetch(`/api/transactions?${params.toString()}`, { headers: walletHeaders }),
        fetch(`/api/orders?${params.toString()}`, { headers: walletHeaders })
      ]);

      let allTransactions: Transaction[] = [];
      
      // Add regular transactions (send/receive)
      if (transactionsRes.ok) {
        const transData = await transactionsRes.json();
        const rawTransactions = transData.transactions || [];
        
        // No logs
        
        // Determine transaction type based on wallet address
        const processedTransactions = rawTransactions.map((tx: any) => {
          // Clean addresses for comparison (remove spaces)
          const cleanWalletAddr = wallet.address?.replace(/\s/g, '').toLowerCase();
          const cleanFromAddr = tx.from_address?.replace(/\s/g, '').toLowerCase();
          const cleanToAddr = tx.to_address?.replace(/\s/g, '').toLowerCase();
          
          // No logs
          
          // Preserve special transaction types (stake, unstake, orders)
          // Only override if type is null/undefined
          let type = tx.type;
          
          // Don't override stake/unstake/withdraw/order types
          if (type && ['gift-card', 'airtime', 'bill'].includes(type)) {
            return {
              ...tx,
              type,
            };
          }
          
          // For regular transactions without a type, determine if it's send or receive
          // If from_address matches wallet, it's a send
          if (cleanFromAddr && cleanFromAddr === cleanWalletAddr) {
            type = 'send';
          } 
          // If to_address matches wallet, it's a receive
          else if (cleanToAddr && cleanToAddr === cleanWalletAddr) {
            type = 'receive';
          }
          // If type is not set and we have both addresses
          else if (!type && cleanFromAddr && cleanToAddr) {
            // Default to send if we can't determine
            type = 'send';
          }
          
          return {
            ...tx,
            type,
          };
        });
        
        // No logs
        
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
          fulfillment_data: order.fulfillment_data,
          cashback: order.cashback && order.cashback.length > 0 ? order.cashback[0] : undefined,
        }));
        allTransactions = [...allTransactions, ...orderTransactions];
      }
      
      // Sort by date (newest first)
      allTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // No logs
      
      setTransactions(allTransactions);
      // Don't reset expandedTx - preserve the expanded state
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } catch (error) {
      // Silent failure
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [
    wallet.address,
    isInitialLoad,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      fetchTransactions(true, { requireWalletSession: false }); // Initial load with loading state
    }
  }, [wallet.connected, wallet.address, fetchTransactions]);

  // Auto-refresh when tab becomes visible or every 10 seconds
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && wallet.connected && wallet.address) {
        // Only refresh if last fetch was more than 3 seconds ago
        if (Date.now() - lastFetch > 3000) {
          fetchTransactions(false, { requireWalletSession: false }); // Silent refresh
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Auto-refresh every 10 seconds when page is visible
    const interval = setInterval(() => {
      if (!document.hidden && wallet.connected && wallet.address) {
        fetchTransactions(false, { requireWalletSession: false }); // Silent refresh
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
    if (filter === 'Bills') return tx.type === 'bill';
    if (filter === 'Gift Cards') return tx.type === 'gift-card';
    if (filter === 'Airtime') return tx.type === 'airtime';
    return true;
  });

  const formatAmount = (luna: number, type: string) => {
    const nim = (luna / 100000).toFixed(2);
    // Receive shows +, everything else shows -
    const sign = type === 'receive' ? '+' : '-';
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
    if (tx.type === 'send') {
      if (tx.to_address) {
        const addr = tx.to_address.replace(/\s/g, '');
        return `Sent to ${addr.slice(0, 4)}…${addr.slice(-4)}`;
      }
      return 'NIM Sent';
    }
    if (tx.type === 'receive') {
      if (tx.from_address) {
        const addr = tx.from_address.replace(/\s/g, '');
        return `Received from ${addr.slice(0, 4)}…${addr.slice(-4)}`;
      }
      return 'NIM Received';
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

  const openExplorer = (txHash: string, isPolygon: boolean = false) => {
    if (isPolygon) {
      // Polygon tx - open PolygonScan
      openExternalUrl(`https://polygonscan.com/tx/${txHash}`);
    } else {
      // Nimiq tx - open Nimiq Watch
      openExternalUrl(`https://nimiq.watch/#${txHash}`);
    }
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
        <h1 className="text-lg font-bold text-[#1F2348] dark:text-white flex items-center gap-2">
          <Icon name="history" size={20} className="text-[#E9B213]" />
          Transaction History
        </h1>
        <div className="flex items-center gap-2">
          {wallet.connected && (
            <>
              {/* Date Filter Button */}
              <button
                onClick={() => setShowDateFilter(true)}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  startDate || endDate 
                  ? 'bg-[#E9B213] text-[#1F2348] shadow-md' 
                  : 'bg-white/80 dark:bg-white/5 text-[#1F2348]/70 dark:text-white/70 hover:bg-white dark:hover:bg-white/10 border border-[#1F2348]/10 dark:border-white/10'
                }`}
                title="Filter by Date"
              >
                <Icon name="calendar" size={18} />
              </button>
              <button
                onClick={() => fetchTransactions(true)}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-[#E9B213] hover:text-[#FC8702] transition-colors disabled:opacity-50"
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
            </>
          )}
        </div>
      </div>

      {/* Filter Pills with Scroll Indicators */}
      <div className="relative -mx-4">
        {/* Left scroll button */}
        <button
          onClick={() => {
            const container = document.getElementById('filter-pills-container');
            if (container) {
              container.scrollBy({ left: -150, behavior: 'smooth' });
            }
          }}
          className="absolute left-0 top-0 bottom-0 w-10 z-20 bg-gradient-to-r from-[#FAFAFA] dark:from-[#0F1219] via-[#FAFAFA]/80 dark:via-[#0F1219]/80 to-transparent flex items-center justify-center hover:from-[#FAFAFA] dark:hover:from-[#0F1219] transition-all group"
          aria-label="Scroll left"
        >
          <div className="w-7 h-7 rounded-full bg-white dark:bg-white/10 shadow-md border border-[#1F2348]/20 dark:border-white/20 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-white/15 group-hover:scale-110 transition-all">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#1F2348]/80 dark:text-white/80"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
        </button>
        
        {/* Right scroll button */}
        <button
          onClick={() => {
            const container = document.getElementById('filter-pills-container');
            if (container) {
              container.scrollBy({ left: 150, behavior: 'smooth' });
            }
          }}
          className="absolute right-0 top-0 bottom-0 w-10 z-20 bg-gradient-to-l from-[#FAFAFA] dark:from-[#0F1219] via-[#FAFAFA]/80 dark:via-[#0F1219]/80 to-transparent flex items-center justify-center hover:from-[#FAFAFA] dark:hover:from-[#0F1219] transition-all group"
          aria-label="Scroll right"
        >
          <div className="w-7 h-7 rounded-full bg-white dark:bg-white/10 shadow-md border border-[#E9B213]/30 flex items-center justify-center group-hover:bg-[#E9B213]/10 dark:group-hover:bg-[#E9B213]/15 group-hover:scale-110 transition-all animate-pulse">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#E9B213]"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        <div id="filter-pills-container" className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 px-4">
          {['All', 'Sent', 'Received', 'Bills', 'Gift Cards', 'Airtime'].map((filterOption) => (
            <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`rounded-full px-3 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
              filter === filterOption
                ? 'bg-[#E9B213] text-[#1F2348]'
                : 'glass text-[#1F2348]/70 dark:text-white/65 hover:text-[#1F2348] dark:hover:text-white/70'
            }`}
          >
            {filterOption}
          </button>
        ))}
        </div>
      </div>

      {/* Date Filter Modal */}
      {showDateFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDateFilter(false)}>
          <div className="max-w-md w-full card-premium rounded-3xl p-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="calendar" size={20} className="text-[#E9B213] dark:text-gold" />
                <p className="text-sm font-bold text-[#1F2348] dark:text-white">Date Range Filter</p>
              </div>
              <button
                onClick={() => setShowDateFilter(false)}
                className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/10 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 transition-all"
              >
                <Icon name="chevron-right" size={14} className="rotate-90 text-[#1F2348]/60 dark:text-white/60" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#1F2348]/60 dark:text-white/60 font-semibold uppercase tracking-wide">From</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        // Enforce max 4 months range
                        if (endDate && newStart) {
                          const start = new Date(newStart);
                          const end = new Date(endDate);
                          const maxEnd = new Date(start);
                          maxEnd.setMonth(maxEnd.getMonth() + 4);
                          if (end > maxEnd) {
                            setEndDate(maxEnd.toISOString().split('T')[0]);
                          }
                        }
                        setStartDate(newStart);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-[#1F2348]/20 dark:border-white/20 text-[#1F2348] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E9B213]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#1F2348]/60 dark:text-white/60 font-semibold uppercase tracking-wide">To</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        // Enforce max 4 months range
                        if (startDate && newEnd) {
                          const start = new Date(startDate);
                          const end = new Date(newEnd);
                          const minStart = new Date(end);
                          minStart.setMonth(minStart.getMonth() - 4);
                          if (start < minStart) {
                            setStartDate(minStart.toISOString().split('T')[0]);
                          }
                        }
                        setEndDate(newEnd);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-[#1F2348]/20 dark:border-white/20 text-[#1F2348] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E9B213]"
                    />
                  </div>
                </div>
              </div>
              {/* Quick preset buttons */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    const now = new Date();
                    const weekAgo = new Date(now);
                    weekAgo.setDate(now.getDate() - 7);
                    setStartDate(weekAgo.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#E9B213]/10 text-[#E9B213] hover:bg-[#E9B213]/20 border border-[#E9B213]/20 transition-all"
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const monthAgo = new Date(now);
                    monthAgo.setMonth(now.getMonth() - 1);
                    setStartDate(monthAgo.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#E9B213]/10 text-[#E9B213] hover:bg-[#E9B213]/20 border border-[#E9B213]/20 transition-all"
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const fourMonthsAgo = new Date(now);
                    fourMonthsAgo.setMonth(now.getMonth() - 4);
                    setStartDate(fourMonthsAgo.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#E9B213]/10 text-[#E9B213] hover:bg-[#E9B213]/20 border border-[#E9B213]/20 transition-all"
                >
                  Last 4 months
                </button>
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-white/80 dark:bg-white/10 border border-[#1F2348]/10 dark:border-white/10 text-[#1F2348]/70 dark:text-white/70 hover:bg-white dark:hover:bg-white/20 transition-all"
                >
                  Reset
                </button>
              </div>
              {/* Apply button */}
              <button
                onClick={() => {
                  fetchTransactions(true);
                  setShowDateFilter(false);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#E9B213] text-[#1F2348] hover:bg-[#FC8702] transition-all"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      {wallet.connected ? (
        <>
          {loading ? (
            <div className="card-premium rounded-2xl p-8">
              <PageLoading message="Loading transactions..." />
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="card-premium rounded-2xl overflow-hidden">
                  <div
                    onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                    className="px-4 py-4 flex items-center gap-3 hover:bg-[#1F2348]/[0.02] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
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
                      <p className="text-sm font-semibold text-[#1F2348] dark:text-white truncate">
                        {getTransactionLabel(tx)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#1F2348]/60 dark:text-white/65">{formatDate(tx.created_at)}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-success/12 text-success">
                          <Icon name="check" size={9} strokeWidth={3} /> {tx.status}
                        </span>
                        {/* Payment Method Badge (Priority 1 fix) */}
                        {(tx.type === 'gift-card' || tx.type === 'airtime' || tx.type === 'bill') && tx.tx_hash && (
                          <>
                            {tx.tx_hash.startsWith('0x') ? (
                              <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                💎 USDT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-semibold bg-[#E9B213]/12 text-[#E9B213] border border-[#E9B213]/20">
                                ⭐ NIM
                              </span>
                            )}
                          </>
                        )}
                        {tx.cashback && (
                          <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-semibold bg-[#E9B213]/10 text-[#E9B213] border border-[#E9B213]/20">
                            +{tx.cashback.amount_nim < 0.01
                              ? tx.cashback.amount_nim.toFixed(4)
                              : tx.cashback.amount_nim.toFixed(2)} NIM back
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          tx.type === 'receive' 
                            ? 'text-[#21BCA5]' // Nimiq Green for received
                            : 'text-[#D94432]'  // Nimiq Red for sent/outgoing
                        }`}
                      >
                        {formatAmount(tx.amount_luna, tx.type)}
                      </p>
                      {tx.tx_hash && (
                        <p className="text-xs text-[#1F2348]/60 dark:text-white/65 mt-0.5 font-mono">
                          {tx.tx_hash.slice(0, 6)}...
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-1">
                      <Icon
                        name="chevron-down"
                        size={16}
                        strokeWidth={2}
                        className={`text-[#1F2348]/60 dark:text-white/65 transition-transform ${expandedTx === tx.id ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedTx === tx.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#1F2348]/10 dark:border-white/5 space-y-2 animate-fade-up">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Type:</span>
                        <span className="text-xs text-[#1F2348] dark:text-white/80 capitalize">{tx.type.replace('-', ' ')}</span>
                      </div>
                      {tx.from_address && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-[#1F2348]/60 dark:text-white/55">From:</span>
                          <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono text-right break-all">
                            {tx.from_address}
                          </span>
                        </div>
                      )}
                      {tx.to_address && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-[#1F2348]/60 dark:text-white/55">To:</span>
                          <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono text-right break-all">
                            {tx.to_address}
                          </span>
                        </div>
                      )}
                      {/* Order-specific details */}
                      {tx.details && tx.type === 'gift-card' && (
                        <>
                          {tx.details.product && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Product:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80">{tx.details.product}</span>
                            </div>
                          )}
                          {tx.details.recipientEmail && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Sent to:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80">{tx.details.recipientEmail}</span>
                            </div>
                          )}
                          {tx.fulfillment_data?.code && (
                            <div className="mt-1 rounded-xl bg-emerald-500/8 dark:bg-emerald-400/8 border border-emerald-500/15 dark:border-emerald-400/15 px-3 py-2.5 space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">🎟️ Code</span>
                                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 tracking-wider select-all">
                                  {tx.fulfillment_data.code}
                                </span>
                              </div>
                              {tx.fulfillment_data.pin && (
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">PIN</span>
                                  <span className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                    {tx.fulfillment_data.pin}
                                  </span>
                                </div>
                              )}
                              {tx.fulfillment_data.serialNumber && (
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">Serial</span>
                                  <span className="text-[10px] font-mono text-emerald-700/80 dark:text-emerald-300/80">
                                    {tx.fulfillment_data.serialNumber}
                                  </span>
                                </div>
                              )}
                              <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">⚠️ Keep this safe</p>
                            </div>
                          )}
                          {/* No code yet — show retrieve button if order is completed */}
                          {!tx.fulfillment_data?.code && tx.status === 'completed' && tx.fulfillment_data?.reloadlyTransactionId && (() => {
                            const retrieval = codeRetrievals[tx.id];
                            const retrieved = retrieval?.code;
                            return (
                              <div className="mt-1 rounded-xl bg-emerald-500/8 dark:bg-emerald-400/8 border border-emerald-500/15 dark:border-emerald-400/15 px-3 py-2.5 space-y-1.5">
                                {retrieved ? (
                                  <>
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">🎟️ Code</span>
                                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 tracking-wider select-all">{retrieved}</span>
                                    </div>
                                    {retrieval.pin && (
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">PIN</span>
                                        <span className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">{retrieval.pin}</span>
                                      </div>
                                    )}
                                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">⚠️ Keep this safe</p>
                                  </>
                                ) : retrieval?.error ? (
                                  <p className="text-[10px] text-[#E9B213] dark:text-gold">{retrieval.error}</p>
                                ) : (
                                  <>
                                    <p className="text-[10px] text-[#1F2348]/60 dark:text-white/55">Redemption code not yet available</p>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRetrieveCode(tx.id); }}
                                      disabled={retrieval?.loading}
                                      className="w-full py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
                                    >
                                      {retrieval?.loading ? 'Fetching…' : '🔄 Retrieve Code'}
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                      {tx.details && tx.type === 'airtime' && (
                        <>
                          {tx.details.phone && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Phone:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">{tx.details.phone}</span>
                            </div>
                          )}
                          {tx.details.operator && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Operator:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80">{tx.fulfillment_data?.operatorName || tx.details.operator}</span>
                            </div>
                          )}
                          {tx.fulfillment_data?.deliveredAmount && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Delivered:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">
                                {tx.fulfillment_data.deliveredAmount} {tx.fulfillment_data.deliveredAmountCurrency || ''}
                              </span>
                            </div>
                          )}
                          {tx.fulfillment_data?.pin && (
                            <div className="mt-1 rounded-xl bg-purple-500/8 dark:bg-purple-400/8 border border-purple-500/15 dark:border-purple-400/15 px-3 py-2.5 space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">🔑 PIN</span>
                                <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 select-all">
                                  {tx.fulfillment_data.pin}
                                </span>
                              </div>
                              {tx.fulfillment_data.pinSerial && (
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-[10px] text-purple-600/70 dark:text-purple-400/60">Serial</span>
                                  <span className="text-[10px] font-mono text-purple-700/80 dark:text-purple-300/80">{tx.fulfillment_data.pinSerial}</span>
                                </div>
                              )}
                              <p className="text-[10px] text-purple-600/60 dark:text-purple-400/50">Enter this PIN to load credit</p>
                            </div>
                          )}
                          {tx.fulfillment_data?.reference && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Ref:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">{tx.fulfillment_data.reference}</span>
                            </div>
                          )}
                        </>
                      )}
                      {tx.details && tx.type === 'bill' && (
                        <>
                          {tx.details.service && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Service:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80">{tx.details.service}</span>
                            </div>
                          )}
                          {tx.details.accountNumber && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Account:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">{tx.details.accountNumber}</span>
                            </div>
                          )}
                          {tx.fulfillment_data?.token && (
                            <div className="mt-1 rounded-xl bg-blue-500/8 dark:bg-blue-400/8 border border-blue-500/15 dark:border-blue-400/15 px-3 py-2.5 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">⚡ Meter Token</span>
                                <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 tracking-wider">
                                  {tx.fulfillment_data.token}
                                </span>
                              </div>
                              {tx.fulfillment_data.tokenInfo1 && (
                                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/60">{tx.fulfillment_data.tokenInfo1}</p>
                              )}
                              <p className="text-[10px] text-blue-600/60 dark:text-blue-400/50">Enter this on your meter to load credit</p>
                            </div>
                          )}
                          {tx.fulfillment_data?.deliveryAmount && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Units:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">
                                {tx.fulfillment_data.deliveryAmount} {tx.fulfillment_data.deliveryAmountCurrency || ''}
                              </span>
                            </div>
                          )}
                          {tx.fulfillment_data?.reference && (
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Ref:</span>
                              <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">{tx.fulfillment_data.reference}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Amount:</span>
                        <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono">
                          {(tx.amount_luna / 100000).toFixed(5)} NIM
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Status:</span>
                        <span className="text-xs text-success font-semibold capitalize">
                          {tx.status}
                        </span>
                      </div>
                      {tx.cashback && (
                        <div className="mt-1 rounded-xl bg-amber-500/8 dark:bg-gold/8 border border-amber-500/15 dark:border-gold/15 px-3 py-2.5 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-[#E9B213] dark:text-gold">0.1% Cashback</span>
                            <span className="text-xs font-bold text-[#E9B213] dark:text-gold">
                              +{tx.cashback.amount_nim < 0.01
                                ? tx.cashback.amount_nim.toFixed(4)
                                : tx.cashback.amount_nim.toFixed(2)} NIM
                            </span>
                          </div>
                          {tx.cashback.status && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-amber-600/70 dark:text-gold/60">Status</span>
                              <span className={`text-[10px] font-semibold capitalize ${
                                tx.cashback.status === 'paid' ? 'text-success' :
                                tx.cashback.status === 'failed' ? 'text-error' :
                                'text-[#E9B213] dark:text-gold'
                              }`}>
                                {tx.cashback.status === 'paid' ? '✓ Sent to wallet' :
                                 tx.cashback.status === 'failed' ? 'Failed — retrying' :
                                 'Pending payout'}
                              </span>
                            </div>
                          )}
                          {tx.cashback.paid_tx_hash && (
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] text-amber-600/70 dark:text-gold/60 flex-shrink-0">TX</span>
                              <span className="text-[10px] font-mono text-amber-700/80 dark:text-gold/70 text-right break-all">
                                {tx.cashback.paid_tx_hash.slice(0, 8)}…{tx.cashback.paid_tx_hash.slice(-6)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Date & Time:</span>
                        <span className="text-xs text-[#1F2348] dark:text-white/80">
                          {new Date(tx.created_at).toLocaleString()}
                        </span>
                      </div>
                      {tx.tx_hash && (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-[#1F2348]/60 dark:text-white/55">TX Hash:</span>
                            <span className="text-xs text-[#1F2348] dark:text-white/80 font-mono text-right break-all">
                              {tx.tx_hash}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const isPolygon = tx.tx_hash!.startsWith('0x');
                              openExplorer(tx.tx_hash!, isPolygon);
                            }}
                            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-[#E9B213]/20 dark:bg-gold/10 text-[#E9B213] dark:text-gold border border-amber-300 dark:border-gold/20 hover:bg-[#E9B213]/20 dark:hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Icon name="explorer" size={13} strokeWidth={2} /> 
                            {tx.tx_hash!.startsWith('0x') ? 'View on PolygonScan' : 'View on Explorer'}
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
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-[#1F2348]/60 dark:text-white/65">
                <Icon name="history" size={26} />
              </div>
              <p className="text-sm text-[#1F2348]/70 dark:text-white/60">No transactions yet</p>
              <p className="text-xs text-[#1F2348]/60 dark:text-white/65 mt-1">
                Your transaction history will appear here
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="card-premium rounded-2xl p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#E9B213]/20 dark:bg-gold/10 flex items-center justify-center text-[#E9B213] dark:text-gold">
            <Icon name="wallet" size={26} />
          </div>
          <p className="text-sm text-[#1F2348]/70 dark:text-white/60 mb-2">Connect your wallet</p>
          <p className="text-xs text-[#1F2348]/60 dark:text-white/55">
            Connect your wallet to view your transaction history
          </p>
        </div>
      )}

      {/* Stats Summary - Compact (at bottom) */}
      {wallet.connected && filteredTransactions.length > 0 && (
        <div className="card-premium rounded-2xl p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 mb-0.5">Total Sent</p>
              <p className="text-base font-bold text-error tabular-nums">{stats.totalSent.toFixed(2)}</p>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65">NIM</p>
            </div>
            <div>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 mb-0.5">Total Received</p>
              <p className="text-base font-bold text-success tabular-nums">{stats.totalReceived.toFixed(2)}</p>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65">NIM</p>
            </div>
            <div>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65 mb-0.5">Net Change</p>
              <p className={`text-base font-bold tabular-nums ${stats.netChange >= 0 ? 'text-success' : 'text-error'}`}>
                {stats.netChange >= 0 ? '+' : ''}{stats.netChange.toFixed(2)}
              </p>
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/65">NIM</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


