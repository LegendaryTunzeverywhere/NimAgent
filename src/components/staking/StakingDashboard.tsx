'use client';
import { motion } from 'framer-motion';
import { lunaToNIM, estimateAnnualRewards, trustScoreLabel, type StakerInfo, type Validator } from '@/lib/staking';

export default function StakingDashboard({ stakerInfo, validators, apy, walletAddress, onAddMore, onUnstake }: {
  stakerInfo: StakerInfo;
  validators: Validator[];
  apy: number;
  walletAddress: string;
  onAddMore: () => void;
  onUnstake: () => void;
}) {
  const currentValidator = validators.find(v => v.address === stakerInfo.validator);
  const activeNIM = stakerInfo.activeBalance / 100000;
  const annualRewards = currentValidator
    ? estimateAnnualRewards(activeNIM, apy, currentValidator.fee)
    : 0;

  return (
    <div className="space-y-4">
      {/* Main staking card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-6 rounded-xl shadow-sm dark:shadow-none"
      >
        <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono tracking-widest mb-4">YOUR ACTIVE STAKE</p>
        <div className="text-center mb-6">
          <p className="font-mono text-4xl font-extrabold text-amber-700 dark:text-gold">
            {activeNIM.toLocaleString()}
          </p>
          <p className="font-mono text-gray-500 dark:text-white/40 text-sm mt-1">NIM staked</p>
        </div>

        {/* Reward estimates */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-black/30 rounded-xl p-3 text-center">
            <p className="text-gray-500 dark:text-white/40 text-[9px] font-mono mb-1">MONTHLY</p>
            <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-[#00D4A1]">
              ~{(annualRewards / 12).toFixed(1)} NIM
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black/30 rounded-xl p-3 text-center">
            <p className="text-gray-500 dark:text-white/40 text-[9px] font-mono mb-1">YEARLY</p>
            <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-[#00D4A1]">
              ~{annualRewards.toFixed(1)} NIM
            </p>
          </div>
        </div>
      </motion.div>

      {/* Current validator */}
      {currentValidator && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-4 rounded-xl">
          <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono mb-3">STAKING WITH</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center font-mono font-bold text-amber-700 dark:text-gold text-sm">
                {currentValidator.name?.charAt(0) || 'V'}
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{currentValidator.name}</p>
                <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono">
                  {currentValidator.fee}% fee · {currentValidator.payoutSchedule || 'pool'} payout
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-bold text-amber-700 dark:text-gold">
                {(apy * (1 - currentValidator.fee / 100)).toFixed(1)}%
              </p>
              <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono">NET APY</p>
            </div>
          </div>
        </div>
      )}

      {/* Inactive stake (if any) */}
      {stakerInfo.inactiveBalance > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-700 dark:text-amber-400 text-xs font-semibold">Unstaking in progress</p>
              <p className="font-mono text-sm text-gray-900 dark:text-white mt-0.5">
                {lunaToNIM(stakerInfo.inactiveBalance)} NIM
              </p>
            </div>
            <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">PENDING</span>
          </div>
          <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono mt-2">
            Available after the reporting window (~1 epoch)
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onAddMore}
          className="flex-1 py-3 rounded-xl bg-amber-700 dark:bg-gold text-white dark:text-[#0a0c17] font-semibold hover:bg-amber-800 dark:hover:bg-gold-bright transition-colors"
        >
          Stake More
        </button>
        <button
          onClick={onUnstake}
          className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          Unstake
        </button>
      </div>

      <p className="text-gray-400 dark:text-white/30 text-[10px] font-mono text-center">
        NON-CUSTODIAL · YOUR NIM STAYS IN YOUR WALLET
      </p>
    </div>
  );
}
