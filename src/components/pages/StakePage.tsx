'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValidatorCard from '@/components/staking/ValidatorCard';
import StakingDashboard from '@/components/staking/StakingDashboard';
import StakeConfirm from '@/components/staking/StakeConfirm';
import {
  getValidators, getStakerInfo, getNetworkAPY,
  type Validator, type StakerInfo
} from '@/lib/staking';
import { useAppStore } from '@/store/useAppStore';

type StakeView = 'dashboard' | 'validators' | 'confirm';

export default function StakePage() {
  const [view, setView] = useState<StakeView>('dashboard');
  const [validators, setValidators] = useState<Validator[]>([]);
  const [stakerInfo, setStakerInfo] = useState<StakerInfo | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<Validator | null>(null);
  const [apy, setApy] = useState<number>(8);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingStake, setPendingStake] = useState(false);

  const { wallet, setActiveTab } = useAppStore();
  const walletAddress = wallet.address;

  useEffect(() => {
    setActiveTab('stake');
    loadData(walletAddress);
  }, [walletAddress, setActiveTab]);

  async function loadData(address?: string | null) {
    setLoading(true);
    try {
      const [vals, networkApy] = await Promise.all([
        getValidators(),
        getNetworkAPY(),
      ]);
      setValidators(vals);
      setApy(networkApy);

      if (address) {
        // Try to get staker info from blockchain
        const staker = await getStakerInfo(address);
        
        // If blockchain query fails or returns no balance, check transaction history
        if (!staker || !staker.activeBalance) {
          try {
            // Calculate staked balance from transaction history
            const txRes = await fetch(`/api/transactions?wallet=${encodeURIComponent(address.replace(/\s/g, ''))}`);
            if (txRes.ok) {
              const txData = await txRes.json();
              const transactions = txData.transactions || [];
              
              // Sum all stake transactions, subtract unstakes
              const totalStaked = transactions
                .filter((tx: any) => tx.type === 'stake')
                .reduce((sum: number, tx: any) => sum + (tx.amount_luna || 0), 0);
              
              const totalUnstaked = transactions
                .filter((tx: any) => tx.type === 'unstake')
                .reduce((sum: number, tx: any) => sum + (tx.amount_luna || 0), 0);
              
              const netStaked = totalStaked - totalUnstaked;
              
              // If we have staked balance from history, create a synthetic staker info
              if (netStaked > 0) {
                const lastStakeTx = transactions
                  .filter((tx: any) => tx.type === 'stake')
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                
                const syntheticStaker = {
                  address: address,
                  balance: netStaked,
                  activeBalance: netStaked,
                  inactiveBalance: 0,
                  retiredBalance: 0,
                  validator: lastStakeTx?.to_address || null,
                  inactiveFrom: null,
                };
                
                setStakerInfo(syntheticStaker);
                setView('dashboard');
                console.log('[StakePage] Using transaction history for stake balance:', netStaked / 100000, 'NIM');
                setLoading(false);
                return;
              }
            }
          } catch (historyErr) {
            console.error('[StakePage] Failed to check transaction history:', historyErr);
          }
        }
        
        setStakerInfo(staker);
        
        // If we were waiting for a stake and now we have one, clear pending state
        if (pendingStake && staker?.activeBalance) {
          setPendingStake(false);
        }
        
        setView(staker?.activeBalance ? 'dashboard' : 'validators');
      } else {
        setView('validators');
      }
    } catch (err) {
      console.error('Failed to load staking data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStakeSuccess() {
    setPendingStake(true);
    setView('validators');
    
    // Immediately reload data
    await loadData(walletAddress);
    
    // Set up polling to check for confirmation every 10 seconds for up to 2 minutes
    let attempts = 0;
    const maxAttempts = 12; // 12 * 10s = 2 minutes
    
    const pollInterval = setInterval(async () => {
      attempts++;
      console.log(`[StakePage] Polling for stake confirmation (attempt ${attempts}/${maxAttempts})`);
      
      const staker = await getStakerInfo(walletAddress || '');
      
      if (staker?.activeBalance) {
        console.log('[StakePage] ✓ Stake confirmed on-chain!');
        setStakerInfo(staker);
        setPendingStake(false);
        setView('dashboard');
        clearInterval(pollInterval);
      } else if (attempts >= maxAttempts) {
        console.log('[StakePage] Polling timeout - stake may take longer to confirm');
        setPendingStake(false);
        clearInterval(pollInterval);
      }
    }, 10000); // Poll every 10 seconds
  }

  const filteredValidators = validators.filter(v =>
    !searchQuery ||
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <StakeHeader view={view} setView={setView} stakerInfo={stakerInfo} />
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
            className="w-8 h-8 border-2 border-amber-700/30 dark:border-gold/20 border-t-amber-700 dark:border-t-gold rounded-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <StakeHeader view={view} setView={setView} stakerInfo={stakerInfo} />

      {/* Pending stake banner */}
      {pendingStake && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mt-4 mb-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <p className="text-amber-700 dark:text-amber-400 text-sm font-semibold">Stake transaction pending</p>
              <p className="text-gray-600 dark:text-white/50 text-xs mt-0.5">
                Waiting for blockchain confirmation... This usually takes 1-2 minutes.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {view === 'dashboard' && stakerInfo && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            className="flex-1 px-5 py-4"
          >
            <StakingDashboard
              stakerInfo={stakerInfo}
              validators={validators}
              apy={apy}
              walletAddress={walletAddress!}
              onAddMore={() => setView('validators')}
              onUnstake={async () => {
                // Show unstake dialog with amount input
                const amountStr = prompt(
                  `💰 Unstake Your NIM\n\n` +
                  `Current staked: ${(stakerInfo.balance / 100000).toLocaleString()} NIM\n\n` +
                  `Enter amount to unstake (in NIM):`
                );
                
                if (!amountStr) return; // User cancelled
                
                const amount = parseFloat(amountStr);
                if (isNaN(amount) || amount <= 0) {
                  alert('❌ Invalid amount');
                  return;
                }
                
                const amountLuna = Math.round(amount * 100000);
                
                // Check if amount exceeds staked balance
                if (amountLuna > stakerInfo.balance) {
                  alert(`❌ Cannot unstake ${amount} NIM\n\nYou only have ${(stakerInfo.balance / 100000).toLocaleString()} NIM staked.`);
                  return;
                }
                
                try {
                  setLoading(true);
                  
                  // Import unstaking function
                  const { unstakeNIM } = await import('@/lib/staking');
                  
                  // Execute unstake transaction
                  const txHash = await unstakeNIM(walletAddress!, amountLuna);
                  
                  alert(
                    `✅ Unstake Initiated!\n\n` +
                    `Amount: ${amount} NIM\n` +
                    `Transaction: ${txHash}\n\n` +
                    `⏳ Note: Unstaked NIM will be available for withdrawal after ~1 epoch (~24h).`
                  );
                  
                  // Refresh staker info
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                  
                } catch (error: any) {
                  console.error('[StakePage] Unstake error:', error);
                  alert(`❌ Unstake Failed\n\n${error.message || 'Unknown error'}`);
                } finally {
                  setLoading(false);
                }
              }}
            />
          </motion.div>
        )}

        {view === 'validators' && (
          <motion.div
            key="validators"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="flex-1 px-5 py-4"
          >
            {/* APY banner */}
            <div className="bg-amber-50 dark:bg-gold/[0.06] border border-amber-200 dark:border-gold/15 rounded-xl flex items-center justify-between mb-5 px-4 py-3">
              <div>
                <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono tracking-widest">NETWORK APY</p>
                <p className="font-mono text-2xl font-bold text-amber-700 dark:text-gold mt-0.5">~{apy}%</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono">MIN STAKE</p>
                <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white mt-0.5">1,000 NIM</p>
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full mb-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:focus:ring-gold/60 transition-shadow"
            />

            <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono mb-3">
              {filteredValidators.length} VALIDATORS · SORTED BY TRUST SCORE
            </p>

            <div className="space-y-3">
              {filteredValidators.map((validator, i) => (
                <motion.div
                  key={validator.address}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                >
                  <ValidatorCard
                    validator={validator}
                    apy={apy}
                    onSelect={() => {
                      setSelectedValidator(validator);
                      setView('confirm');
                    }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Staking Disclaimer */}
            <div className="mt-6 rounded-xl p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/15">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    <strong className="font-semibold">Staking Disclaimer:</strong> Validator performance varies. Research validators before staking. This is an independent community project not affiliated with Nimiq Foundation.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'confirm' && selectedValidator && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="flex-1 px-5 py-4"
          >
            <StakeConfirm
              validator={selectedValidator}
              apy={apy}
              walletAddress={walletAddress}
              onBack={() => setView('validators')}
              onSuccess={handleStakeSuccess}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function StakeHeader({ view, setView, stakerInfo }: {
  view: StakeView;
  setView: (v: StakeView) => void;
  stakerInfo: StakerInfo | null;
}) {
  const viewLabels: Record<StakeView, string> = {
    dashboard: 'YOUR STAKE',
    validators: 'CHOOSE VALIDATOR',
    confirm: 'CONFIRM STAKE',
  };

  const isTestnet = process.env.NEXT_PUBLIC_NIMIQ_ENV === 'testnet' || 
                    process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'testnet';

  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 dark:border-white/[0.06] sticky top-0 z-40 bg-white/90 dark:bg-[#08090E]/80 backdrop-blur-xl">
      <div>
        {view === 'confirm' ? (
          <button
            onClick={() => setView('validators')}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to validators
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-gray-900 dark:text-white">
              Sta<span className="text-amber-700 dark:text-gold">king</span>
            </h1>
            {isTestnet && (
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                TESTNET
              </span>
            )}
          </div>
        )}
        <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono tracking-widest mt-0.5">
          {viewLabels[view]}
        </p>
      </div>

      {stakerInfo?.activeBalance && view !== 'confirm' && (
        <div className="flex gap-2">
          {(['dashboard', 'validators'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-colors',
                view === v
                  ? 'border-amber-600/40 dark:border-gold/40 text-amber-700 dark:text-gold bg-amber-600/8 dark:bg-gold/8'
                  : 'border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60',
              ].join(' ')}
            >
              {v === 'dashboard' ? 'MY STAKE' : 'VALIDATORS'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
