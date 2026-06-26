'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function BottomNav() {
  const { activeTab, setActiveTab, wallet } = useAppStore();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Hide bottom nav when the virtual keyboard is open — frees up space for chat input.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const THRESHOLD = 0.75;
    
    const checkKeyboardVisibility = () => {
      let visible = false;
      
      // Method 1: visualViewport (most reliable)
      if (window.visualViewport) {
        const ratio = window.visualViewport.height / window.innerHeight;
        visible = ratio < THRESHOLD;
      }
      
      // Method 2: Check if innerHeight changed significantly (fallback)
      if (!visible && window.innerHeight < window.outerHeight * 0.85) {
        visible = true;
      }
      
      setKeyboardVisible(visible);
    };

    // Listen for various events that indicate keyboard visibility changes
    const events = [
      'resize',
      'orientationchange',
      'focusin',
      'focusout'
    ];
    
    events.forEach(event => {
      window.addEventListener(event, checkKeyboardVisibility);
    });
    
    // Also check visualViewport resize if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkKeyboardVisibility);
    }
    
    // Initial check
    checkKeyboardVisibility();
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, checkKeyboardVisibility);
      });
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkKeyboardVisibility);
      }
    };
  }, []);

  if (keyboardVisible) return null;

  const tabs = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'chat' as const,
      label: 'AI Chat',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },

    {
      id: 'history' as const,
      label: 'History',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l4 2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 px-4 pointer-events-none">
      <div className="glass-strong pointer-events-auto mx-auto max-w-md flex items-center justify-around rounded-2xl px-3 py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isChatLocked = tab.id === 'chat' && !wallet.connected;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isChatLocked) return;
                setActiveTab(tab.id);
              }}
              disabled={isChatLocked}
              className={[
                'relative flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-amber-700 dark:text-gold'
                  : isChatLocked
                    ? 'text-gray-400 dark:text-white/30 cursor-not-allowed'
                    : 'text-gray-500 dark:text-white/55 hover:text-gray-700 dark:hover:text-white/80',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={isChatLocked || undefined}
              title={isChatLocked ? 'Connect your wallet to open AI Chat' : undefined}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-xl bg-amber-700/10 dark:bg-gold/10 border border-amber-700/20 dark:border-gold/20" />
              )}
              <span className={`relative transition-transform duration-200 ${isActive ? '-translate-y-0.5 scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className="relative text-[10px] font-bold tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
