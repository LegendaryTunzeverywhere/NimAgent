'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from '@/components/Icon';

export default function SignInPage() {
  const wallet = useAppStore(state => state.wallet);
  const [timeLeft, setTimeLeft] = useState(300);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    <div className="fixed inset-x-0 max-w-2xl mx-auto w-full bg-gradient-to-b from-white to-amber-50/30 dark:from-gray-950 dark:to-gray-900 overflow-y-auto scrollbar-hide"
      style={{ top: '60px', bottom: '80px', height: 'calc(100dvh - 140px)' }}>
      <div className="max-w-lg mx-auto px-5 py-10 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-5 animate-fade-up">
          <div className="relative inline-flex">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-700 rounded-3xl blur-2xl opacity-20 animate-pulse" />
            <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 dark:from-amber-600 dark:via-amber-500 dark:to-amber-400 flex items-center justify-center shadow-2xl shadow-amber-500/30 transform hover:scale-105 transition-transform duration-300">
              <Icon name="lock" size={44} strokeWidth={2.5} className="text-white drop-shadow-lg" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none">Secure Sign-In</h1>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">One signature unlocks your full NimAgent experience for 24 hours</p>
          </div>
          {timeLeft > 0 ? (
            <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-950/50 dark:to-amber-900/30 border border-amber-200 dark:border-amber-800/50 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-bold text-amber-900 dark:text-amber-300 tabular-nums">{formatTime(timeLeft)}</span>
              <span className="text-xs text-amber-700 dark:text-amber-400">remaining</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
              <Icon name="alert" size={16} strokeWidth={2} className="text-red-600 dark:text-red-400" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-300">Session expired</span>
            </div>
          )}
        </div>
        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {[
            { icon: 'send', label: 'Instant Payments', color: 'blue' },
            { icon: 'gift', label: 'Gift Cards', color: 'purple' },
            { icon: 'phone', label: 'Airtime & Data', color: 'green' },
            { icon: 'document', label: 'Bill Payments', color: 'orange' },
          ].map((item, i) => (
            <div key={i} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 hover:border-amber-300 dark:hover:border-amber-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative space-y-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                  item.color === 'blue' ? 'from-blue-100 to-blue-50 dark:from-blue-950/50 dark:to-blue-900/30' :
                  item.color === 'purple' ? 'from-purple-100 to-purple-50 dark:from-purple-950/50 dark:to-purple-900/30' :
                  item.color === 'green' ? 'from-green-100 to-green-50 dark:from-green-950/50 dark:to-green-900/30' :
                  'from-orange-100 to-orange-50 dark:from-orange-950/50 dark:to-orange-900/30'
                } flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon name={item.icon as any} size={18} strokeWidth={2.2} className={
                    item.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    item.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                    item.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    'text-orange-600 dark:text-orange-400'
                  } />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Security Card */}
        <div className="animate-fade-up rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/50 p-6 space-y-4" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Icon name="shield" size={20} strokeWidth={2.5} className="text-white" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Military-Grade Security</h3>
          </div>
          <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {['Cryptographic proof without exposing private keys', 'Zero personal data collection', '24-hour auto-expiring sessions', 'Server-verified on every operation'].map((text, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Terms Checkbox */}
        <div className="animate-fade-up" style={{ animationDelay: '300ms' }}>
          <label className="group flex items-start gap-3.5 p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 cursor-pointer transition-all duration-200 bg-white dark:bg-gray-800/30 hover:shadow-md hover:shadow-amber-500/5">
            <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 text-amber-600 dark:text-amber-500 focus:ring-2 focus:ring-amber-500/50 dark:focus:ring-amber-400/50 cursor-pointer bg-white dark:bg-gray-700 transition-colors" />
            <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
              I agree to the <button onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline underline-offset-2">Terms</button>
              {' '}and <button onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline underline-offset-2">Privacy Policy</button>
            </span>
          </label>
        </div>
        {/* CTA Button */}
        <div className="animate-fade-up space-y-4" style={{ animationDelay: '400ms' }}>
          <button onClick={handleSignIn} disabled={!agreedToTerms || timeLeft === 0}
            className="group relative w-full flex items-center justify-center gap-3 px-6 py-5 text-lg font-bold rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 dark:from-amber-600 dark:via-amber-500 dark:to-amber-600 text-white hover:from-amber-600 hover:via-amber-700 hover:to-amber-600 dark:hover:from-amber-700 dark:hover:via-amber-600 dark:hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-500 disabled:hover:via-amber-600 disabled:hover:to-amber-500 active:scale-[0.98] transition-all duration-200 shadow-xl shadow-amber-500/30 disabled:shadow-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out" />
            <Icon name="unlock" size={24} strokeWidth={2.5} className="relative z-10" />
            <span className="relative z-10">{timeLeft === 0 ? 'Session Expired' : 'Sign In Securely'}</span>
          </button>
          {wallet.address && (
            <div className="text-center space-y-2 pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-semibold">Connected Wallet</p>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50">{wallet.address}</p>
            </div>
          )}
        </div>
      </div>
      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowTerms(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-5 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Terms and Conditions</h2>
              <button onClick={() => setShowTerms(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Icon name="close" size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-gray-900 dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">1. Acceptance of Terms</h3>
                <p>By signing in and using NimAgent, you agree to be bound by these Terms and Conditions.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">2. Service Description</h3>
                <p>NimAgent is an AI-powered assistant that facilitates cryptocurrency transactions, gift card purchases, airtime top-ups, and bill payments using the Nimiq blockchain.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">3. Wallet Authentication</h3>
                <p>Authentication requires a cryptographic signature from your wallet. Sessions last 24 hours and can be revoked at any time.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">4. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  <li>You are responsible for securing your wallet and private keys</li>
                  <li>You must verify all transaction details before confirming payments</li>
                  <li>You agree not to use the service for illegal activities</li>
                  <li>You understand that blockchain transactions are irreversible</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">5. Third-Party Services</h3>
                <p>Gift cards, airtime, and bill payment services are provided through third-party partners.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">6. Limitation of Liability</h3>
                <p>NimAgent and its operators are not liable for any losses resulting from wallet compromise, transaction errors, network issues, or third-party service failures.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">7. Modifications</h3>
                <p>We reserve the right to modify these terms at any time.</p></section>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-5">
              <button onClick={() => setShowTerms(false)} className="w-full py-3 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-5 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Icon name="close" size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-gray-900 dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">1. Data We Collect</h3>
                <p>We collect minimal data required to provide our services:</p>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  <li>Wallet Address: Your public Nimiq wallet address</li>
                  <li>Transaction Data: Hashes, amounts, timestamps</li>
                  <li>Chat History: AI conversation history</li>
                  <li>Session Data: 24-hour authentication cookies</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">2. Data We Do NOT Collect</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>No private keys or wallet seeds</li>
                  <li>No personal identification</li>
                  <li>No location tracking</li>
                  <li>No third-party analytics</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">3. How We Use Your Data</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Process and fulfill transactions</li>
                  <li>Provide transaction history</li>
                  <li>Maintain chat sessions</li>
                  <li>Prevent fraud</li>
                </ul></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">4. Data Security</h3>
                <p>We implement industry-standard security measures including encrypted HTTPS, secure session cookies, and server-side validation.</p></section>
              <section><h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">5. Your Rights</h3>
                <p>You have the right to access, delete, and revoke authentication at any time.</p></section>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-5">
              <button onClick={() => setShowPrivacy(false)} className="w-full py-3 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
