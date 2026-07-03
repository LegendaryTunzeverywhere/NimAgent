'use client';
import Modal from './Modal';
import Icon from './Icon';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
}: SettingsModalProps) {
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Settings"
        subtitle="Customize your NimAgent experience"
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
                  <p className="text-xs text-gray-500 dark:text-white/55 mt-0.5">Choose your display theme</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'dark'
                        ? 'bg-amber-600 dark:bg-gold text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/65 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'light'
                        ? 'bg-amber-600 dark:bg-gold text-white'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/65 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* App Actions Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-2">
              <Icon name="settings" size={14} strokeWidth={2} className="text-gray-500 dark:text-white/55" />
              App Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  // Clear all caches
                  if (typeof window !== 'undefined') {
                    // Clear localStorage
                    localStorage.clear();
                    
                    // Clear sessionStorage
                    sessionStorage.clear();
                    
                    // Clear service worker caches if available
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                      });
                    }
                    
                    // Reload the page
                    window.location.reload();
                  }
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-brand-blue/10 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-brand-blue/20 transition-colors">
                    <Icon name="refresh" size={16} strokeWidth={2} className="text-blue-600 dark:text-brand-blue-light" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Refresh App</p>
                    <p className="text-xs text-gray-500 dark:text-white/55 mt-0.5">Clear cache and reload</p>
                  </div>
                </div>
                <Icon name="chevron-right" size={16} strokeWidth={2} className="text-gray-500 dark:text-white/50 group-hover:text-gray-600 dark:group-hover:text-white/50 transition-colors" />
              </button>
            </div>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-white/80 mb-3 flex items-center gap-2">
              <Icon name="info" size={14} strokeWidth={2} className="text-gray-500 dark:text-white/55" />
              About
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                <p className="text-xs text-gray-500 dark:text-white/55">Version</p>
                <p className="text-xs font-mono text-gray-700 dark:text-white/70">1.1.0</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
