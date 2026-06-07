'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ValidatorCard from '@/components/staking/ValidatorCard';
import StakingDashboard from '@/components/staking/StakingDashboard';
import StakeConfirm from '@/components/staking/StakeConfirm';
import {
  getValidators, getStakerInfo, getNetworkAPY, prefetchBlockHeight,
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

  const { wallet, setActiveTab } = useAppStore();
  const walletAddress = wallet.address;

  useEffect(() => {
    setActiveTab('stake');
    loadData(walletAddress);
    // Prefetch block height in background so it's ready when user clicks stake
    prefetchBlockHeight();
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
        const staker = await getStakerInfo(address);
        setStakerInfo(staker);
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
              onUnstake={() => {/* handle unstake */}}
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
              onSuccess={() => loadData(walletAddress)}
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
