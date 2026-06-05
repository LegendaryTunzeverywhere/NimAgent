'use client';

import { useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  network: 'testnet' | 'mainnet';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onNetworkChange: (network: 'testnet' | 'mainnet') => void;
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  network,
  onThemeChange,
  onNetworkChange,
}: SettingsModalProps) {
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<'testnet' | 'mainnet' | null>(null);

  const handleNetworkToggle = (newNetwork: 'testnet' | 'mainnet') => {
    if (newNetwork === 'mainnet' && network === 'testnet') {
      // Show warning before switching to mainnet
      setPendingNetwork(newNetwork);
      setShowNetworkWarning(true);
    } else {
      onNetworkChange(newNetwork);
    }
  };

  const confirmNetworkSwitch = () => {
    if (pendingNetwork) {
      onNetworkChange(pendingNetwork);
      setPendingNetwork(null);
      setShowNetworkWarning(false);
    }
  };

  const cancelNetworkSwitch = () => {
    setPendingNetwork(null);
    setShowNetworkWarning(false);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Settings"
        subtitle="Customize your NimHub experience"
      >
        <div className="space-y-6">
          {/* Appearance Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-2">
              <Icon name="sparkles" size={14} strokeWidth={2} className="text-amber-600 dark:text-gold" />
              Appearance
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Theme</p>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Choose your display theme</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'dark'
                        ? 'bg-amber-600 dark:bg-gold text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'light'
                        ? 'bg-amber-600 dark:bg-gold text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Network Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-2">
              <Icon name="globe" size={14} strokeWidth={2} className="text-blue-600 dark:text-brand-blue-light" />
              Network
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Blockchain Network</p>
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                    {network === 'testnet' ? 'Test network (fake NIM)' : 'Main network (real NIM)'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNetworkToggle('testnet')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      network === 'testnet'
                        ? 'bg-blue-600 dark:bg-brand-blue text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Testnet
                  </button>
                  <button
                    onClick={() => handleNetworkToggle('mainnet')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      network === 'mainnet'
                        ? 'bg-red-600 dark:bg-error text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Mainnet
                  </button>
                </div>
              </div>
              
              {network === 'mainnet' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-error/10 border border-red-200 dark:border-error/20">
                  <Icon name="alert" size={16} strokeWidth={2} className="text-red-600 dark:text-error flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-error">Mainnet Active</p>
                    <p className="text-xs text-red-700 dark:text-error/70 mt-1">
                      You are using real NIM. All transactions are permanent and cannot be reversed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-2">
              <Icon name="info" size={14} strokeWidth={2} className="text-gray-500 dark:text-white/40" />
              About
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                <p className="text-xs text-gray-500 dark:text-white/40">Version</p>
                <p className="text-xs font-mono text-gray-700 dark:text-white/70">1.0.0</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                <p className="text-xs text-gray-500 dark:text-white/40">Network</p>
                <p className="text-xs font-mono text-gray-700 dark:text-white/70 capitalize">{network}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Network Switch Warning Modal */}
      <Modal
        open={showNetworkWarning}
        onClose={cancelNetworkSwitch}
        title="Switch to Mainnet?"
        subtitle="You're about to use real money"
        footer={
          <>
            <button
              onClick={cancelNetworkSwitch}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmNetworkSwitch}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 dark:bg-error/90 text-white hover:bg-red-600 dark:hover:bg-error transition-colors flex items-center gap-1.5"
            >
              <Icon name="alert" size={14} strokeWidth={2.2} /> Switch to Mainnet
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-red-50 dark:bg-error/10 border border-red-200 dark:border-error/20 text-red-600 dark:text-error flex items-center justify-center flex-shrink-0">
            <Icon name="alert" size={20} strokeWidth={2} />
          </span>
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
              Switching to mainnet means you'll be using <strong className="text-gray-900 dark:text-white">real NIM</strong> and making <strong className="text-gray-900 dark:text-white">real transactions</strong> that cannot be undone.
            </p>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-red-600 dark:text-error mt-0.5">•</span>
                <span>All transactions are permanent and irreversible</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 dark:text-error mt-0.5">•</span>
                <span>You will be spending real cryptocurrency</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 dark:text-error mt-0.5">•</span>
                <span>Double-check all addresses and amounts</span>
              </li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-white/50 pt-2 border-t border-gray-200 dark:border-white/5">
              We recommend testing on testnet first if you're new to NimHub.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
