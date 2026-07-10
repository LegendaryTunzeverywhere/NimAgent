'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Logo from '@/components/Logo';
import Icon, { type IconName } from '@/components/Icon';
import type { Transaction } from '@/types';
import { claimReferralRewards, getReferralLink, getReferralStatus, trackReferral, getLeaderboard, getReferrals, getWalletRequestHeaders } from '@/lib/api-client';
import { openExternalUrl } from '@/lib/external-links';
import { SOCIAL_LINKS } from '@/lib/social-links';

import Button from '@/components/Button';
import LoadingSpinner, { PageLoading } from '@/components/LoadingSpinner';

interface QuickAction {
  icon: IconName;
  label: string;
  action: () => void;
}

// Maps semantic color names (from transaction data) to Nimiq brand colors.
// Functional palette: gold for NIM-native, light blue for commerce, green/red for status.
const TX_COLOR_MAP: Record<string, string> = {
  success: '#21BCA5', // Nimiq Green
  error: '#D94432',   // Nimiq Red
  warning: '#E9B213', // Nimiq Gold
  info: '#0582CA',    // Nimiq Light Blue
  gold: '#E9B213',    // Nimiq Gold
  purple: '#5F4B8B',  // Nimiq Purple
  blue: '#0582CA',    // Nimiq Light Blue
};

const WELCOME_HIGHLIGHTS: Array<{
  icon: IconName;
  title: string;
  description: string;
  color: string;
}> = [
  {
    icon: 'send',
    title: 'Send NIM fast',
    description: 'Feeless transfers with QR, saved contacts, and plain-language prompts.',
    color: '#E9B213', // Nimiq Gold - crypto
  },
  {
    icon: 'robot',
    title: 'Ask the agent',
    description: 'Get guided help for payments, balances, and wallet actions in one place.',
    color: '#0582CA', // Nimiq Light Blue - AI
  },
  {
    icon: 'gift-card',
    title: 'Pay for services',
    description: 'Buy gift cards, top up airtime, and pay bills from the same wallet.',
    color: '#0582CA', // Nimiq Light Blue - commerce
  },
];

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

export default function HomePage({ connecting = false }: { connecting?: boolean }) {
  const {
    wallet,
    connectWallet,
    disconnectWallet,
    setActiveTab,
    sendMessageToAI,
    fetchBalance,
    addMessage,
  } = useAppStore();
  const [nimPrice, setNimPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [sentToday, setSentToday] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralCount, setReferralCount] = useState<number>(0);
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [qualifiedReferrals, setQualifiedReferrals] = useState<number>(0);
  const [totalEarnedNim, setTotalEarnedNim] = useState<number>(0);
  const [totalClaimableNim, setTotalClaimableNim] = useState<number>(0);
  const [totalClaimedNim, setTotalClaimedNim] = useState<number>(0);
  const [referralStatus, setReferralStatus] = useState<any>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [claimingReferralRewards, setClaimingReferralRewards] = useState(false);
  const [referralClaimNotice, setReferralClaimNotice] = useState<string | null>(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);

  const refreshReferralData = useCallback(async (options?: { requireWalletSession?: boolean }) => {
    if (!wallet.address) return;

    const [linkData, statusData] = await Promise.all([
      getReferralLink(wallet.address, options),
      getReferralStatus(wallet.address, options),
    ]);

    setReferralLink(linkData.referralLink);
    setReferralCount(linkData.referralCount || 0);
    setTotalReferrals(linkData.totalReferrals || 0);
    setQualifiedReferrals(linkData.qualifiedReferrals || 0);
    setTotalEarnedNim(linkData.totalEarnedNim || 0);
    setTotalClaimableNim(linkData.totalClaimableNim || 0);
    setTotalClaimedNim(linkData.totalClaimedNim || 0);
    setReferralStatus(statusData);
  }, [wallet.address]);

  const refreshReferralList = useCallback(async (options?: { requireWalletSession?: boolean }) => {
    if (!wallet.address) return;
    const data = await getReferrals(wallet.address, options);
    setReferrals(data.referrals || []);
  }, [wallet.address]);

  const fetchRecentTransactions = useCallback(async () => {
    if (!wallet.address) return;

    try {
      const normalizedAddress = wallet.address.replace(/\s/g, '');
      const walletHeaders = await getWalletRequestHeaders('GET', normalizedAddress, {
        requireWalletSession: false,
      });

      const [ordersRes, transactionsRes] = await Promise.all([
        fetch(`/api/orders?wallet=${encodeURIComponent(normalizedAddress)}`, { headers: walletHeaders }),
        fetch(`/api/transactions?wallet=${encodeURIComponent(normalizedAddress)}`, { headers: walletHeaders }),
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

      const combinedData = [
        ...allOrders.map((o: any) => ({ ...o, source: 'order' })),
        ...allTransactions.map((t: any) => ({ ...t, source: 'transaction' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const transactions: Transaction[] = combinedData.slice(0, 3).map((item, index) => {
        if (item.source === 'order') {
          const typeMap: { [key: string]: { icon: string; color: string; label: string } } = {
            'gift-card': { icon: '🎁', color: 'info', label: 'Gift Card' },
            'airtime': { icon: '📱', color: 'info', label: 'Airtime Top-up' },
            'bill': { icon: '💵', color: 'info', label: item.details?.service || 'Bill Payment' },
          };

          const typeInfo = typeMap[item.type] || { icon: '💰', color: 'info', label: 'Transaction' };
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
            amount: `-${(item.amount_luna / 100000).toFixed(2)}`,
            usd: nimPrice ? `$${((item.amount_luna / 100000) * nimPrice).toFixed(2)}` : undefined,
            time: timeAgo,
            icon: typeInfo.icon,
            color: typeInfo.color,
            status: item.status as any,
            category: item.type,
            hash: item.tx_hash,
          };
        }

        const isSent = item.from_address?.replace(/\s/g, '') === wallet.address?.replace(/\s/g, '');
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
      });

      setRecentTransactions(transactions);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = allOrders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= today;
      });
      const totalFromOrders = todayOrders.reduce((sum, order) => sum + (order.amount_luna / 100000), 0);

      const todayTransactions = allTransactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        const isSent = tx.from_address?.replace(/\s/g, '') === wallet.address?.replace(/\s/g, '');
        return txDate >= today && isSent;
      });
      const totalFromTransactions = todayTransactions.reduce((sum, tx) => sum + (tx.amount_luna / 100000), 0);

      setSentToday(totalFromOrders + totalFromTransactions);
    } catch (error) {
      // Silent failure
    }
  }, [wallet.address, nimPrice]);

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
  }, [wallet.connected, wallet.address, fetchBalance]);

  useEffect(() => {
    // Fetch referral info and transactions after wallet connects and auth completes
    const fetchInitialData = async () => {
      if (!wallet.connected || !wallet.address) return;
      
      // Wait a bit for authentication to complete if this is the first connection
      if (wallet.authCompleted === 0) {
        setIsLoadingInitialData(true);
      }
      
      // Delay slightly if auth just completed to avoid race conditions
      if (wallet.authCompleted > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Fetch all data in parallel
      try {
        await Promise.all([
          fetchRecentTransactions(),
          (async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            
            if (refCode) {
              try {
                await trackReferral(wallet.address!, refCode);
              } catch (error) {
                // Silent failure
              }
            }
            
            // Fetch referral link, live reward totals, and status
            try {
              await refreshReferralData({ requireWalletSession: false });
            } catch (error) {
              // Silent failure
            }
          })(),
        ]);
      } finally {
        setIsLoadingInitialData(false);
      }
    };
    
    fetchInitialData();
  }, [
    wallet.connected,
    wallet.address,
    wallet.authCompleted,
    fetchRecentTransactions,
    refreshReferralData,
  ]);

  const handleConnect = async () => {
    if (wallet.loading) return;
    try {
      await connectWallet();
    } catch (error) {
      // Silent failure — store already sets wallet.error
    }
  };

  const handleQuickAction = async (actionType: string) => {
    if (actionType === 'Referral Link') {
      // Open referral modal and fetch referrals
      setShowReferralModal(true);
      setLoadingReferral(true);
      setReferralClaimNotice(null);
      try {
        await Promise.all([refreshReferralData(), refreshReferralList()]);
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

  const handleClaimReferralRewards = async () => {
    if (!wallet.address || totalClaimableNim <= 0 || claimingReferralRewards) return;

    setClaimingReferralRewards(true);
    setReferralClaimNotice(null);
    try {
      const result = await claimReferralRewards(wallet.address);
      if (!result.success) {
        setReferralClaimNotice(result.error || 'Unable to claim referral rewards right now.');
        return;
      }

      await Promise.all([refreshReferralData(), refreshReferralList()]);
      const claimedAmount = result.amountNim || totalClaimableNim;
      setReferralClaimNotice(`Claimed ${claimedAmount.toFixed(5)} NIM successfully.`);
      addMessage({
        role: 'ai',
        content: `Referral rewards claimed successfully. ${claimedAmount.toFixed(5)} NIM has been sent to your wallet.`,
      });
    } catch (error) {
      setReferralClaimNotice('Unable to claim referral rewards right now.');
    } finally {
      setClaimingReferralRewards(false);
    }
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
  // Functional color split: GOLD (#E9B213) = crypto actions, LIGHT BLUE (#0582CA) = commerce/AI
  const actionAccents: Record<string, string> = {
    'Send NIM': '#E9B213',      // Gold - crypto
    'Generate QR': '#E9B213',   // Gold - crypto
    'Scan QR': '#E9B213',       // Gold - crypto
    'Gift Cards': '#0582CA',    // Light Blue - commerce
    'Airtime': '#0582CA',       // Light Blue - commerce
    'Pay Bills': '#0582CA',     // Light Blue - commerce
    'Referral Link': '#E9B213', // Gold - crypto rewards
    'Leaderboard': '#E9B213',   // Gold - crypto competition
  };



  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-6">

      {/* Syncing toast — removed from HomePage, now lives in page.tsx for all-tab coverage */}

      {/* Hero Balance Card - only shown when connected (Welcome card covers the disconnected state) */}
      {wallet.connected && (
      <div className="animate-fade-up glass dark:bg-white/[0.03] border border-[#1F2348]/10 dark:border-white/[0.08] rounded-[10px] p-7 relative overflow-hidden shadow-sm">
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#E9B213]/15 border border-[#E9B213]/25 flex items-center justify-center text-[#E9B213]">
                <Icon name="wallet" size={15} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#1F2348]/60 dark:text-white/70">
                Total Balance
              </span>
            </div>
            {wallet.connected && (
              <button
                onClick={disconnectWallet}
                className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-semibold bg-white/80 dark:bg-white/5 text-[#1F2348]/80 dark:text-white/75 border border-[#1F2348]/10 dark:border-white/10 hover:bg-[#D94432]/10 hover:text-[#D94432] hover:border-[#D94432]/25 transition-all"
                style={{ transition: 'all 200ms cubic-bezier(0.25, 0, 0, 1)' }}
                title="Disconnect Wallet"
              >
                <Icon name="disconnect" size={12} strokeWidth={2} />
                Disconnect
              </button>
            )}
          </div>

          {wallet.balance ? (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-5xl font-black text-[#1F2348] dark:text-white tracking-tighter tabular-nums">
                  {wallet.balance.nim.balanceFormatted}
                </span>
                <span className="text-lg font-bold text-[#E9B213]">NIM</span>
              </div>
              <div className="flex items-center gap-2 mb-8">
                <span className="text-sm text-[#1F2348]/60 dark:text-white/70 font-mono">
                  ≈ ${wallet.balance.nim.balanceUSD} USD
                </span>
                {priceChange != null && (
                  <span 
                    className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: priceChange >= 0 ? 'rgba(33, 188, 165, 0.1)' : 'rgba(217, 68, 50, 0.1)',
                      color: priceChange >= 0 ? '#21BCA5' : '#D94432',
                    }}
                  >
                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                  </span>
                )}
              </div>
            </>
          ) : wallet.loading ? (
            <>
              <div className="mb-2 space-y-2">
                <div className="skeleton h-12 w-48 rounded-xl" />
                <div className="skeleton h-4 w-32 rounded-lg" />
              </div>
              <div className="mb-4" />
            </>
          ) : (
            <div className="mb-6 rounded-2xl border border-[#D94432]/20 bg-[#D94432]/10 p-4 text-center">
              <p className="text-sm font-semibold text-[#D94432]">
                {wallet.error?.includes('syncing') ? 'Nimiq Pay is syncing' : 'Couldn&apos;t load your balance'}
              </p>
              <p className="mt-1 text-xs text-[#D94432]/80">
                {wallet.error?.includes('syncing')
                  ? 'Wait a moment for the wallet to establish Nimiq consensus, then refresh the balance.'
                  : 'Try again. NimAgent will fall back to direct network balance lookup inside Nimiq Pay.'}
              </p>
              <Button
                onClick={() => fetchBalance()}
                variant="ghost"
                size="sm"
                icon="refresh"
                className="mt-3 border border-[#D94432]/30 text-[#D94432] hover:bg-[#D94432]/15"
              >
                {wallet.error?.includes('syncing') ? 'Check again' : 'Retry balance'}
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="blue"
              size="sm"
              icon="chat"
              className="flex-1"
              onClick={() => setActiveTab('chat')}
            >
              Start AI Chat
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="history"
              className="flex-1"
              onClick={() => setActiveTab('history')}
            >
              History
            </Button>
          </div>

          {wallet.error && (
            <p className="text-xs mt-3 text-center" style={{ color: '#D94432' }}>{wallet.error}</p>
          )}
        </div>
      </div>
      )}

      {/* Stats Cards */}
      {wallet.connected && (
        <>
          <div className="grid grid-cols-2 gap-3 animate-fade-up-delay-1 -mt-2">
            <div className="card-premium rounded-[10px] p-5 text-center">
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/70 mb-2 uppercase tracking-wider">NIM Price</p>
              <p className="text-lg font-bold text-[#1F2348] dark:text-white tabular-nums">${nimPrice?.toFixed(4) || '—'}</p>
              {priceChange != null ? (
                <p className={`text-xs mt-1 font-semibold ${priceChange >= 0 ? 'text-success' : 'text-error'}`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                </p>
              ) : (
                <p className="text-xs mt-1 text-[#1F2348]/50 dark:text-white/60">—</p>
              )}
            </div>
            <div className="card-premium rounded-[10px] p-5 text-center">
              <p className="text-[10px] text-[#1F2348]/60 dark:text-white/70 mb-2 uppercase tracking-wider">Sent Today</p>
              <p className="text-lg font-bold text-[#1F2348] dark:text-white tabular-nums">{sentToday.toFixed(0)}</p>
              <p className="text-xs text-[#1F2348]/60 dark:text-white/70 mt-1">
                ${nimPrice ? (sentToday * nimPrice).toFixed(2) : '0.00'}
              </p>
            </div>

          </div>
          
          {/* Markup Notice */}
          <div className="mt-4 card-premium rounded-[10px] p-4 text-center animate-fade-up-delay-2">
            <p className="text-[11px] text-[#1F2348]/80 dark:text-white/70 flex items-center justify-center gap-1">
              <Icon name="info" size={12} className="text-[#E9B213]" />
              Gift cards, Airtime and bills services include a small 0.5% markup to cover operational costs
            </p>
          </div>
        </>
      )}

      {/* Quick Actions */}
      {wallet.connected && (
        <div className="animate-fade-up-delay-2 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#1F2348] dark:text-white uppercase tracking-widest">
              Quick Actions
            </h2>
            <button
              className="text-xs font-semibold transition-colors"
              style={{ 
                color: '#E9B213',
                transition: 'color 200ms cubic-bezier(0.25, 0, 0, 1)',
              }}
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
                  <span className="text-[10px] font-semibold text-[#1F2348]/80 dark:text-white/80 text-center leading-tight px-1">
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
            <h2 className="text-sm font-bold text-[#1F2348] dark:text-white uppercase tracking-widest">
              Recent Activity
            </h2>
            <button 
              className="text-xs font-semibold transition-colors"
              style={{ 
                color: '#E9B213',
                transition: 'color 200ms cubic-bezier(0.25, 0, 0, 1)',
              }}
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
                <div key={tx.id} className="card-premium rounded-[10px] overflow-hidden">
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
                      <p className="text-sm font-semibold text-[#1F2348] dark:text-white truncate">{tx.label}</p>
                      <p className="text-xs text-[#1F2348]/60 dark:text-white/70">{tx.time}</p>
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
                      className={`text-[#1F2348]/60 dark:text-white/65 transition-transform flex-shrink-0 ${expandedTx === tx.id.toString() ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedTx === tx.id.toString() && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#1F2348]/10 dark:border-white/5 space-y-2 animate-fade-up">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/70">Type:</span>
                        <span className="text-xs text-[#1F2348] dark:text-white/85 capitalize">{tx.category}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/70">Amount:</span>
                        <span className="text-xs text-[#1F2348] dark:text-white/85 font-mono">{tx.amount} NIM</span>
                      </div>
                      {tx.usd && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-[#1F2348]/60 dark:text-white/70">USD Value:</span>
                          <span className="text-xs text-[#1F2348] dark:text-white/85 font-mono">{tx.usd}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-[#1F2348]/60 dark:text-white/70">Status:</span>
                        <span className="text-xs text-success font-semibold capitalize">{tx.status}</span>
                      </div>
                      {tx.hash && (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-[#1F2348]/60 dark:text-white/70">TX Hash:</span>
                            <span className="text-xs text-[#1F2348] dark:text-white/85 font-mono text-right break-all">
                              {tx.hash}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openExternalUrl(`https://nimiq.watch/#${tx.hash}`);
                            }}
                            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-[#E9B213]/10 dark:bg-gold/10 text-[#E9B213] border border-[#E9B213]/30 dark:border-gold/20 hover:bg-[#E9B213]/10 dark:hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
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
          ) : isLoadingInitialData ? (
            <div className="card-premium rounded-[10px] p-8">
              <PageLoading 
                message="Loading your activity..." 
                submessage="Fetching transaction history"
              />
            </div>
          ) : (
            <div className="card-premium rounded-[10px] p-8 text-center">
              <div className="text-3xl mb-2 opacity-50">📊</div>
              <p className="text-sm text-[#1F2348]/80 dark:text-white/55">No recent transactions</p>
              <p className="text-xs text-[#1F2348]/60 dark:text-white/65 mt-1">Start by sending NIM or making a payment</p>
            </div>
          )}
        </div>
      )}

      {/* Welcome Message for Non-Connected Users */}
      {!wallet.connected && (
        <div className="animate-fade-up-delay-1 rounded-[10px] p-6 sm:p-7 card-premium relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.12),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.16),transparent_42%)]" />
          <div className="relative text-center">
            <div className="flex justify-center mb-4">
              <Logo size={64} glow />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E9B213]/30/70 dark:border-gold/25 bg-[#E9B213]/10 dark:bg-gold/10 px-3 py-1 text-[11px] font-semibold text-[#E9B213] mb-4">
              <span className="h-2 w-2 rounded-full bg-[#E9B213]" />
              Wallet required for AI chat
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2.5">
              <h2 className="text-2xl sm:text-[2rem] font-black text-[#1F2348] dark:text-white text-balance">
                Welcome to Nim<span className="text-gradient-gold">Agent</span>
              </h2>
              <span className="shrink-0 rounded-full border border-[#E9B213]/30 dark:border-gold/35 bg-[#E9B213]/10 dark:bg-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#E9B213] dark:text-gold shadow-[0_0_0_1px_rgba(245,166,35,0.08)]">
                Beta
              </span>
            </div>
            <p className="text-sm sm:text-[15px] text-[#1F2348]/80 dark:text-white/70 mb-6 max-w-md mx-auto leading-relaxed text-pretty">
              Connect your wallet to unlock AI chat, send NIM, and pay for everyday services from one clean Nimiq flow.
            </p>

            <div className="space-y-2.5 mb-6 text-left">
              {WELCOME_HIGHLIGHTS.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 rounded-2xl border border-[#1F2348]/10 dark:border-white/[0.07] bg-gray-50/90 dark:bg-white/[0.03] px-4 py-3"
                >
                  <span
                    className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${feature.color}1a`, border: `1px solid ${feature.color}33`, color: feature.color }}
                  >
                    <Icon name={feature.icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1F2348] dark:text-white">
                      {feature.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#1F2348]/80 dark:text-white/70">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="gold"
              size="lg"
              icon="wallet"
              fullWidth
              loading={wallet.loading || connecting}
              disabled={wallet.loading || connecting}
              onClick={handleConnect}
            >
              {connecting ? 'Connecting to your wallet...' : 'Connect Wallet to Start'}
            </Button>
            <p className="mt-3 text-xs text-[#1F2348]/60 dark:text-white/60">
              {connecting 
                ? 'Please wait while we connect to Nimiq Pay...' 
                : 'Connect once to open AI chat, view balances, and start payments.'}
            </p>
          </div>
        </div>
      )}

      <div className="card-premium rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F2348]/60 dark:text-white/65">Community</p>
            <p className="mt-1 text-sm font-semibold text-[#1F2348] dark:text-white">Follow NimAgent</p>
          </div>
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => {
              const sharedClasses = 'flex h-11 w-11 items-center justify-center rounded-lg border transition-all duration-200';
              const transitionStyle = { transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' };
              
              // X (Twitter) uses gray/white, Discord uses Discord purple
              const getIconColor = () => {
                if (social.icon === 'x-twitter') return 'text-[#1F2348] dark:text-white';
                if (social.icon === 'discord') return 'text-[#5865F2]';
                return 'text-gray-400 dark:text-white/30';
              };
              
              const getBgColor = () => {
                if (social.icon === 'x-twitter') return 'border-[#1F2348]/20 dark:border-white/20 bg-white/80 dark:bg-white/10 hover:scale-105 hover:bg-[#1F2348]/[0.02] dark:hover:bg-white/20';
                if (social.icon === 'discord') return 'border-[#5865F2]/25 bg-[#5865F2]/10 hover:scale-105 hover:bg-[#5865F2]/20';
                return 'border-dashed border-[#1F2348]/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] opacity-40';
              };
              
              return social.href ? (
                <button
                  key={social.label}
                  type="button"
                  onClick={() => openExternalUrl(social.href!)}
                  title={social.label}
                  aria-label={social.label}
                  className={`${sharedClasses} ${getBgColor()}`}
                  style={{ transition: 'all 200ms cubic-bezier(0.25, 0, 0, 1)' }}
                >
                  <Icon name={social.icon} size={20} className={getIconColor()} />
                </button>
              ) : (
                <div
                  key={social.label}
                  title={`${social.label} coming soon`}
                  aria-label={`${social.label} coming soon`}
                  className={`${sharedClasses} ${getBgColor()}`}
                >
                  <Icon name={social.icon} size={20} className={getIconColor()} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-overlay-in" onClick={() => setShowReferralModal(false)}>
          <div className="max-w-md w-full flex flex-col rounded-t-[1.25rem] sm:rounded-[10px] animate-fade-up glass-strong shadow-2xl overflow-hidden" style={{ maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-0 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" /></div>
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#1F2348]/10 dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#E9B213]/10 dark:bg-gold/15 border border-[#E9B213]/30 dark:border-gold/25 flex items-center justify-center">
                  <Icon name="gift" size={16} className="text-[#E9B213]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#1F2348] dark:text-white">Referral Program</h2>
                  <p className="text-[11px] text-[#1F2348]/60 dark:text-white/50">Earn NIM for every qualified friend</p>
                </div>
              </div>
              <button onClick={() => setShowReferralModal(false)} className="w-8 h-8 rounded-lg bg-white/80 dark:bg-white/5 flex items-center justify-center hover:bg-[#1F2348]/[0.02] dark:hover:bg-white/10 transition-all duration-200 ml-2"
                style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#1F2348]/60 dark:text-white/50"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total', value: String(totalReferrals), color: 'text-[#1F2348] dark:text-white' },
                  { label: 'Qualified', value: String(qualifiedReferrals), color: 'text-success' },
                  { label: 'Claimable', value: totalClaimableNim.toFixed(2), color: 'text-[#E9B213]', sub: 'NIM' },
                  { label: 'Claimed', value: totalClaimedNim.toFixed(2), color: 'text-[#1F2348] dark:text-white', sub: 'NIM' },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="rounded-lg border border-[#1F2348]/10 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] p-2.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#1F2348]/60 dark:text-white/60 mb-1">{label}</p>
                    <p className={`text-sm font-black tabular-nums ${color} leading-tight`}>{value}</p>
                    {sub && <p className="text-[8px] font-bold text-[#1F2348]/50 dark:text-white/65 dark:text-white/30 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
              <div className="rounded-[10px] border border-[#E9B213]/20 dark:border-gold/20 bg-[#E9B213]/10/60 dark:bg-gold/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-[#1F2348] dark:text-white/80">Lifetime Earnings</p>
                    <p className="text-[11px] text-[#1F2348]/60 dark:text-white/65 mt-0.5">Rewards paid in real NIM</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#E9B213] tabular-nums">{totalEarnedNim.toFixed(4)}</p>
                    <p className="text-[10px] font-bold text-amber-500 dark:text-gold/70">NIM</p>
                  </div>
                </div>
                <Button
                  onClick={handleClaimReferralRewards}
                  disabled={claimingReferralRewards || totalClaimableNim <= 0}
                  variant="gold"
                  size="md"
                  loading={claimingReferralRewards}
                  fullWidth
                >
                  {totalClaimableNim > 0 ? `Claim ${totalClaimableNim.toFixed(4)} NIM` : 'No claimable rewards yet'}
                </Button>
                {referralClaimNotice && <p className="mt-2 text-xs text-center font-medium text-[#1F2348]/80 dark:text-white/60">{referralClaimNotice}</p>}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F2348]/60 dark:text-white/60 mb-2">Your Referral Link</p>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0 bg-white/80 dark:bg-white/5 border border-[#1F2348]/10 dark:border-white/[0.08] rounded-lg px-3 py-2.5">
                    <p className="text-[11px] text-[#1F2348] dark:text-white/70 font-mono truncate">{referralLink || 'Loading…'}</p>
                  </div>
                  <Button
                    onClick={async () => {
                      await navigator.clipboard.writeText(referralLink);
                      setCopyToastVisible(true);
                      setTimeout(() => setCopyToastVisible(false), 2000);
                    }}
                    disabled={!referralLink}
                    variant={copyToastVisible ? 'ghost' : 'gold'}
                    size="sm"
                    icon={copyToastVisible ? 'check' : 'copy'}
                    className={copyToastVisible ? 'bg-[#21BCA5]/20 text-[#21BCA5] border border-[#21BCA5]/30' : ''}
                  >
                    {copyToastVisible ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <div className="rounded-[10px] border border-[#1F2348]/10 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F2348]/60 dark:text-white/60 mb-3">How It Works</p>
                <div className="space-y-2.5">
                  {[
                    { step: '1', text: 'Share your referral link with friends' },
                    { step: '2', text: 'They sign up and use NimAgent' },
                    { step: '3', text: 'Earn NIM when they spend $1,000 total' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#E9B213]/10 dark:bg-gold/15 text-[#E9B213] text-[10px] font-black flex items-center justify-center flex-shrink-0">{step}</span>
                      <p className="text-xs text-[#1F2348] dark:text-white/65">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F2348]/60 dark:text-white/60 mb-2">Your Referrals</p>
                {loadingReferral ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <LoadingSpinner size="sm" type="circular" />
                    <p className="text-sm text-[#1F2348]/60 dark:text-white/50">Loading…</p>
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-[#1F2348]/10 dark:border-white/[0.08] p-6 text-center">
                    <Icon name="gift" size={24} className="mx-auto text-gray-300 dark:text-white/60 mb-2" />
                    <p className="text-sm text-[#1F2348]/60 dark:text-white/50">No referrals yet</p>
                    <p className="text-[11px] text-[#1F2348]/50 dark:text-white/65 dark:text-white/35 mt-0.5">Share your link to start earning!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain">
                    {referrals.map((referral: any) => (
                      <div key={referral.id} className="rounded-lg border border-[#1F2348]/10 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1F2348] dark:text-white font-mono truncate">{referral.referred_wallet.slice(0, 8)}…{referral.referred_wallet.slice(-4)}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-[10px] text-[#1F2348]/60 dark:text-white/45">${(referral.total_spent_usd || 0).toFixed(2)} spent</p>
                            <p className="text-[10px] text-[#E9B213]">+{(referral.amount_earned_nim || 0).toFixed(4)} NIM</p>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${referral.is_qualified ? 'bg-success/10 text-success' : 'bg-gray-200 dark:bg-white/10 text-[#1F2348]/60 dark:text-white/40'}`}>
                          {referral.is_qualified ? '✓ Qualified' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-t border-[#1F2348]/10 dark:border-white/[0.08]">
              <Button
                variant="gold"
                fullWidth
                onClick={() => setShowReferralModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4 animate-overlay-in" onClick={() => setShowLeaderboardModal(false)}>
          <div className="max-w-md w-full glass-strong rounded-[10px] p-6 animate-fade-up shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Icon name="trophy" size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1F2348] dark:text-white">Referral Leaderboard</h2>
                  <p className="text-xs text-[#1F2348]/60 dark:text-white/55">Top 20 referrers</p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="w-8 h-8 rounded-lg bg-white/80 dark:bg-white/5 flex items-center justify-center hover:bg-[#1F2348]/[0.02] dark:hover:bg-white/10 transition-all duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}
              >
                <Icon name="close" size={14} className="text-[#1F2348]/60 dark:text-white/50" />
              </button>
            </div>

            {loadingLeaderboard ? (
              <PageLoading message="Loading leaderboard..." />
            ) : leaderboard.length > 0 ? (
              <div className="space-y-3 mb-6">
                {/* Top 3 Special Display */}
                {leaderboard.length > 0 && (
                  <div className="flex justify-center gap-4 mb-6 pb-4 border-b border-[#1F2348]/10 dark:border-white/[0.08]">
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
                          <p className="text-xs font-bold text-[#1F2348] dark:text-white/80">{pos + 1}</p>
                          <p className="text-[10px] font-mono text-[#1F2348]/60 dark:text-white/60 truncate max-w-[60px]">
                            {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-2)}
                          </p>
                          <p className="text-[10px] font-bold text-green-600 dark:text-success">
                            {(entry.totalEarnedNim || 0).toFixed(2)} NIM
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
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-500/10 dark:to-yellow-600/5 border-2 border-yellow-200 dark:border-yellow-500/20' :
                        index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-500/10 dark:to-gray-600/5 border-2 border-[#1F2348]/10 dark:border-gray-500/20' :
                        index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-500/10 dark:to-orange-600/5 border-2 border-orange-200 dark:border-orange-500/20' :
                        'bg-white/60 dark:bg-white/[0.03] border border-[#1F2348]/10 dark:border-white/[0.08]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0 ? 'bg-yellow-200 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                        index === 1 ? 'bg-gray-200 text-[#1F2348] dark:text-white dark:bg-gray-500/20 dark:text-gray-300' :
                        index === 2 ? 'bg-orange-200 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                        'bg-gray-200 text-[#1F2348]/60 dark:text-white/60 dark:bg-white/15 dark:text-white/55'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1F2348] dark:text-white truncate font-mono">
                          {entry.wallet.slice(0, 8)}...{entry.wallet.slice(-4)}
                        </p>
                        <p className="text-[10px] text-[#1F2348]/60 dark:text-white/55">
                          {entry.totalInvited} invited • {entry.referrals} qualified
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600 dark:text-success">
                          {(entry.totalEarnedNim || 0).toFixed(2)} NIM
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-[#1F2348]/60 dark:text-white/65 shadow-inner">
                  <Icon name="trophy" size={24} />
                </div>
                <p className="text-sm text-[#1F2348]/80 dark:text-white/60">No referrals yet!</p>
                <p className="text-xs text-[#1F2348]/60 dark:text-white/55 mt-1">Be the first to refer someone!</p>
              </div>
            )}

            <Button
              variant="gold"
              fullWidth
              onClick={() => setShowLeaderboardModal(false)}
            >
              Done
            </Button>
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
            <p className="text-xs text-[#1F2348]/50 dark:text-white/65 dark:text-gray-600">Share it with friends to earn rewards</p>
          </div>
        </div>
      )}
    </div>
  );
}




