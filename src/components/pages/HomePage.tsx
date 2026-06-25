'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Logo from '@/components/Logo';
import Icon, { type IconName } from '@/components/Icon';
import type { Transaction } from '@/types';
import { getReferralLink, getReferralCount, getReferralStatus, trackReferral, getLeaderboard, getReferrals } from '@/lib/api-client';

interface QuickAction {
  icon: IconName;
  label: string;
  action: () => void;
}

// Maps semantic color names (from transaction data) to hex values.
// Disciplined palette: gold for NIM-native, blue for commerce, green/red for status.
const TX_COLOR_MAP: Record<string, string> = {
  success: '#34D399',
  error: '#F87171',
  warning: '#F5A623',
  info: '#2B6BD6',
  gold: '#F5A623',
  purple: '#8e1caaff',
  blue: '#2B6BD6',
};

// Resolve a transaction row to a line-icon based on its type/direction.
function txIconFor(tx: Transaction): IconName {
  switch (tx.category || tx.type) {
    case 'gift-card':
      return 'gift-card';
    case 'airtime':
      return 'airtime';
    case 'bill':
      return 'bill';
    case 'receive':
      return 'receive';
    case 'send':
      return 'send';
    default:
      // Fall back to direction from the amount sign
      return tx.amount?.startsWith('+') ? 'receive' : 'send';
  }
}

export default function HomePage() {
  const { wallet, connectWallet, disconnectWallet, setActiveTab, sendMessageToAI, fetchBalance, addMessage } = useAppStore();
  const [nimPrice, setNimPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [sentToday, setSentToday] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralCount, setReferralCount] = useState<number>(0);
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [qualifiedReferrals, setQualifiedReferrals] = useState<number>(0);
  const [referralStatus, setReferralStatus] = useState<any>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  useEffect(() => {
    // Fetch NIM price via BFF proxy, then get 24h change directly from CoinGecko
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/nim-price?currency=usd`);
        if (res.ok) {
          const data = await res.json();
          setNimPrice(data.price);

          // If the backend already includes change24h, use it directly
          if (typeof data.change24h === 'number') {
            setPriceChange(data.change24h);
            return;
          }

          // Fallback: fetch 24h change directly from CoinGecko
          try {
            const cgRes = await fetch(
              'https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd&include_24hr_change=true',
              { signal: AbortSignal.timeout(5000) }
            );
            if (cgRes.ok) {
              const cgData = await cgRes.json();
              const change = cgData?.['nimiq-2']?.['usd_24h_change'];
              setPriceChange(typeof change === 'number' ? change : null);
            }
          } catch {
            setPriceChange(null);
          }
        }
      } catch (error) {
        // Silent failure
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch balance on connect (initial load)
    if (wallet.connected && wallet.address) {
      fetchBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, wallet.address]);

  useEffect(() => {
    if (!wallet.connected || !wallet.address) return;

    // Refresh every 60 s while the tab is open
    const interval = setInterval(() => {
      fetchBalance();
    }, 60_000);

    // Refresh immediately whenever the tab becomes visible (covers switching back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBalance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wallet.connected, wallet.address, fetchBalance]);

  useEffect(() => {
    // Handle referral tracking and fetch referral info
    const fetchReferralInfo = async () => {
      if (!wallet.address) return;
      
      // Check URL for referral code and track it
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      
      if (refCode) {
        try {
          await trackReferral(wallet.address, refCode);
        } catch (error) {
          // Silent failure
        }
      }
      
      // Fetch referral link and count, and status
      try {
        const [linkData, statusData] = await Promise.all([
          getReferralLink(wallet.address),
          getReferralStatus(wallet.address)
        ]);
        
        setReferralLink(linkData.referralLink);
        setReferralCount(linkData.referralCount || 0);
        setTotalReferrals(linkData.totalReferrals || 0);
        setQualifiedReferrals(linkData.qualifiedReferrals || 0);
        setReferralStatus(statusData);
      } catch (error) {
        // Silent failure
      }
    };
    
    if (wallet.connected && wallet.address) {
      fetchReferralInfo();
    }
  }, [wallet.connected, wallet.address]);

  useEffect(() => {
    // Fetch recent transactions when wallet connects
    const fetchRecentTransactions = async () => {
      if (!wallet.address) return;

      try {
        // Normalize wallet address - remove spaces for consistent querying
        const normalizedAddress = wallet.address.replace(/\s/g, '');
        
        // Fetch both orders and transactions via BFF proxy
        const [ordersRes, transactionsRes] = await Promise.all([
          fetch(`/api/orders?wallet=${encodeURIComponent(normalizedAddress)}`),
          fetch(`/api/transactions?wallet=${encodeURIComponent(normalizedAddress)}`)
        ]);

        let allOrders: any[] = [];
        let allTransactions: any[] = [];

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          allOrders = ordersData.orders || [];
        }

        if (transactionsRes.ok) {
          const transData = await transactionsRes.json();
          allTransactions = transData.transactions || [];
        }

        // Combine orders and transactions for recent activity
        const combinedData = [
          ...allOrders.map((o: any) => ({ ...o, source: 'order' })),
          ...allTransactions.map((t: any) => ({ ...t, source: 'transaction' }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Convert to transaction format and get last 3
        const transactions: Transaction[] = combinedData.slice(0, 3).map((item, index) => {
          if (item.source === 'order') {
            const typeMap: { [key: string]: { icon: string; color: string; label: string } } = {
              'gift-card': { icon: '🎁', color: 'info', label: 'Gift Card' },
              'airtime': { icon: '📱', color: 'info', label: 'Airtime Top-up' },
              'bill': { icon: '💵', color: 'info', label: item.details?.service || 'Bill Payment' },
            };

            const typeInfo = typeMap[item.type] || { icon: '💰', color: 'info', label: 'Transaction' };
            
            // Calculate time ago
            const createdAt = new Date(item.created_at);
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            let timeAgo = '';
            if (diffDays > 0) {
              timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
              timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
              const diffMins = Math.floor(diffMs / (1000 * 60));
              timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            }

            return {
              id: parseInt(item.id) || index,
              type: item.type as any,
              label: typeInfo.label,
              amount: `-${(item.amount_luna / 100000).toFixed(2)}`, // Convert luna to NIM
              usd: nimPrice ? `$${((item.amount_luna / 100000) * nimPrice).toFixed(2)}` : undefined,
              time: timeAgo,
              icon: typeInfo.icon,
              color: typeInfo.color,
              status: item.status as any,
              category: item.type,
              hash: item.tx_hash,
            };
          } else {
            // Transaction from transactions table
            const isSent = item.from_address?.replace(/\s/g, '') === wallet.address?.replace(/\s/g, '');
            
            // Build label based on transaction type first, then fall back to send/receive
            let typeInfo: { icon: string; color: string; label: string };
            if (item.type === 'gift-card') {
              const product = item.details?.product || 'Gift Card';
              typeInfo = { icon: '🎁', color: 'error', label: `${product} Purchase` };
            } else if (item.type === 'airtime') {
              const phone = item.details?.phone;
              typeInfo = { icon: '📱', color: 'error', label: phone ? `Airtime to ${phone.slice(-4)}` : 'Airtime Top-up' };
            } else if (item.type === 'bill') {
              const service = item.details?.service || 'Bill';
              typeInfo = { icon: '🧾', color: 'error', label: `${service} Payment` };
            } else if (isSent) {
              const shortAddr = item.to_address ? `${item.to_address.replace(/\s/g, '').slice(0, 8)}…` : 'Unknown';
              typeInfo = { icon: '↗', color: 'error', label: `Sent to ${shortAddr}` };
            } else {
              const shortAddr = item.from_address ? `${item.from_address.replace(/\s/g, '').slice(0, 8)}…` : 'Unknown';
              typeInfo = { icon: '↙', color: 'success', label: `Received from ${shortAddr}` };
            }

            // Calculate time ago
            const createdAt = new Date(item.created_at);
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            let timeAgo = '';
            if (diffDays > 0) {
              timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
              timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
              const diffMins = Math.floor(diffMs / (1000 * 60));
              timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            }

            return {
              id: parseInt(item.id) || index,
              type: item.type as any,
              label: typeInfo.label,
              amount: isSent ? `-${(item.amount_luna / 100000).toFixed(2)}` : `+${(item.amount_luna / 100000).toFixed(2)}`,
              usd: nimPrice ? `$${((item.amount_luna / 100000) * nimPrice).toFixed(2)}` : undefined,
              time: timeAgo,
              icon: typeInfo.icon,
              color: typeInfo.color,
              status: item.status as any,
              category: item.type,
              hash: item.tx_hash,
            };
          }
        });

        setRecentTransactions(transactions);

        // Calculate sent today - include both orders and sent transactions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Sum from orders
        const todayOrders = allOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= today;
        });
        const totalFromOrders = todayOrders.reduce((sum, order) => sum + (order.amount_luna / 100000), 0);
        
        // Sum from sent transactions
        const todayTransactions = allTransactions.filter(tx => {
          const txDate = new Date(tx.created_at);
          const isSent = tx.from_address?.replace(/\s/g, '') === wallet.address?.replace(/\s/g, '');
          return txDate >= today && isSent;
        });
        const totalFromTransactions = todayTransactions.reduce((sum, tx) => sum + (tx.amount_luna / 100000), 0);
        
        const totalSent = totalFromOrders + totalFromTransactions;
        setSentToday(totalSent);
      } catch (error) {
        // Silent failure
      }
    };

    if (wallet.connected && wallet.address) {
      fetchRecentTransactions();
    }
  }, [wallet.connected, wallet.address, nimPrice]);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      // Silent failure
    }
  };

  const handleQuickAction = async (actionType: string) => {
    if (actionType === 'Referral Link') {
      // Open referral modal and fetch referrals
      setShowReferralModal(true);
      setLoadingReferral(true);
      try {
        if (wallet.address) {
          const data = await getReferrals(wallet.address);
          setReferrals(data.referrals || []);
        }
      } catch (error) {
        // Silent failure
      } finally {
        setLoadingReferral(false);
      }
      return;
    }
    
    if (actionType === 'Leaderboard') {
      // Open leaderboard modal and fetch data
      setLoadingLeaderboard(true);
      try {
        const data = await getLeaderboard();
        setLeaderboard(data.leaderboard || []);
      } catch (error) {
        // Silent failure
      } finally {
        setLoadingLeaderboard(false);
      }
      setShowLeaderboardModal(true);
      return;
    }
    
    setActiveTab('chat');
    
    // Handle Scan QR directly without going through AI
    if (actionType === 'Scan QR') {
      addMessage({
        role: 'ai',
        content: 'Ready to scan! Point your camera at a QR code containing a Nimiq address or payment request. 📷',
        action: {
          type: 'qr-scan',
        }
      });
      return;
    }

    // Send message to AI and get response for other actions
    setTimeout(async () => {
      let message = '';
      if (actionType === 'Send NIM') {
        message = 'I want to send NIM';
      } else if (actionType === 'Generate QR') {
        message = 'Show my address';
      } else if (actionType === 'Gift Cards') {
        message = 'I want to buy a gift card';
      } else if (actionType === 'Airtime') {
        message = 'I want to top up airtime';
      } else if (actionType === 'Pay Bills') {
        message = 'I want to pay a bill';
      }
      
      if (message) {
        await sendMessageToAI(message, wallet.address || undefined);
      }
    }, 100);
  };

  const quickActions: QuickAction[] = [
    { icon: 'send', label: 'Send NIM', action: () => handleQuickAction('Send NIM') },
    { icon: 'qr-code', label: 'Generate QR', action: () => handleQuickAction('Generate QR') },
    { icon: 'qr-scan', label: 'Scan QR', action: () => handleQuickAction('Scan QR') },
    { icon: 'gift-card', label: 'Gift Cards', action: () => handleQuickAction('Gift Cards') },
    { icon: 'airtime', label: 'Airtime', action: () => handleQuickAction('Airtime') },
    { icon: 'bill', label: 'Pay Bills', action: () => handleQuickAction('Pay Bills') },
    { icon: 'gift', label: 'Referral Link', action: () => handleQuickAction('Referral Link') },
    { icon: 'trophy', label: 'Leaderboard', action: () => handleQuickAction('Leaderboard') },
  ];

  // Per-action accent colors for the quick-action tiles
  // Two-accent system: GOLD = NIM-native actions, BLUE = commerce/services.
  const actionAccents: Record<string, string> = {
    'Send NIM': '#F5A623',
    'Generate QR': '#F5A623',
    'Scan QR': '#F5A623',
    'Gift Cards': '#F5A623',
    'Airtime': '#2B6BD6',
    'Pay Bills': '#2B6BD6',
    'Referral Link': '#2B6BD6',
    'Leaderboard': '#2B6BD6',
  };

  const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-6">
      {/* Hero Balance Card - only shown when connected (Welcome card covers the disconnected state) */}
      {wallet.connected && (
      <div className="animate-fade-up glass dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-3xl p-7 relative overflow-hidden shadow-sm">
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-gold/15 border border-amber-300 dark:border-gold/25 flex items-center justify-center text-amber-600 dark:text-gold">
                <Icon name="wallet" size={15} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-white/55">
                Total Balance
              </span>
            </div>
            {wallet.connected && (
              <button
                onClick={disconnectWallet}
                className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-semibold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/65 border border-gray-200 dark:border-white/10 hover:bg-red-100 dark:hover:bg-error/15 hover:text-red-600 dark:hover:text-error hover:border-red-300 dark:hover:border-error/25 transition-colors"
                title="Disconnect Wallet"
              >
                <Icon name="disconnect" size={12} strokeWidth={2.2} />
                Disconnect
              </button>
            )}
          </div>

          {wallet.balance ? (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">
                  {wallet.balance.nim.balanceFormatted}
                </span>
                <span className="text-lg font-bold text-amber-600 dark:text-gold">NIM</span>
              </div>
              <div className="flex items-center gap-2 mb-8">
                <span className="text-sm text-gray-500 dark:text-white/55 font-mono">
                  ≈ ${wallet.balance.nim.balanceUSD} USD
                </span>
                {priceChange != null && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${priceChange >= 0 ? 'text-green-600 dark:text-success bg-green-100 dark:bg-success/10' : 'text-red-600 dark:text-error bg-red-100 dark:bg-error/10'}`}>
                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 space-y-2">
                <div className="skeleton h-12 w-48 rounded-xl" />
                <div className="skeleton h-4 w-32 rounded-lg" />
              </div>
              <div className="mb-4" />
            </>
          )}

          <div className="flex gap-3">
            <button
              className="btn-gold flex-1 rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 bg-amber-600 dark:bg-gold text-white hover:bg-amber-700 dark:hover:bg-gold/90"
              onClick={() => setActiveTab('chat')}
            >
              <Icon name="chat" size={16} strokeWidth={2.2} />
              Start AI Chat
            </button>
            <button
              className="flex-1 rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 text-amber-600 dark:text-gold border border-amber-300 dark:border-gold/30 hover:bg-amber-100 dark:hover:bg-gold/10 transition-all"
              onClick={() => setActiveTab('history')}
            >
              <Icon name="history" size={16} strokeWidth={2.2} />
              History
            </button>
          </div>

          {wallet.error && (
            <p className="text-xs text-red-600 dark:text-error mt-3 text-center">{wallet.error}</p>
          )}
        </div>
      </div>
      )}

      {/* Stats Cards */}
      {wallet.connected && (
        <>
          <div className="grid grid-cols-3 gap-3 animate-fade-up-delay-1 -mt-2">
            <div className="card-premium rounded-2xl p-5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-white/55 mb-2 uppercase tracking-wider">NIM Price</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">${nimPrice?.toFixed(4) || '—'}</p>
              {priceChange != null ? (
                <p className={`text-xs mt-1 font-semibold ${priceChange >= 0 ? 'text-success' : 'text-error'}`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                </p>
              ) : (
                <p className="text-xs mt-1 text-gray-400 dark:text-white/30">—</p>
              )}
            </div>
            <div className="card-premium rounded-2xl p-5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-white/55 mb-2 uppercase tracking-wider">Sent Today</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{sentToday.toFixed(0)}</p>
              <p className="text-xs text-gray-500 dark:text-white/65 mt-1">
                ${nimPrice ? (sentToday * nimPrice).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="card-premium rounded-2xl p-5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-white/55 mb-2 uppercase tracking-wider">Network</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{network}</p>
              <p className="text-xs text-success mt-1 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-live" /> Live
              </p>
            </div>
          </div>
          
          {/* Markup Notice */}
          <div className="mt-4 card-premium rounded-2xl p-4 text-center animate-fade-up-delay-2">
            <p className="text-[11px] text-gray-600 dark:text-white/70 flex items-center justify-center gap-1">
              <Icon name="info" size={12} className="text-amber-600 dark:text-gold" />
              Gift cards, Airtime and bills services include a small 0.5% markup to cover operational costs
            </p>
          </div>
        </>
      )}

      {/* Quick Actions */}
      {wallet.connected && (
        <div className="animate-fade-up-delay-2 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 dark:text-white/80 uppercase tracking-widest">
              Quick Actions
            </h2>
            <button
              className="text-xs text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright transition-colors font-semibold"
              onClick={() => setActiveTab('chat')}
            >
              See all
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const accent = actionAccents[action.label] || '#F5A623';
              const isReferral = action.label === 'Referral Link';
              return (
                <button
                  key={action.label}
                  className="group card-premium rounded-2xl flex flex-col items-center justify-center py-4 gap-2 hover:-translate-y-1 transition-all duration-300 relative"
                  onClick={action.action}
                >
                  {isReferral && qualifiedReferrals > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md">
                      {qualifiedReferrals}
                    </span>
                  )}
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `${accent}1f`,
                      border: `1px solid ${accent}33`,
                      boxShadow: `0 4px 16px ${accent}14`,
                      color: accent,
                    }}
                  >
                    <Icon name={action.icon} size={20} />
                  </span>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-white/72 text-center leading-tight px-1">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {wallet.connected && (
        <div className="animate-fade-up-delay-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 dark:text-white/80 uppercase tracking-widest">
              Recent Activity
            </h2>
            <button 
              className="text-xs text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright transition-colors"
              onClick={() => setActiveTab('history')}
            >
              View all
            </button>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const txColor = TX_COLOR_MAP[tx.color] || '#F5A623';
                return (
                <div key={tx.id} className="card-premium rounded-2xl overflow-hidden">
                  <div
                    onClick={() => setExpandedTx(expandedTx === tx.id.toString() ? null : tx.id.toString())}
                    className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] transition-all"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${txColor}1f`,
                        color: txColor,
                        border: `1px solid ${txColor}33`,
                      }}
                    >
                      <Icon name={txIconFor(tx)} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{tx.label}</p>
                      <p className="text-xs text-gray-500 dark:text-white/55">{tx.time}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: txColor }}>{tx.amount} NIM</p>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-gray-500 dark:text-white/65 transition-transform flex-shrink-0 ${expandedTx === tx.id.toString() ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedTx === tx.id.toString() && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-white/5 space-y-2 animate-fade-up">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/55">Type:</span>
                        <span className="text-xs text-gray-700 dark:text-white/70 capitalize">{tx.category}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/55">Amount:</span>
                        <span className="text-xs text-gray-700 dark:text-white/70 font-mono">{tx.amount} NIM</span>
                      </div>
                      {tx.usd && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-white/55">USD Value:</span>
                          <span className="text-xs text-gray-700 dark:text-white/70 font-mono">{tx.usd}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-white/55">Status:</span>
                        <span className="text-xs text-success font-semibold capitalize">{tx.status}</span>
                      </div>
                      {tx.hash && (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-gray-500 dark:text-white/55">TX Hash:</span>
                            <span className="text-xs text-gray-700 dark:text-white/70 font-mono text-right break-all">
                              {tx.hash}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK;
                              const baseUrl = network === 'mainnet' 
                                ? 'https://nimiq.watch/#' 
                                : 'https://test.nimiq.watch/#';
                              window.open(`${baseUrl}${tx.hash}`, '_blank');
                            }}
                            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-amber-100 dark:bg-gold/10 text-amber-600 dark:text-gold border border-amber-300 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Icon name="explorer" size={13} strokeWidth={2} /> View on Explorer
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="card-premium rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2 opacity-50">📊</div>
              <p className="text-sm text-gray-600 dark:text-white/55">No recent transactions</p>
              <p className="text-xs text-gray-500 dark:text-white/65 mt-1">Start by sending NIM or making a payment</p>
            </div>
          )}
        </div>
      )}

      {/* Welcome Message for Non-Connected Users */}
      {!wallet.connected && (
        <div className="animate-fade-up-delay-1 rounded-3xl p-7 card-premium text-center relative overflow-hidden">
          <div className="relative">
            <div className="flex justify-center mb-4">
              <Logo size={64} glow />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
              Welcome to Nim<span className="text-gradient-gold">Agent</span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-white/55 mb-6 max-w-xs mx-auto leading-relaxed">
              Your AI-powered Nimiq payment agent. Send NIM, buy gift cards, top up airtime, pay bills, and swap crypto, all in one chat.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-6 text-left">
              {[
                { icon: 'send' as IconName, label: 'Feeless Transfers', color: '#F5A623', action: () => handleConnect() },
                { icon: 'robot' as IconName, label: 'AI Assistant', color: '#2B6BD6', action: () => handleConnect() },
                { icon: 'wallet' as IconName, label: 'Cash Out', color: '#2B6BD6', action: () => handleConnect() },
                { icon: 'swap' as IconName, label: 'Crypto Swap', color: '#F5A623', action: () => handleConnect() },
              ].map((feature) => (
                <button
                  key={feature.label}
                  onClick={feature.action}
                  className="flex items-center gap-2.5 rounded-xl p-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all active:scale-95"
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${feature.color}1f`, border: `1px solid ${feature.color}33`, color: feature.color }}
                  >
                    <Icon name={feature.icon} size={16} />
                  </span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-white/70">{feature.label}</span>
                </button>
              ))}
            </div>

            <button
              className="btn-gold w-full rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              onClick={handleConnect}
              disabled={wallet.loading}
            >
              {wallet.loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-background-primary/40 border-t-background-primary rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Icon name="wallet" size={16} strokeWidth={2.2} />
                  Connect Wallet to Start
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowReferralModal(false)}>
          <div className="max-w-md w-full card-premium rounded-3xl p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-gold/15 border border-amber-300 dark:border-gold/25 flex items-center justify-center">
                  <Icon name="gift" size={18} className="text-amber-600 dark:text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Referral Link</h2>
                  <p className="text-xs text-gray-500 dark:text-white/55">Share to earn rewards!</p>
                </div>
              </div>
              <button
                onClick={() => setShowReferralModal(false)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                <Icon name="chevron-right" size={14} className="rotate-90 text-gray-500" />
              </button>
            </div>

            {/* Referral Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="card-premium rounded-2xl p-4 text-center">
                <p className="text-[11px] text-gray-500 dark:text-white/55 mb-1">Total Referrals</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{totalReferrals}</p>
              </div>
              <div className="card-premium rounded-2xl p-4 text-center">
                <p className="text-[11px] text-gray-500 dark:text-white/55 mb-1">Qualified</p>
                <p className="text-xl font-bold text-success">{qualifiedReferrals}</p>
              </div>
            </div>

            {/* Referral Link Copy */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-700 dark:text-white/70 mb-2">Your Link</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-xl px-3 py-2 text-xs text-gray-700 dark:text-white/70 font-mono overflow-x-auto border border-gray-200 dark:border-white/10">
                  {referralLink}
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(referralLink);
                    setCopyToastVisible(true);
                    setTimeout(() => setCopyToastVisible(false), 2000);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                    copyToastVisible 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'btn-gold'
                  }`}
                >
                  {copyToastVisible ? (
                    <>
                      <Icon name="check" size={12} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Icon name="copy" size={12} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Referral Status */}
            {referralStatus?.isReferred && (
              <div className="card-premium rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="info" size={14} className="text-amber-600 dark:text-gold" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-white/70">Your Referral Progress</p>
                </div>
                {referralStatus.qualified ? (
                  <p className="text-sm text-green-600 dark:text-success font-semibold">
                    🎉 You've qualified your referral by spending over $1000!
                  </p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-700 dark:text-white/70 mb-2">
                      You've spent ${referralStatus.totalSpent?.toFixed(2) || '0.00'} so far.
                    </p>
                    <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 dark:bg-gold transition-all"
                        style={{ width: `${Math.min(((referralStatus.totalSpent || 0) / 100) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white/55 mt-1">
                      Only ${referralStatus.remaining?.toFixed(2)} more to qualify!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Referral List */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-700 dark:text-white/70 mb-3">Your Referrals</p>
              {loadingReferral ? (
                <div className="text-center py-4">
                  <div className="w-8 h-8 mx-auto border-2 border-amber-300 dark:border-gold/30 border-t-amber-600 dark:border-t-gold rounded-full animate-spin" />
                  <p className="text-sm text-gray-600 dark:text-white/60 mt-2">Loading referrals...</p>
                </div>
              ) : referrals.length === 0 ? (
                <div className="card-premium rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-3 text-gray-400">
                    <Icon name="gift" size={24} />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-white/60 mb-1">No referrals yet</p>
                  <p className="text-xs text-gray-500 dark:text-white/55">Share your link to start earning!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {referrals.map((referral: any) => (
                    <div
                      key={referral.id}
                      className="card-premium rounded-2xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400">
                          <Icon name="wallet" size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate font-mono">
                            {referral.referred_wallet.slice(0, 10)}...{referral.referred_wallet.slice(-4)}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-white/55">
                            Spent: ${(referral.total_spent_usd || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {referral.is_qualified ? (
                          <div className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2 py-1 rounded-full">
                            <Icon name="check" size={10} />
                            Qualified
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 dark:text-white/55">Pending</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowReferralModal(false)}
              className="w-full btn-gold rounded-2xl py-3 text-sm font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLeaderboardModal(false)}>
          <div className="max-w-md w-full card-premium rounded-3xl p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Icon name="trophy" size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Referral Leaderboard</h2>
                  <p className="text-xs text-gray-500 dark:text-white/55">Top 20 referrers</p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              >
                <Icon name="chevron-right" size={14} className="rotate-90 text-gray-500" />
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 mx-auto mb-3 border-2 border-amber-300 dark:border-gold/30 border-t-amber-600 dark:border-t-gold rounded-full animate-spin" />
                <p className="text-sm text-gray-600 dark:text-white/60">Loading leaderboard...</p>
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="space-y-3 mb-6">
                {/* Top 3 Special Display */}
                {leaderboard.length > 0 && (
                  <div className="flex justify-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-white/10">
                    {[1, 0, 2].map((pos) => {
                      const entry = leaderboard[pos];
                      if (!entry) return null;
                      return (
                        <div key={pos} className="flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-1 ${
                            pos === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg' :
                            pos === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                            'bg-gradient-to-br from-orange-400 to-orange-600'
                          }`}>
                            {pos === 0 ? '🥇' : pos === 1 ? '🥈' : '🥉'}
                          </div>
                          <p className="text-xs font-bold text-gray-700 dark:text-white/80">{pos + 1}</p>
                          <p className="text-[10px] font-mono text-gray-500 dark:text-white/60 truncate max-w-[60px]">
                            {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-2)}
                          </p>
                          <p className="text-[10px] font-bold text-green-600 dark:text-success">
                            ${entry.totalEarned.toFixed(2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Rest of the Leaderboard */}
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-500/10 dark:to-yellow-600/5 border-2 border-yellow-200 dark:border-yellow-500/20' :
                        index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-500/10 dark:to-gray-600/5 border-2 border-gray-200 dark:border-gray-500/20' :
                        index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-500/10 dark:to-orange-600/5 border-2 border-orange-200 dark:border-orange-500/20' :
                        'bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0 ? 'bg-yellow-200 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                        index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300' :
                        index === 2 ? 'bg-orange-200 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                        'bg-gray-200 text-gray-500 dark:bg-white/15 dark:text-white/55'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate font-mono">
                          {entry.wallet.slice(0, 8)}...{entry.wallet.slice(-4)}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-white/55">
                          {entry.totalInvited} invited • {entry.referrals} qualified
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600 dark:text-success">
                          ${entry.totalEarned.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-gray-500 dark:text-white/65 shadow-inner">
                  <Icon name="trophy" size={24} />
                </div>
                <p className="text-sm text-gray-600 dark:text-white/60">No referrals yet!</p>
                <p className="text-xs text-gray-500 dark:text-white/55 mt-1">Be the first to refer someone!</p>
              </div>
            )}

            <button
              onClick={() => setShowLeaderboardModal(false)}
              className="w-full btn-gold rounded-2xl py-3 text-sm font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Copy Toast */}
      {copyToastVisible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-2xl border border-gray-700 dark:border-white/10 animate-fade-up">
          <div className="w-8 h-8 rounded-full bg-green-500/20 dark:bg-green-500/15 flex items-center justify-center">
            <Icon name="check" size={16} className="text-green-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Referral Link Copied!</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">Share it with friends to earn rewards</p>
          </div>
        </div>
      )}
    </div>
  );
}
