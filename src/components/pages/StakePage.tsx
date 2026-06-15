'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValidatorCard from '@/components/staking/ValidatorCard';
import StakingDashboard from '@/components/staking/StakingDashboard';
import StakeConfirm from '@/components/staking/StakeConfirm';
import Modal from '@/components/Modal';
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
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [unstaking, setUnstaking] = useState(false);
  const [unstakeResult, setUnstakeResult] = useState<{ txHash: string; amount: number } | null>(null);
  const [unstakeError, setUnstakeError] = useState<string | null>(null);
  const [hubApi, setHubApi] = useState<any>(null); // Pre-loaded Hub API instance

  const { wallet, setActiveTab } = useAppStore();
  const walletAddress = wallet.address;

  // Prewarm Hub API on mount to prevent popup blocking
  useEffect(() => {
    async function prewarmHub() {
      try {
        const HubApi = (await import('@nimiq/hub-api')).default;
        const hub = new HubApi(process.env.NEXT_PUBLIC_NIMIQ_HUB_URL || 'https://hub.nimiq-testnet.com');
        setHubApi(hub);
        console.log('[StakePage] Hub API prewarmed');
      } catch (error) {
        console.error('[StakePage] Failed to prewarm Hub API:', error);
      }
    }
    prewarmHub();
  }, []);

  const loadData = useCallback(async (address?: string | null) => {
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
                .filter((tx: any) => tx.type === 'unstake' || tx.type === 'withdraw')
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
        // Use functional update to avoid pendingStake dependency
        setPendingStake((prev) => staker?.activeBalance ? false : prev);
        
        setView(staker?.activeBalance ? 'dashboard' : 'validators');
      } else {
        setView('validators');
      }
    } catch (err) {
      console.error('Failed to load staking data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setActiveTab('stake');
    loadData(walletAddress);
  }, [walletAddress, setActiveTab, loadData]);

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
          className="mx-5 mt-4 mb-2 bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <p className="text-amber-700 dark:text-amber-400 text-sm font-semibold">Stake transaction pending</p>
              <p className="text-gray-600 dark:text-white/65 text-xs mt-0.5">
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
                // Show modal instead of prompt
                setShowUnstakeModal(true);
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
            <div className="bg-amber-100 dark:bg-gold/[0.06] border border-amber-300 dark:border-gold/15 rounded-xl flex items-center justify-between mb-5 px-4 py-3">
              <div>
                <p className="text-gray-500 dark:text-white/55 text-[10px] font-mono tracking-widest">NETWORK APY</p>
                <p className="font-mono text-2xl font-bold text-amber-700 dark:text-gold mt-0.5">~{apy}%</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 dark:text-white/55 text-[10px] font-mono">MIN STAKE</p>
                <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white mt-0.5">1,000 NIM</p>
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full mb-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.06] glass dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:focus:ring-gold/60 transition-shadow"
            />

            <p className="text-gray-500 dark:text-white/55 text-[10px] font-mono mb-3">
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
            <div className="mt-6 rounded-xl p-4 bg-amber-100 dark:bg-amber-500/5 border border-amber-300 dark:border-amber-500/15">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    <strong className="font-semibold">Staking Disclaimer:</strong> Validator performance varies. Research validators before staking.
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

      {/* Unstake Modal */}
      <Modal
        open={showUnstakeModal}
        onClose={() => {
          if (unstaking) return;
          setShowUnstakeModal(false);
          setUnstakeAmount('');
          setUnstakeResult(null);
          setUnstakeError(null);
        }}
        title={unstakeResult ? 'Unstake Initiated' : unstakeError ? 'Unstake Failed' : 'Unstake Your NIM'}
        subtitle={
          unstakeResult
            ? `${unstakeResult.amount.toLocaleString()} NIM unstaked`
            : unstakeError
            ? 'Something went wrong'
            : `Currently staked: ${stakerInfo ? (stakerInfo.balance / 100000).toLocaleString() : '0'} NIM`
        }
        footer={
          unstakeResult ? (
            <button
              onClick={() => {
                setShowUnstakeModal(false);
                setUnstakeAmount('');
                setUnstakeResult(null);
                setUnstakeError(null);
                setTimeout(() => window.location.reload(), 100);
              }}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 dark:bg-gold text-white dark:text-background-primary hover:bg-amber-600 dark:hover:bg-gold-bright transition-colors"
            >
              Done
            </button>
          ) : unstakeError ? (
            <>
              <button
                onClick={() => setUnstakeError(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  setShowUnstakeModal(false);
                  setUnstakeAmount('');
                  setUnstakeError(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowUnstakeModal(false);
                  setUnstakeAmount('');
                  setUnstakeError(null);
                }}
                disabled={unstaking}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!unstakeAmount || !stakerInfo || !walletAddress) return;

                  const amount = parseFloat(unstakeAmount);
                  if (isNaN(amount) || amount <= 0) {
                    setUnstakeError('Please enter a valid amount.');
                    return;
                  }

                  const amountLuna = Math.round(amount * 100000);

                  if (amountLuna > stakerInfo.balance) {
                    setUnstakeError(`You only have ${(stakerInfo.balance / 100000).toLocaleString()} NIM staked. Enter a smaller amount.`);
                    return;
                  }

                  try {
                    setUnstaking(true);
                    setUnstakeError(null);

                    const { unstakeNIM } = await import('@/lib/staking');
                    const txHash = await unstakeNIM(walletAddress, amountLuna, hubApi);

                    setUnstakeResult({ txHash, amount });
                    setUnstakeAmount('');
                  } catch (error: any) {
                    console.error('[StakePage] Unstake error:', error);
                    if (error.message?.includes('cancelled') || error.message?.includes('closed')) {
                      // User dismissed the wallet popup — close modal silently
                      setShowUnstakeModal(false);
                      setUnstakeAmount('');
                    } else {
                      setUnstakeError(error.message || 'Unstake failed. Please try again.');
                    }
                  } finally {
                    setUnstaking(false);
                  }
                }}
                disabled={!unstakeAmount || unstaking || parseFloat(unstakeAmount || '0') <= 0}
                className="btn-gold px-6 py-2 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {unstaking ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Unstaking...
                  </>
                ) : (
                  'Confirm Unstake'
                )}
              </button>
            </>
          )
        }
      >
        {/* Success state */}
        {unstakeResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-success/15 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-success">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {unstakeResult.amount.toLocaleString()} NIM unstaked
              </p>
              <p className="text-sm text-gray-500 dark:text-white/65">Transaction submitted to the network</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] p-3 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 dark:text-white/55 uppercase tracking-wider">Transaction hash</p>
              <p className="text-xs font-mono text-gray-700 dark:text-white/70 break-all leading-relaxed">
                {unstakeResult.txHash}
              </p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl p-3 bg-amber-100 dark:bg-amber-500/8 border border-amber-300 dark:border-amber-500/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Your NIM will be available to withdraw after approximately 1 epoch (~24 hours). This is a Nimiq network requirement.
              </p>
            </div>
          </div>
        ) : unstakeError ? (
          /* Error state */
          <div className="space-y-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-error/15 mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-error">
                <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Transaction failed</p>
            </div>
            <div className="rounded-xl bg-red-100 dark:bg-error/8 border border-red-300 dark:border-error/20 p-3">
              <p className="text-sm text-red-700 dark:text-error leading-relaxed">{unstakeError}</p>
            </div>
          </div>
        ) : (
          /* Default: amount entry */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-white/70">
                Amount to unstake (NIM)
              </label>
              <input
                type="number"
                autoFocus
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                min="0.00001"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border-2 border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-lg font-mono placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-amber-500 dark:focus:border-gold/50 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-gold/20 transition-all"
              />
              {stakerInfo && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-white/55">Available: {(stakerInfo.balance / 100000).toLocaleString()} NIM</span>
                  <button
                    type="button"
                    onClick={() => setUnstakeAmount((stakerInfo.balance / 100000).toString())}
                    className="text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright font-semibold transition-colors"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-xl p-3 bg-amber-100 dark:bg-amber-500/5 border border-amber-300 dark:border-amber-500/15">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">⏳</span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong className="font-semibold">Note:</strong> Unstaked NIM will be available for withdrawal after approximately 1 epoch (~24 hours). This is a blockchain requirement for security.
              </p>
            </div>
          </div>
        )}
      </Modal>
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
    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 dark:border-white/[0.06] sticky top-0 z-40 glass-strong">
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
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/20">
                TESTNET
              </span>
            )}
          </div>
        )}
        <p className="text-gray-500 dark:text-white/55 text-[10px] font-mono tracking-widest mt-0.5">
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
                  : 'border-gray-200 dark:border-white/[0.06] text-gray-500 dark:text-white/55 hover:text-gray-700 dark:hover:text-white/60',
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
