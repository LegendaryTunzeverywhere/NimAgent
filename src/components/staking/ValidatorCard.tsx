'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { type Validator, trustScoreLabel, estimateAnnualRewards, lunaToNIM } from '@/lib/staking';
import Icon from '@/components/Icon';

export default function ValidatorCard({ validator, apy, onSelect }: {
  validator: Validator;
  apy: number;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const trust = trustScoreLabel(validator.trustScore);
  const exampleRewards = estimateAnnualRewards(10000, apy, validator.fee);

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    navigator.clipboard.writeText(validator.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.98 }}
      className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:border-amber-300 dark:hover:border-gold/30 text-left transition-colors duration-150 p-4 rounded-xl cursor-pointer"
      onClick={onSelect}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center text-base font-mono font-bold text-amber-700 dark:text-gold flex-shrink-0">
            {validator.name?.charAt(0) || 'V'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
              {validator.name || `${validator.address.slice(0, 10)}...`}
            </p>
            {/* Copyable address */}
            <button
              onClick={copyAddress}
              className="group flex items-center gap-1 mt-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
              title="Copy validator address"
            >
              <p className="font-mono text-[10px] text-gray-500 dark:text-white/55">
                {validator.address.slice(0, 12)}...{validator.address.slice(-8)}
              </p>
              <Icon 
                name={copied ? "check" : "copy"} 
                size={10} 
                strokeWidth={2.5} 
                className={`${copied ? 'text-success' : 'text-gray-500 dark:text-white/50'} opacity-0 group-hover:opacity-100 transition-opacity`}
              />
            </button>
          </div>
        </div>
        {/* Trust score badge */}
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-md flex-shrink-0"
          style={{ color: trust.color, background: `${trust.color}18` }}
        >
          {trust.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'FEE', value: `${(validator.fee ?? 0).toFixed(2)}%` },
          { label: 'STAKED', value: `${lunaToNIM(validator.totalStake ?? 0)} NIM` },
          { label: 'STAKERS', value: (validator.stakers ?? 0).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center">
            <p className="text-gray-500 dark:text-white/55 text-[9px] font-mono mb-0.5">{label}</p>
            <p className="text-gray-900 dark:text-white text-xs font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Reward estimate */}
      <div className="flex items-center justify-between bg-amber-100 dark:bg-gold/[0.06] border border-amber-300 dark:border-gold/15 rounded-xl p-3">
        <span className="text-gray-600 dark:text-white/50 text-xs">10,000 NIM earns ~</span>
        <span className="font-mono text-sm font-semibold text-amber-700 dark:text-gold">
          {exampleRewards.toLocaleString()} NIM/yr
        </span>
      </div>

      {/* Trust score bar */}
      <div className="mt-3">
        <div className="flex justify-between mb-1">
          <span className="text-gray-500 dark:text-white/55 text-[9px] font-mono">TRUST SCORE</span>
          <span className="text-[9px] font-mono" style={{ color: trust.color }}>
            {(validator.trustScore ?? 50).toFixed(0)}/100
          </span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${validator.trustScore ?? 50}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: trust.color }}
          />
        </div>
      </div>
    </motion.div>
  );
}
