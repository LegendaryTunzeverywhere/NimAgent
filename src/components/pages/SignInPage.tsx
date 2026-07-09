'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from '@/components/Icon';

export default function SignInPage() {
  const wallet = useAppStore(state => state.wallet);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes countdown
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Countdown timer
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
    <div className="fixed inset-x-0 max-w-2xl mx-auto w-full bg-white dark:bg-background-primary overflow-y-auto scrollbar-hide"
      style={{
        top: '60px',
        bottom: '80px',
        height: 'calc(100dvh - 140px)',
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        
        {/* Header with countdown */}
        <div className="text-center space-y-3 animate-fade-up">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-gold dark:to-gold/80 flex items-center justify-center shadow-xl">
            <Icon name="lock" size={36} strokeWidth={2.2} className="text-white dark:text-background-primary" />
          </div>
          
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Sign In Required
          </h1>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            Secure your session with a cryptographic signature to unlock all NimAgent features
          </p>

          {/* Countdown timer */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/50">
            <Icon name="clock" size={14} strokeWidth={2} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {timeLeft > 0 ? `Sign in within ${formatTime(timeLeft)}` : 'Time expired - reconnect wallet'}
            </span>
          </div>
        </div>

        {/* Features unlock card */}
        <div className="animate-fade-up bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="sparkles" size={16} strokeWidth={2.2} className="text-amber-600 dark:text-amber-400" />
            What You'll Unlock
          </h3>
          
          <div className="space-y-2.5">
            {[
              { icon: 'send', text: 'Send NIM payments instantly' },
              { icon: 'gift', text: 'Purchase gift cards (Amazon, Steam, Netflix, etc.)' },
              { icon: 'phone', text: 'Top up airtime and data bundles' },
              { icon: 'document', text: 'Pay bills (electricity, internet, TV subscriptions)' },
              { icon: 'history', text: 'Access your transaction and order history' },
              { icon: 'chat', text: 'Save and sync your AI chat sessions' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center flex-shrink-0">
                  <Icon name={item.icon as any} size={14} strokeWidth={2.2} className="text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security info */}
        <div className="animate-fade-up bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="shield" size={16} strokeWidth={2.2} className="text-blue-600 dark:text-blue-400" />
            Security & Privacy
          </h3>
          
          <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
              <span>Your wallet signature proves ownership without revealing your private key</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
              <span>No personal data, email, or password required</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
              <span>Session lasts 24 hours, then requires re-authentication</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
              <span>All operations are verified server-side for maximum security</span>
            </li>
          </ul>
        </div>

        {/* Terms and Privacy checkbox */}
        <div className="animate-fade-up">
          <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 cursor-pointer transition-all bg-white dark:bg-gray-800/30">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-amber-600 dark:text-amber-500 focus:ring-amber-500 dark:focus:ring-amber-400 cursor-pointer bg-white dark:bg-gray-700"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
              I agree to the{' '}
              <button
                onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Terms and Conditions
              </button>
              {' '}and{' '}
              <button
                onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Privacy Policy
              </button>
            </span>
          </label>
        </div>

        {/* Sign in button */}
        <div className="animate-fade-up">
          <button
            onClick={handleSignIn}
            disabled={!agreedToTerms || timeLeft === 0}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 text-base font-bold rounded-2xl bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg disabled:shadow-none"
          >
            <Icon name="unlock" size={20} strokeWidth={2.2} />
            {timeLeft === 0 ? 'Session Expired' : 'Sign In Securely'}
          </button>
        </div>

        {/* Wallet info */}
        {wallet.address && (
          <div className="text-center space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
              Connected Wallet
            </p>
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all px-4">
              {wallet.address}
            </p>
          </div>
        )}
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowTerms(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Terms and Conditions</h2>
              <button onClick={() => setShowTerms(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(80vh-80px)] space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-gray-900 dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              
              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">1. Acceptance of Terms</h3>
                <p>By signing in and using NimAgent, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please disconnect your wallet and do not use our services.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">2. Service Description</h3>
                <p>NimAgent is an AI-powered assistant that facilitates cryptocurrency transactions, gift card purchases, airtime top-ups, and bill payments using the Nimiq blockchain. All services are provided "as is" without warranties of any kind.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">3. Wallet Authentication</h3>
                <p>Authentication requires a cryptographic signature from your wallet. This signature proves wallet ownership without exposing your private key. Sessions last 24 hours and can be revoked at any time by disconnecting your wallet.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">4. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>You are responsible for securing your wallet and private keys</li>
                  <li>You must verify all transaction details before confirming payments</li>
                  <li>You agree not to use the service for illegal activities</li>
                  <li>You understand that blockchain transactions are irreversible</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">5. Third-Party Services</h3>
                <p>Gift cards, airtime, and bill payment services are provided through third-party partners. We are not responsible for the availability, quality, or fulfillment of these services beyond facilitating the payment.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">6. Limitation of Liability</h3>
                <p>NimAgent and its operators are not liable for any losses resulting from wallet compromise, transaction errors, network issues, or third-party service failures. Maximum liability is limited to the value of the specific transaction in dispute.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">7. Modifications</h3>
                <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms.</p>
              </section>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button onClick={() => setShowTerms(false)} className="w-full py-2.5 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(80vh-80px)] space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold text-gray-900 dark:text-white">Last Updated: {new Date().toLocaleDateString()}</p>
              
              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">1. Data We Collect</h3>
                <p>We collect minimal data required to provide our services:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Wallet Address:</strong> Your public Nimiq wallet address for transaction processing</li>
                  <li><strong>Transaction Data:</strong> Transaction hashes, amounts, and timestamps for order fulfillment and history</li>
                  <li><strong>Chat History:</strong> Your AI conversation history (stored locally and server-side if authenticated)</li>
                  <li><strong>Session Data:</strong> Temporary authentication session cookies (24-hour expiry)</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">2. Data We Do NOT Collect</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>No private keys or wallet seeds</li>
                  <li>No personal identification (name, email, phone number)</li>
                  <li>No location tracking or device fingerprinting</li>
                  <li>No third-party analytics or advertising trackers</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">3. How We Use Your Data</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Process and fulfill your transactions, orders, and payments</li>
                  <li>Provide transaction history and order tracking</li>
                  <li>Maintain chat session continuity across app reopens</li>
                  <li>Prevent fraud and ensure service security</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">4. Data Sharing</h3>
                <p>We share data only when necessary:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Third-Party Services:</strong> Gift card and bill payment providers receive only the data necessary to fulfill your order (recipient details, amounts)</li>
                  <li><strong>Blockchain:</strong> Transaction data is publicly visible on the Nimiq blockchain</li>
                  <li><strong>Legal Requirements:</strong> We may disclose data if required by law enforcement or legal process</li>
                </ul>
                <p className="mt-2">We never sell your data to third parties.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">5. Data Security</h3>
                <p>We implement industry-standard security measures:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Encrypted HTTPS connections for all communications</li>
                  <li>Secure session cookies with httpOnly and sameSite flags</li>
                  <li>Server-side validation of all wallet-scoped operations</li>
                  <li>Regular security audits and updates</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">6. Data Retention</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Session Cookies:</strong> Automatically deleted after 24 hours or on manual sign-out</li>
                  <li><strong>Transaction History:</strong> Retained indefinitely for your records (visible only to your authenticated wallet)</li>
                  <li><strong>Chat History:</strong> Retained until you manually delete sessions</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">7. Your Rights</h3>
                <p>You have the right to:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Access your data by viewing your transaction and order history</li>
                  <li>Delete your chat sessions at any time</li>
                  <li>Revoke authentication by disconnecting your wallet</li>
                  <li>Request data deletion (contact support with your wallet address)</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">8. Cookies and Local Storage</h3>
                <p>We use:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Session Cookies:</strong> For authentication (essential, cannot be disabled)</li>
                  <li><strong>Local Storage:</strong> For wallet connection state and UI preferences</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">9. Changes to Privacy Policy</h3>
                <p>We may update this policy to reflect service changes. We'll notify users of significant changes by updating the "Last Updated" date. Continued use after changes indicates acceptance.</p>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">10. Contact</h3>
                <p>For privacy-related questions or data deletion requests, please contact support through the app or disconnect your wallet to immediately revoke access.</p>
              </section>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button onClick={() => setShowPrivacy(false)} className="w-full py-2.5 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
