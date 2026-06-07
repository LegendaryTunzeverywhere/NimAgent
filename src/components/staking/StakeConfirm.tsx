'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { stakeNIM, estimateAnnualRewards, prefetchBlockHeight, type Validator } from '@/lib/staking';

export default function StakeConfirm({ validator, apy, walletAddress, onBack, onSuccess }: {
  validator: Validator;
  apy: number;
  walletAddress: string | null;
  onBack: () => void;
  onSuccess: (txHash: string) => void;
}) {
  const [amountNIM, setAmountNIM] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefetch block height when component mounts to avoid delays in click handler
  useEffect(() => {
    prefetchBlockHeight();
  }, []);

  const amount = parseFloat(amountNIM) || 0;
  const amountLuna = Math.round(amount * 100000);
  const annualRewards = amount >= 1000 ? estimateAnnualRewards(amount, apy, validator.fee) : 0;
  const netAPY = apy * (1 - validator.fee / 100);

  async function handleConfirm() {
    if (amount < 1000) { setError('Minimum stake is 1,000 NIM'); return; }
    if (!walletAddress) { setError('Wallet not connected'); return; }

    setLoading(true);
    setError('');

    try {
      // stakeNIM automatically records the transaction in history
      const txHash = await stakeNIM(walletAddress, validator.address, amountLuna);
      onSuccess(txHash);
    } catch (err: any) {
      setError(err.message?.includes('cancel') ? 'Transaction cancelled.' : (err.message || 'Staking failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Validator summary */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-4 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center font-mono font-bold text-amber-700 dark:text-gold">
            {validator.name?.charAt(0) || 'V'}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{validator.name}</p>
            <p className="font-mono text-[10px] text-gray-500 dark:text-white/40">
              {validator.address.slice(0, 12)}...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
            <p className="text-gray-500 dark:text-white/40 text-[9px] font-mono mb-1">YOUR NET APY</p>
            <p className="text-amber-700 dark:text-gold font-mono font-bold">{netAPY.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
            <p className="text-gray-500 dark:text-white/40 text-[9px] font-mono mb-1">VALIDATOR FEE</p>
            <p className="text-gray-900 dark:text-white font-mono font-bold">{validator.fee}%</p>
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label className="text-gray-500 dark:text-white/40 text-[10px] font-mono tracking-widest block mb-2">
          AMOUNT TO STAKE
        </label>
        <div className="relative">
          <input
            type="number"
            value={amountNIM}
            onChange={(e) => { setAmountNIM(e.target.value); setError(''); }}
            placeholder="1000"
            min="1000"
            className="w-full px-4 py-3 pr-16 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:focus:ring-gold/60 transition-shadow"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-gray-500 dark:text-white/40">
            NIM
          </span>
        </div>
        <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono mt-1.5">
          Minimum: 1,000 NIM · NIM stays in your wallet
        </p>
      </div>

      {/* Reward estimate */}
      {amount >= 1000 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-4 rounded-xl"
        >
          <p className="text-gray-500 dark:text-white/40 text-[10px] font-mono mb-3">ESTIMATED REWARDS</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-white/60 text-sm">Per month</span>
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                ~{(annualRewards / 12).toFixed(1)} NIM
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-white/60 text-sm">Per year</span>
              <span className="font-mono text-sm text-amber-700 dark:text-gold font-semibold">
                ~{annualRewards.toFixed(1)} NIM
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Important notice */}
      <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
        <p className="text-amber-700 dark:text-amber-400 text-[10px] font-mono mb-1">⚠ IMPORTANT</p>
        <p className="text-gray-600 dark:text-white/50 text-xs leading-relaxed">
          Your NIM remains in your wallet. Rewards are distributed by the validator off-chain.
          Unstaking requires waiting ~1 epoch before withdrawal.
        </p>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading || amount < 1000}
        className="w-full py-3 rounded-xl bg-amber-700 dark:bg-gold text-white dark:text-[#0a0c17] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-800 dark:hover:bg-gold-bright transition-colors"
      >
        {loading ? 'Opening wallet...' : `Stake ${amount >= 1000 ? amount.toLocaleString() : ''} NIM`}
      </button>

      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl border border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
