'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from '@/components/Icon';
import Button from '@/components/Button';

export default function SignInPage() {
  const wallet = useAppStore(state => state.wallet);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSignIn = () => {
    if (!agreedToTerms) {
      alert('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    if (typeof window !== 'undefined' && (window as any).__triggerManualAuth) {
      (window as any).__triggerManualAuth();
    }
  };

  return (
    <div className="fixed inset-x-0 max-w-2xl mx-auto w-full overflow-y-auto scrollbar-hide bg-white dark:bg-[#0A0C17]"
      style={{ top: '60px', bottom: '80px', height: 'calc(100dvh - 140px)' }}>
      <div className="max-w-lg mx-auto px-5 py-10 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-5 animate-fade-up">
          <div className="relative inline-flex">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-3xl opacity-20 dark:opacity-30 animate-lock-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(233, 178, 19, 0.4) 0%, transparent 70%)',
                filter: 'blur(24px)'
              }} />
            {/* Lock container */}
            <div className="relative w-24 h-24 mx-auto rounded-2xl flex items-center justify-center bg-white/80 dark:bg-[#1F1C3E]">
              <span style={{ filter: 'drop-shadow(0 2px 8px rgba(233, 178, 19, 0.3))' }}>
                <Icon name="lock" size={44} strokeWidth={2.5} 
                  className="text-[#1F2348] dark:text-white animate-lock-bob" />
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-[#1F2348] dark:text-white tracking-tight leading-none">Secure Sign-In</h1>
            <p className="text-base text-[#1F2348]/80 dark:text-white/70 max-w-sm mx-auto leading-relaxed">One signature unlocks your full NimAgent experience for 24 hours</p>
          </div>
        </div>
        {/* What You'll Unlock */}
        <div className="animate-fade-up rounded-2xl p-6 space-y-4 bg-white/60 dark:bg-[#10121F] border border-[#1F2348]/10 dark:border-white/[0.07]" 
          style={{ animationDelay: '100ms' }}>
          <h3 className="text-base font-semibold text-[#1F2348] dark:text-white">What You'll Unlock</h3>
          <ul className="space-y-3 text-sm text-[#1F2348] dark:text-white/70">
            {[
              { icon: 'chat', text: 'AI-powered payment assistant', color: '#0582CA' },
              { icon: 'history', text: 'Transaction history & tracking', color: '#E9B213' },
              { icon: 'send', text: 'Send NIM with ease', color: '#E9B213' },
              { icon: 'gift-card', text: 'Buy gift cards & pay bills', color: '#0582CA' },
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                  <span style={{ color: item.color }}>
                    <Icon name={item.icon as any} size={16} strokeWidth={2} />
                  </span>
                </div>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Terms Checkbox */}
        <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
          <label className={`group flex items-start gap-3.5 p-5 rounded-2xl cursor-pointer transition-all duration-200 bg-white/60 dark:bg-[#10121F] ${
              agreedToTerms 
                ? 'border-[2px] border-[#E9B213]' 
                : 'border-[2px] border-[#1F2348]/10 dark:border-white/[0.07]'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}>
            <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded-md border-2 cursor-pointer transition-colors"
              style={{
                borderColor: agreedToTerms ? '#E9B213' : undefined,
                backgroundColor: agreedToTerms ? '#E9B213' : 'transparent',
                accentColor: '#E9B213',
                transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)',
              }} />
            <span className="text-sm text-[#1F2348] dark:text-white/70 leading-relaxed flex-1">
              I agree to the <button onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                className="font-semibold hover:underline underline-offset-2"
                style={{ color: '#E9B213' }}>Terms</button>
              {' '}and <button onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}
                className="font-semibold hover:underline underline-offset-2"
                style={{ color: '#E9B213' }}>Privacy Policy</button>
            </span>
          </label>
        </div>
        {/* CTA Button */}
        <div className="animate-fade-up space-y-4" style={{ animationDelay: '300ms' }}>
          <Button
            onClick={handleSignIn}
            disabled={!agreedToTerms}
            variant="gold"
            size="lg"
            icon="unlock"
            fullWidth
          >
            Sign In Securely
          </Button>
          {wallet.address && (
            <div className="text-center space-y-2 pt-2">
              <p className="text-xs text-[#1F2348]/60 dark:text-white/60 uppercase tracking-widest font-semibold">Connected Wallet</p>
              <p className="text-xs font-mono text-[#1F2348] dark:text-white/70 break-all px-4 py-2 rounded-lg bg-white/80 dark:bg-[#10121F]">{wallet.address}</p>
            </div>
          )}
        </div>
      </div>
      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-overlay-in backdrop-blur-sm bg-black/60 dark:bg-black/70"
          onClick={() => setShowTerms(false)}>
          <div className="rounded-[10px] max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-modal-in glass-strong"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 px-6 py-5 flex items-center justify-between z-10 glass-strong border-b border-[#1F2348]/10 dark:border-white/[0.08]">
              <h2 className="text-lg font-bold text-[#1F2348] dark:text-white">Terms and Conditions</h2>
              <button onClick={() => setShowTerms(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1F2348]/60 dark:text-white/65 hover:text-[#1F2348] dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}>
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(80vh-160px)] space-y-4 text-sm text-[#1F2348] dark:text-white/70 leading-relaxed">
              <p className="font-semibold text-[#1F2348] dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">1. Acceptance of Terms</h3>
                <p>By signing in and using NimAgent, you agree to be bound by these Terms and Conditions.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">2. Service Description</h3>
                <p>NimAgent is an AI-powered assistant that facilitates cryptocurrency transactions, gift card purchases, airtime top-ups, and bill payments using the Nimiq blockchain.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">3. Wallet Authentication</h3>
                <p>Authentication requires a cryptographic signature from your wallet. Sessions last 24 hours and can be revoked at any time.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">4. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  <li>You are responsible for securing your wallet and private keys</li>
                  <li>You must verify all transaction details before confirming payments</li>
                  <li>You agree not to use the service for illegal activities</li>
                  <li>You understand that blockchain transactions are irreversible</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">5. Third-Party Services</h3>
                <p>Gift cards, airtime, and bill payment services are provided through third-party partners.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">6. Limitation of Liability</h3>
                <p>NimAgent and its operators are not liable for any losses resulting from wallet compromise, transaction errors, network issues, or third-party service failures.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">7. Modifications</h3>
                <p>We reserve the right to modify these terms at any time.</p></section>
            </div>
            <div className="sticky bottom-0 px-6 py-4 glass-strong border-t border-[#1F2348]/10 dark:border-white/[0.08]">
              <Button
                onClick={() => setShowTerms(false)}
                variant="gold"
                fullWidth
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-overlay-in backdrop-blur-sm bg-black/60 dark:bg-black/70"
          onClick={() => setShowPrivacy(false)}>
          <div className="rounded-[10px] max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-modal-in glass-strong"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 px-6 py-5 flex items-center justify-between z-10 glass-strong border-b border-[#1F2348]/10 dark:border-white/[0.08]">
              <h2 className="text-lg font-bold text-[#1F2348] dark:text-white">Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1F2348]/60 dark:text-white/65 hover:text-[#1F2348] dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.25, 0, 0, 1)' }}>
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(80vh-160px)] space-y-4 text-sm text-[#1F2348] dark:text-white/70 leading-relaxed">
              <p className="font-semibold text-[#1F2348] dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">1. Data We Collect</h3>
                <p>We collect minimal data required to provide our services:</p>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  <li>Wallet Address: Your public Nimiq wallet address</li>
                  <li>Transaction Data: Hashes, amounts, timestamps</li>
                  <li>Chat History: AI conversation history</li>
                  <li>Session Data: 24-hour authentication cookies</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">2. Data We Do NOT Collect</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>No private keys or wallet seeds</li>
                  <li>No personal identification</li>
                  <li>No location tracking</li>
                  <li>No third-party analytics</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">3. How We Use Your Data</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Process and fulfill transactions</li>
                  <li>Provide transaction history</li>
                  <li>Maintain chat sessions</li>
                  <li>Prevent fraud</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">4. Data Security</h3>
                <p>We implement industry-standard security measures including encrypted HTTPS, secure session cookies, and server-side validation.</p></section>
              <section><h3 className="font-bold text-base text-[#1F2348] dark:text-white mb-2">5. Your Rights</h3>
                <p>You have the right to access, delete, and revoke authentication at any time.</p></section>
            </div>
            <div className="sticky bottom-0 px-6 py-4 glass-strong border-t border-[#1F2348]/10 dark:border-white/[0.08]">
              <Button
                onClick={() => setShowPrivacy(false)}
                variant="gold"
                fullWidth
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




