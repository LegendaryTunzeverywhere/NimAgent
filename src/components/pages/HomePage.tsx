'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getOrders } from '@/lib/api-client';
import Logo from '@/components/Logo';
import Icon, { type IconName } from '@/components/Icon';
import type { Transaction } from '@/types';

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
  purple: '#2B6BD6',
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
    case 'swap':
      return 'swap';
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

  useEffect(() => {
    // Fetch NIM price via BFF proxy
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/nim-price?currency=usd`);
        if (res.ok) {
          const data = await res.json();
          setNimPrice(data.price);
          setPriceChange(data.change24h || 3.14);
        }
      } catch (error) {
        console.error('Failed to fetch NIM price:', error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch balance when wallet connects
    if (wallet.connected && wallet.address && !wallet.balance) {
      fetchBalance();
    }
  }, [wallet.connected, wallet.address, wallet.balance, fetchBalance]);

  useEffect(() => {
    // Fetch recent transactions when wallet connects
    const fetchRecentTransactions = async () => {
      if (!wallet.address) return;

      try {
        // Fetch both orders and transactions via BFF proxy
        const [ordersRes, transactionsRes] = await Promise.all([
          fetch(`/api/orders?wallet=${encodeURIComponent(wallet.address)}`),
          fetch(`/api/transactions?wallet=${encodeURIComponent(wallet.address)}`)
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
              'gift-card': { icon: '­ƒÄü', color: 'info', label: 'Gift Card' },
              'airtime': { icon: '­ƒô▒', color: 'info', label: 'Airtime Top-up' },
              'bill': { icon: 'ÔÜí', color: 'info', label: item.details?.service || 'Bill Payment' },
            };

            const typeInfo = typeMap[item.type] || { icon: '­ƒÆ©', color: 'info', label: 'Transaction' };
            
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
            const typeInfo = isSent 
              ? { icon: 'Ôåæ', color: 'error', label: `Sent to ${item.to_address?.slice(0, 8)}...` }
              : { icon: 'Ôåô', color: 'success', label: `Received from ${item.from_address?.slice(0, 8)}...` };

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
        console.error('Failed to fetch recent transactions:', error);
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
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleQuickAction = async (actionType: string) => {
    setActiveTab('chat');
    
    // Handle Scan QR directly without going through AI
    if (actionType === 'Scan QR') {
      addMessage({
        role: 'ai',
        content: 'Ready to scan! Point your camera at a QR code containing a Nimiq address or payment request. ­ƒôÀ',
        action: {
          type: 'qr-scan',
        }
      });
      return;
    }

    // Handle Crypto Swap directly
    if (actionType === 'Crypto Swap') {
      addMessage({
        role: 'ai',
        content: 'Welcome to the crypto swap interface! ­ƒöä\n\nExchange NIM for BTC or BTC for NIM with real-time rates. Perfect for diversifying your crypto portfolio or taking advantage of market opportunities.',
        action: {
          type: 'crypto-swap',
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
    { icon: 'swap', label: 'Crypto Swap', action: () => handleQuickAction('Crypto Swap') },
    { icon: 'gift-card', label: 'Gift Cards', action: () => handleQuickAction('Gift Cards') },
    { icon: 'airtime', label: 'Airtime', action: () => handleQuickAction('Airtime') },
    { icon: 'bill', label: 'Pay Bills', action: () => handleQuickAction('Pay Bills') },
  ];

  // Per-action accent colors for the quick-action tiles
  // Two-accent system: GOLD = NIM-native actions, BLUE = commerce/services.
  const actionAccents: Record<string, string> = {
    'Send NIM': '#F5A623',
    'Generate QR': '#F5A623',
    'Scan QR': '#F5A623',
    'Crypto Swap': '#F5A623',
    'Gift Cards': '#2B6BD6',
    'Airtime': '#2B6BD6',
    'Pay Bills': '#2B6BD6',
  };

  const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5 pb-8">
      {/* Hero Balance Card ÔÇö only shown when connected (Welcome card covers the disconnected state) */}
      {wallet.connected && (
      <div className="animate-fade-up card-premium rounded-3xl p-6 relative overflow-hidden">
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center text-gold">
                <Icon name="wallet" size={15} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Total Balance
              </span>
            </div>
            {wallet.connected && (
              <button
                onClick={disconnectWallet}
                className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-semibold bg-white/5 text-white/50 border border-white/10 hover:bg-error/15 hover:text-error hover:border-error/25 transition-colors"
                title="Disconnect Wallet"
              >
                <Icon name="disconnect" size={12} strokeWidth={2.2} />
                Disconnect
              </button>
            )}
          </div>

          {wallet.balance ? (
            <>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter tabular-nums">
                  {wallet.balance.nim.balanceFormatted}
                </span>
                <span className="text-lg font-bold text-gradient-gold">NIM</span>
              </div>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-sm text-white/40 font-mono">
                  ≈ ${wallet.balance.nim.balanceUSD} USD
                </span>
                {priceChange != null && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${priceChange >= 0 ? 'text-success bg-success/10' : 'text-error bg-error/10'}`}>
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
              className="btn-gold flex-1 rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2"
              onClick={() => setActiveTab('chat')}
            >
              <Icon name="chat" size={16} strokeWidth={2.2} />
              Start AI Chat
            </button>
            <button
              className="flex-1 rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 glass text-gold border border-gold/30 hover:bg-gold/10 transition-all"
              onClick={() => setActiveTab('history')}
            >
              <Icon name="history" size={16} strokeWidth={2.2} />
              History
            </button>
          </div>

          {wallet.error && (
            <p className="text-xs text-error mt-3 text-center">{wallet.error}</p>
          )}
        </div>
      </div>
      )}

      {/* Stats Cards */}
      {wallet.connected && (
        <div className="grid grid-cols-3 gap-3 animate-fade-up-delay-1">
          <div className="card-premium rounded-2xl p-4 text-center">
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">NIM Price</p>
            <p className="text-lg font-bold text-white tabular-nums">${nimPrice?.toFixed(4) || 'ÔÇö'}</p>
            <p className={`text-xs mt-1 font-semibold ${priceChange && priceChange > 0 ? 'text-success' : 'text-error'}`}>
              {priceChange && priceChange > 0 ? '+' : ''}{priceChange?.toFixed(2) ?? '0.00'}%
            </p>
          </div>
          <div className="card-premium rounded-2xl p-4 text-center">
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Sent Today</p>
            <p className="text-lg font-bold text-white tabular-nums">{sentToday.toFixed(0)}</p>
            <p className="text-xs text-white/30 mt-1">
              ${nimPrice ? (sentToday * nimPrice).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="card-premium rounded-2xl p-4 text-center">
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Network</p>
            <p className="text-lg font-bold text-white capitalize">{network}</p>
            <p className="text-xs text-success mt-1 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-live" /> Live
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {wallet.connected && (
        <div className="animate-fade-up-delay-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">
              Quick Actions
            </h2>
            <button
              className="text-xs text-gold hover:text-gold-bright transition-colors font-semibold"
              onClick={() => setActiveTab('chat')}
            >
              See all
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {quickActions.map((action) => {
              const accent = actionAccents[action.label] || '#F5A623';
              return (
                <button
                  key={action.label}
                  className="group card-premium rounded-2xl flex flex-col items-center justify-center py-4 gap-2 hover:-translate-y-1 transition-all duration-300"
                  onClick={action.action}
                >
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
                  <span className="text-[10px] font-semibold text-white/60 text-center leading-tight px-1">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Agent Banner */}
      {wallet.connected && (
        <div
          className="animate-fade-up-delay-3 group rounded-2xl p-5 relative overflow-hidden cursor-pointer card-premium interactive"
          onClick={() => setActiveTab('chat')}
        >
          <div className="flex items-center gap-4 relative">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light">
              <Icon name="robot" size={24} strokeWidth={1.9} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                Your AI Payment Agent
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue-light border border-brand-blue/30">
                  AI
                </span>
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                Ask me anything "send NIM, pay bills, refill Airtime"
              </p>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(167,139,250,0.7)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {wallet.connected && (
        <div className="animate-fade-up-delay-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">
              Recent Activity
            </h2>
            <button 
              className="text-xs text-gold hover:text-gold-bright transition-colors"
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
                      <p className="text-sm font-semibold text-white truncate">{tx.label}</p>
                      <p className="text-xs text-white/40">{tx.time}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: txColor }}>{tx.amount} NIM</p>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform flex-shrink-0 ${expandedTx === tx.id.toString() ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedTx === tx.id.toString() && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2 animate-fade-up">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-white/40">Type:</span>
                        <span className="text-xs text-white/70 capitalize">{tx.category}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-white/40">Amount:</span>
                        <span className="text-xs text-white/70 font-mono">{tx.amount} NIM</span>
                      </div>
                      {tx.usd && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-white/40">USD Value:</span>
                          <span className="text-xs text-white/70 font-mono">{tx.usd}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-white/40">Status:</span>
                        <span className="text-xs text-success font-semibold capitalize">{tx.status}</span>
                      </div>
                      {tx.hash && (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-white/40">TX Hash:</span>
                            <span className="text-xs text-white/70 font-mono text-right break-all">
                              {tx.hash}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
                              const baseUrl = network === 'mainnet' 
                                ? 'https://nimiq.watch/#' 
                                : 'https://test.nimiq.watch/#';
                              window.open(`${baseUrl}${tx.hash}`, '_blank');
                            }}
                            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
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
              <div className="text-3xl mb-2 opacity-50">­ƒô¡</div>
              <p className="text-sm text-white/40">No recent transactions</p>
              <p className="text-xs text-white/30 mt-1">Start by sending NIM or making a payment</p>
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
            <h2 className="text-2xl font-black text-white mb-2">
              Welcome to Nim<span className="text-gradient-gold">Hub</span>
            </h2>
            <p className="text-sm text-white/55 mb-6 max-w-xs mx-auto leading-relaxed">
              Your AI-powered Nimiq payment hub. Send NIM, buy gift cards, top up airtime, pay bills, and swap crypto ÔÇö all in one chat.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-6 text-left">
              {[
                { icon: 'send' as IconName, label: 'Feeless Transfers', color: '#F5A623' },
                { icon: 'robot' as IconName, label: 'AI Assistant', color: '#2B6BD6' },
                { icon: 'gift-card' as IconName, label: 'Gift Cards', color: '#2B6BD6' },
                { icon: 'swap' as IconName, label: 'Crypto Swap', color: '#F5A623' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-2.5 rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]"
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${feature.color}1f`, border: `1px solid ${feature.color}33`, color: feature.color }}
                  >
                    <Icon name={feature.icon} size={16} />
                  </span>
                  <span className="text-xs font-semibold text-white/70">{feature.label}</span>
                </div>
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
    </div>
  );
}
