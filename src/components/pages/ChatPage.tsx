'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { chatWithAgent } from '@/lib/api-client';
import ActionCard from '@/components/ActionCard';
import Icon, { type IconName } from '@/components/Icon';
import Modal from '@/components/Modal';

const QUICK_PROMPTS: { label: string; icon: IconName }[] = [
  { label: 'Send NIM', icon: 'send' },
  { label: 'Buy gift card', icon: 'gift-card' },
  { label: 'Top up airtime', icon: 'airtime' },
  { label: 'Pay a bill', icon: 'bill' },
  { label: 'Show my address', icon: 'qr-code' },
];

// All available commands for help modal
const ALL_COMMANDS = [
  { category: 'Send & Receive', commands: [
    'Send 50 NIM to [address]',
    'Send to Mom (saved contact)',
    'Show my address',
    'Scan QR code',
    'Generate QR code',
    'Check my balance',
  ]},
  { category: 'Saved Contacts', commands: [
    'Save [address] as Mom',
    'Send to Coffee Shop',
    'Show my contacts',
    'Rename Mom to Mother',
    'Delete Alice',
    'Who is Mom?',
  ]},
  { category: 'Gift Cards', commands: [
    'Buy Amazon gift card',
    'Get $50 Steam card',
    'Buy iTunes gift card',
    'Netflix gift card $25',
  ]},
  { category: 'Airtime & Data', commands: [
    'Top up +234... with $10',
    'Buy 5GB data bundle',
    'Recharge airtime',
  ]},
  { category: 'Bill Payments', commands: [
    'Pay electricity bill',
    'Pay DSTV subscription',
    'Pay internet bill',
  ]},
  { category: 'Crypto Swap', commands: [
    'Swap NIM to BTC',
    'Convert 100 NIM to Bitcoin',
    'Exchange BTC for NIM',
    'Cash out (swap to BTC)',
  ]},
  { category: 'Staking', commands: [
    'Stake my NIM',
    'Show staking options',
    'Unstake my NIM',
    'Which validator is best?',
  ]},
  { category: 'Buy NIM', commands: [
    'Buy NIM with card',
    'Purchase NIM',
    'Add funds',
  ]},
];

// Conversation starters that teach users what NimHub can do.
const DISCOVER_PROMPTS: { label: string; query: string }[] = [
  { label: 'What can you do?', query: 'What can you help me with on NimHub?' },
  { label: 'Tell me about Nimiq', query: 'Tell me something interesting about Nimiq and NIM.' },
  { label: 'Is it really feeless?', query: 'Are NIM transfers really feeless? How does that work?' },
  { label: 'How do gift cards work?', query: 'How do gift card purchases work on NimHub?' },
];

export default function ChatPage() {
  const { wallet, messages, addMessage, clearMessages, sendMessageToAI, startNewSession, loadOrCreateSession, currentSessionId } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Safety: Global escape hatch for scroll lock issues
  useEffect(() => {
    const unlockScroll = (e: KeyboardEvent) => {
      // Press Ctrl+Shift+U to force unlock scroll (emergency escape)
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        console.log('[Emergency] Forcing scroll unlock');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        // Close all modals as safety measure
        setShowOnboarding(false);
        setShowHelp(false);
        setShowSessions(false);
        setSessionToDelete(null);
      }
    };
    
    document.addEventListener('keydown', unlockScroll);
    return () => document.removeEventListener('keydown', unlockScroll);
  }, []);

  // Check if user is new (first time visiting)
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('nimhub_onboarding_seen');
    if (!hasSeenOnboarding && wallet.connected) {
      setShowOnboarding(true);
    }
  }, [wallet.connected]);

  // Word count tracking — keep in sync with server MAX_MESSAGE_WORDS (200)
  const MAX_WORDS = 200;
  const wordCount = input.trim().split(/\s+/).filter(word => word.length > 0).length;
  const isOverLimit = wordCount > MAX_WORDS;
interface ChatSession {
  sessionId: string;
  lastMessage: string;
  lastActivity: string;
}
const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  // Stable ref so SpeechRecognition onresult always calls the latest sendMessage
  // without the recognition instance being torn down on every input change.
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    // Load chat history from database when component mounts
    if (!hasInitialized && wallet.connected && wallet.address) {
      loadOrCreateSession().then(() => {
        // Get current messages after loading
        const currentMessages = useAppStore.getState().messages;
        
        // If no messages loaded, add welcome message
        if (currentMessages.length === 0) {
          addMessage({
            role: 'ai',
            content: "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code: just ask in plain language. New here? Tap a suggestion below to explore what's possible.",
          });
        }
        setHasInitialized(true);
      });
    } else if (!hasInitialized && !wallet.connected) {
      // Not connected, show welcome message only if no messages exist
      const currentMessages = useAppStore.getState().messages;
      if (currentMessages.length === 0) {
        clearMessages();
        addMessage({
          role: 'ai',
          content: "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and more. Connect your wallet to get started, or ask me anything about NimHub.",
        });
      }
      setHasInitialized(true);
    }
  }, [hasInitialized, wallet.connected, wallet.address, loadOrCreateSession, clearMessages, addMessage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Auto-focus input when AI replies — desktop only.
    // On mobile, focusing the input triggers the virtual keyboard which
    // collapses the viewport and pushes the chat off screen.
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile && messages.length > 0 && messages[messages.length - 1].role === 'ai' && !loading) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setLoading(true);

    try {
      // Short-circuit only for pure, context-free one-word scan requests.
      // Anything with extra detail (e.g. "scan this QR for Mom") goes to the AI
      // so it can follow up in context.
      const lowerMsg = msg.toLowerCase().trim();
      const isPureQrScan = /^(scan|scan qr|scan qr code|scan a qr|qr scan)$/.test(lowerMsg);
      if (isPureQrScan) {
        addMessage({ role: 'user', content: msg });
        addMessage({
          role: 'ai',
          content: 'Ready to scan! Point your camera at a QR code containing a Nimiq address or payment request. 📷',
          action: { type: 'qr-scan' }
        });
        setLoading(false);
        return;
      }

      // All other messages — including swap, exchange, scan-with-context — go through
      // the AI so the conversation history is preserved and followed up correctly.
      await sendMessageToAI(msg, wallet.address || undefined);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMessage, sendMessageToAI, wallet.address]);

  // Keep the stable ref current so SpeechRecognition can always call the latest version.
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Build a fresh SpeechRecognition instance each time.
  // Mobile Chrome (Android) treats instances as single-use: calling start() on an
  // already-ended instance throws InvalidStateError. Recreating on every tap fixes this.
  const startRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = (event.results[0][0].transcript || '').trim();
      if (!transcript) return;
      setInput(transcript);
      setIsListening(false);
      setTimeout(() => { sendMessageRef.current(transcript); }, 100);
    };

    recognition.onerror = (event: any) => {
      console.warn('[Voice] error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        addMessage({
          role: 'ai',
          content: 'Microphone access was denied. Allow microphone permission in your browser/device settings and try again.',
        });
      } else if (event.error === 'network') {
        addMessage({ role: 'ai', content: 'Voice recognition needs a network connection. Check your connection and try again.' });
      }
      // 'no-speech' is common on mobile — reset silently, no message needed.
    };

    recognition.onend = () => { setIsListening(false); };

    recognitionRef.current = recognition;
    return recognition;
  }, [addMessage]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

    if (!SR) {
      addMessage({
        role: 'ai',
        content: 'Voice input is not supported in this browser. Use Chrome on Android/desktop or Safari on iOS.',
      });
      return;
    }

    try {
      const recognition = startRecognition();
      if (!recognition) return;
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('[Voice] start failed:', err?.message);
      setIsListening(false);
    }
  }, [isListening, addMessage, startRecognition]);

  const fetchSessions = async () => {
    if (!wallet.address) return;
    
    setLoadingSessions(true);
    try {
      const { getChatSessions } = await import('@/lib/api-client');
      const fetchedSessions = await getChatSessions(wallet.address);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (!wallet.address) return;
    
    try {
      console.log('[ChatPage] Loading session:', sessionId);
      
      // Prevent re-initialization while loading
      setHasInitialized(true);
      
      const { getChatHistory } = await import('@/lib/api-client');
      const messagesFromDB = await getChatHistory(sessionId, wallet.address);
      
      // Set session ID and messages atomically to prevent race conditions
      useAppStore.setState({ 
        currentSessionId: sessionId,
        messages: messagesFromDB.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          action: msg.action,
          timestamp: new Date(msg.created_at).getTime(),
        }))
      });
      
      console.log('[ChatPage] Loaded', messagesFromDB.length, 'messages from session:', sessionId);
      setShowSessions(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // Open the confirmation modal for a session.
  const requestDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  // Perform the actual deletion after the user confirms in the modal.
  const confirmDeleteSession = async () => {
    const sessionId = sessionToDelete;
    if (!sessionId || !wallet.address) return;

    setDeleting(true);
    try {
      const { deleteChatSession } = await import('@/lib/api-client');
      await deleteChatSession(sessionId, wallet.address);

      // Refresh sessions list
      fetchSessions();

      // If deleted current session, start a fresh one
      if (sessionId === currentSessionId) {
        // Start fresh session (clears messages + new ID)
        startNewSession();
        
        // Wait for store to update
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Add welcome message to new session
        await addMessage({
          role: 'ai',
          content: "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code: just ask in plain language. New here? Tap a suggestion below to explore what's possible.",
        });
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setDeleting(false);
      setSessionToDelete(null);
    }
  };

  return (
    <div
      className="fixed inset-x-0 max-w-2xl mx-auto w-full flex flex-col bg-white dark:bg-background-primary"
      style={{ top: '60px', bottom: '80px', height: 'calc(100dvh - 140px)' }}
    >
      {/* Header with New Chat and History buttons - FIXED */}
      <div className="relative flex items-center justify-between py-3 px-4 border-b border-gray-200 dark:border-white/5 shrink-0 gap-2 bg-white dark:bg-background-primary z-10">
        <h2 className="text-sm font-bold text-gray-700 dark:text-white/80 uppercase tracking-widest flex items-center gap-2 shrink-0">
          <Icon name="robot" size={16} strokeWidth={2} className="text-blue-600 dark:text-brand-blue-light" />
          <span className="hidden sm:inline">AI Chat</span>
          <span className="sm:hidden">Chat</span>
        </h2>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-end">
          <button
            onClick={() => {
              if (showSessions) {
                setShowSessions(false);
              } else {
                fetchSessions();
                setShowSessions(true);
              }
            }}
            disabled={!wallet.connected}
            className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1.5 font-semibold bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-white/70 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="history" size={13} strokeWidth={2.2} className="flex-shrink-0" /> 
            <span>History</span>
          </button>
          <button
            onClick={async () => {
              console.log('[New Chat] Starting new chat session');
              
              // Close sessions dropdown first
              setShowSessions(false);
              
              // Get current message count for debugging
              console.log('[New Chat] Messages before clear:', useAppStore.getState().messages.length);
              
              // Start new session (clears messages and sets new ID atomically)
              startNewSession();
              
              // Immediately verify messages are cleared
              const messagesAfterClear = useAppStore.getState().messages;
              console.log('[New Chat] Messages after startNewSession:', messagesAfterClear.length);
              
              // If messages weren't cleared, force clear them
              if (messagesAfterClear.length > 0) {
                console.warn('[New Chat] Messages not cleared, forcing clear');
                clearMessages();
              }
              
              // Add welcome message to the fresh session
              await addMessage({
                role: 'ai',
                content: "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code: just ask in plain language. New here? Tap a suggestion below to explore what's possible.",
              });
              
              // Final verification
              const finalMessageCount = useAppStore.getState().messages.length;
              console.log('[New Chat] Final message count (should be 1):', finalMessageCount);
            }}
            className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1.5 font-semibold bg-amber-50 dark:bg-gold/10 text-amber-600 dark:text-gold border border-amber-200 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/20 transition-all"
          >
            <Icon name="plus" size={13} strokeWidth={2.5} className="flex-shrink-0" /> 
            <span>New</span>
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 text-xs rounded-full px-2.5 sm:px-3 py-1.5 font-semibold bg-blue-50 dark:bg-brand-blue/10 text-blue-600 dark:text-brand-blue-light border border-blue-200 dark:border-brand-blue/20 hover:bg-blue-100 dark:hover:bg-brand-blue/20 transition-all"
          >
            <Icon name="info" size={13} strokeWidth={2.5} className="flex-shrink-0" /> 
            <span>Commands</span>
          </button>
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-1.5 text-xs rounded-full px-2.5 sm:px-3 py-1.5 font-semibold bg-amber-50 dark:bg-gold/10 text-amber-600 dark:text-gold border border-amber-200 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/20 transition-all"
          >
            <Icon name="sparkles" size={13} strokeWidth={2.5} className="flex-shrink-0" /> 
            <span>Guide</span>
          </button>
        </div>
      </div>

      {/* Sessions Dropdown - FIXED */}
      {showSessions && (
        <div className="mx-4 mt-3 bg-white dark:bg-[#1a1b23] border-2 border-gray-200 dark:border-white/10 rounded-2xl p-4 max-h-64 overflow-y-auto animate-fade-up shrink-0 z-20 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white/80">Chat Sessions</h3>
            <button
              onClick={() => setShowSessions(false)}
              className="text-gray-600 dark:text-white/40 hover:text-gray-900 dark:hover:text-white/70 transition-colors"
              aria-label="Close sessions"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          
          {loadingSessions ? (
            <div className="text-center py-4">
              <div className="w-7 h-7 mx-auto mb-2 border-2 border-gray-300 dark:border-amber-200 dark:border-gold/30 border-t-gray-600 dark:border-t-amber-600 dark:border-t-gold rounded-full animate-spin" />
              <p className="text-xs text-gray-600 dark:text-white/40">Loading sessions...</p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  onClick={() => loadSession(session.sessionId)}
                  className={`p-3 rounded-xl cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-white/5 ${
                    session.sessionId === currentSessionId 
                      ? 'bg-amber-100 dark:bg-gold/10 border-2 border-amber-300 dark:border-gold/20' 
                      : 'bg-gray-50 dark:bg-white/[0.02] border-2 border-gray-200 dark:border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white/70 truncate">{session.lastMessage}</p>
                      <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                        {new Date(session.lastActivity).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => requestDeleteSession(session.sessionId, e)}
                      className="text-red-500 dark:text-error/50 hover:text-red-700 dark:hover:text-error transition-colors flex-shrink-0 p-1"
                      title="Delete session"
                    >
                      <Icon name="delete" size={15} strokeWidth={2} />
                    </button>
                  </div>
                  {session.sessionId === currentSessionId && (
                    <p className="text-xs text-amber-700 dark:text-gold mt-2 flex items-center gap-1 font-semibold">
                      <Icon name="check" size={11} strokeWidth={3} /> Current session
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-700 dark:text-white/40">No previous sessions</p>
              <p className="text-xs text-gray-500 dark:text-white/30 mt-1">Start chatting to create a session</p>
            </div>
          )}
        </div>
      )}

      {/* Messages - SCROLLABLE ONLY */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 py-5 px-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 animate-fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 bg-blue-100 dark:bg-brand-blue/15 border border-blue-200 dark:border-brand-blue/30 text-blue-700 dark:text-brand-blue-light">
                <Icon name="robot" size={15} strokeWidth={2} />
              </div>
            )}
            <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-600 dark:bg-gold text-white font-semibold'
                    : 'glass text-gray-900 dark:text-white/85'
                }`}
              >
                {/* Format message content - detect and format transaction hashes */}
                {msg.content.split('\n').map((line, idx) => {
                  // Check if line contains transaction hash
                  const txHashMatch = line.match(/Transaction Hash[:\s]+([a-f0-9]{64})/i);
                  const explorerMatch = line.match(/(https?:\/\/[^\s]+)/);
                  
                  if (txHashMatch) {
                    const txHash = txHashMatch[1];
                    const network = process.env.NEXT_PUBLIC_NIMIQ_NETWORK || 'testnet';
                    const baseUrl = network === 'mainnet' 
                      ? 'https://nimiq.watch/#' 
                      : 'https://test.nimiq.watch/#';
                    
                    return (
                      <div key={idx} className="mt-2 space-y-2">
                        <p className="text-xs text-white/60">Transaction Hash:</p>
                        <div 
                          onClick={() => {
                            navigator.clipboard.writeText(txHash);
                            // You could add a toast notification here
                          }}
                          className="bg-black/30 rounded-lg p-2 font-mono text-[10px] leading-relaxed break-all border border-white/5 cursor-pointer hover:bg-black/40 transition-colors group"
                          title="Click to copy"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex-1">{txHash.slice(0, 8)}...{txHash.slice(-8)}</span>
                            <Icon name="copy" size={12} strokeWidth={2} className="opacity-50 group-hover:opacity-100" />
                          </div>
                        </div>
                        <a
                          href={`${baseUrl}${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright transition-colors"
                        >
                          <Icon name="explorer" size={13} strokeWidth={2} />
                          <span className="underline">View on Explorer</span>
                        </a>
                      </div>
                    );
                  } else if (explorerMatch) {
                    // Security: only auto-link known, trusted Nimiq explorer domains.
                    // Anything else is shown as plain text to prevent phishing links.
                    const url = explorerMatch[1];
                    let safeHost = '';
                    try { safeHost = new URL(url).hostname.toLowerCase(); } catch {}
                    const TRUSTED = ['nimiq.watch', 'test.nimiq.watch'];
                    const isTrusted = TRUSTED.some(h => safeHost === h || safeHost.endsWith('.' + h));

                    if (!isTrusted) {
                      return <p key={idx} className="break-all">{line}</p>;
                    }
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-gold hover:text-amber-700 dark:hover:text-gold-bright transition-colors mt-2"
                      >
                        <Icon name="explorer" size={13} strokeWidth={2} />
                        <span className="underline">View on Explorer</span>
                      </a>
                    );
                  } else if (line.includes('View on explorer:')) {
                    // Skip the "View on explorer:" label line
                    return null;
                  } else if (line.trim()) {
                    return <p key={idx}>{line}</p>;
                  }
                  return null;
                })}
              </div>
              
              {/* Message Action Buttons */}
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Copy message */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content);
                    // Optional: show toast notification
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  title="Copy message"
                >
                  <Icon name="copy" size={10} strokeWidth={2} />
                  Copy
                </button>
                
                {/* Reply with context (AI messages only) */}
                {msg.role === 'ai' && (
                  <button
                    onClick={() => {
                      // Quote the relevant part of the AI's message as context
                      // so the follow-up feels natural to the AI
                      const snippet = msg.content.slice(0, 80).replace(/\n/g, ' ').trim();
                      const suffix = msg.content.length > 80 ? '...' : '';
                      setInput(`Re: "${snippet}${suffix}" — `);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    title="Reply with context"
                  >
                    <Icon name="chevron-right" size={10} strokeWidth={2} />
                    Reply
                  </button>
                )}
                
                {/* Reload (regenerate) - User messages only */}
                {msg.role === 'user' && i === messages.length - 1 && !loading && (
                  <button
                    onClick={() => {
                      // Resend the last user message to regenerate AI response
                      sendMessage(msg.content);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-blue-50 dark:bg-brand-blue/10 text-blue-600 dark:text-brand-blue-light hover:bg-blue-100 dark:hover:bg-brand-blue/20 transition-colors"
                    title="Resend message"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6" />
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                      <path d="M3 22v-6h6" />
                      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                    Reload
                  </button>
                )}
              </div>
              
              {msg.action && msg.role === 'ai' && (
                <ActionCard action={msg.action} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-3 animate-fade-up">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-brand-blue/15 border border-blue-200 dark:border-brand-blue/30 text-blue-700 dark:text-brand-blue-light animate-breathe">
              <span className="animate-bob inline-flex">
                <Icon name="robot" size={15} strokeWidth={2} />
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-brand-blue-light inline-block dot-typing-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-brand-blue-light inline-block dot-typing-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-brand-blue-light inline-block dot-typing-3" />
              </span>
              <span className="text-[11px] text-gray-500 dark:text-white/45 font-medium">
                {messages.length > 1 ?  'Thinking...' : 'Following up...'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom Input Area - FIXED above bottom nav */}
      <div className="shrink-0 pt-3 pb-safe px-4 bg-white dark:bg-background-primary border-t border-gray-200 dark:border-white/5 z-10" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {/* Discover prompts - teach users about NimHub. Shown early in a chat. */}
        {messages.length <= 3 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:text-brand-blue-light whitespace-nowrap self-center">
              <Icon name="sparkles" size={11} strokeWidth={2} />
              Discover
            </span>
            {DISCOVER_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => sendMessage(prompt.query)}
                disabled={loading}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors bg-blue-50 dark:bg-brand-blue/10 text-blue-700 dark:text-brand-blue-light border border-blue-200 dark:border-brand-blue/25 hover:bg-blue-100 dark:hover:bg-brand-blue/20 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick action prompts */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              onClick={() => sendMessage(prompt.label)}
              disabled={loading}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors bg-amber-50 dark:bg-gold/10 text-amber-600 dark:text-gold border border-amber-200 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/20 disabled:opacity-50"
            >
              <Icon name={prompt.icon} size={12} strokeWidth={2} />
              {prompt.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 glass">
            <button
              onClick={toggleVoiceInput}
              disabled={loading}
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                isListening 
                  ? 'bg-error text-white animate-pulse' 
                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/70'
              }`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <Icon name="mic" size={17} strokeWidth={2} />
              )}
            </button>
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 outline-none"
              placeholder="Ask me ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isOverLimit && sendMessage()}
              disabled={loading || isListening}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || isOverLimit}
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
                input.trim() && !loading && !isOverLimit
                  ? 'bg-amber-600 dark:bg-gold text-white dark:text-background-primary'
                  : 'bg-gray-100 dark:bg-white/[0.07] text-gray-300 dark:text-white/25'
              }`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Word counter - only show when user is typing */}
          {input.trim().length > 0 && (
            <div className="flex items-center justify-end gap-2 px-2">
              <span className={`text-[10px] font-mono transition-colors ${
                isOverLimit 
                  ? 'text-error font-semibold animate-pulse' 
                  : wordCount > MAX_WORDS * 0.8
                  ? 'text-warning'
                  : 'text-gray-400 dark:text-white/40'
              }`}>
                {wordCount}/{MAX_WORDS} words
              </span>
              {isOverLimit && (
                <span className="text-[10px] text-error">
                  • Too long
                </span>
              )}
            </div>
          )}
        </div>

        {!wallet.connected && (
          <p className="text-xs text-gray-500 dark:text-white/45 text-center mt-3 flex items-center justify-center gap-1.5">
            <Icon name="wallet" size={12} strokeWidth={2} className="text-amber-600 dark:text-gold" />
            Connect your wallet for full AI functionality
          </p>
        )}

        {isListening && (
          <p className="text-xs text-error text-center mt-3 animate-pulse flex items-center justify-center gap-1.5">
            <Icon name="mic" size={12} strokeWidth={2.2} /> Listening... Speak now
          </p>
        )}

        <p className="text-[9px] text-center text-gray-400 dark:text-white/30 mt-2 pb-1">
          Independent Project · Not affiliated with Nimiq Foundation
        </p>
      </div>

      {/* Delete session confirmation */}
      <Modal
        open={!!sessionToDelete}
        onClose={() => !deleting && setSessionToDelete(null)}
        title="Delete this chat?"
        subtitle="This conversation will be permanently removed."
        footer={
          <>
            <button
              onClick={() => setSessionToDelete(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteSession}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 dark:bg-error/90 text-white hover:bg-red-600 dark:hover:bg-error transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {deleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Icon name="delete" size={14} strokeWidth={2.2} /> Delete
                </>
              )}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center flex-shrink-0">
            <Icon name="delete" size={18} strokeWidth={2} />
          </span>
          <p className="text-sm text-white/70 leading-relaxed">
            This action is permanent. All messages in this session will be deleted.
          </p>
        </div>
      </Modal>

      {/* Help Modal - All Commands */}
      <Modal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title="Available Commands"
        subtitle="Just talk naturally - these are examples of what I can do"
      >
        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide space-y-4" id="commands-scroll-container">
          {ALL_COMMANDS.map((section) => (
            <div key={section.category} className="space-y-2">
              <h3 className="text-sm font-bold text-amber-600 dark:text-gold flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-600 dark:bg-gold rounded-full"></span>
                {section.category}
              </h3>
              <div className="space-y-1.5 pl-3">
                {section.commands.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => {
                      setShowHelp(false);
                      setInput(cmd);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-gray-700 dark:text-white/70 bg-gray-50 dark:bg-white/[0.02] hover:bg-amber-50 dark:hover:bg-gold/10 hover:text-amber-600 dark:hover:text-gold border border-transparent hover:border-amber-200 dark:hover:border-gold/20 transition-all"
                  >
                    "{cmd}"
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Tips */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-brand-blue/10 border border-blue-200 dark:border-brand-blue/20">
            <h4 className="text-sm font-bold text-blue-700 dark:text-brand-blue-light mb-2 flex items-center gap-2">
              <Icon name="info" size={14} strokeWidth={2.5} />
              Pro Tips
            </h4>
            <ul className="space-y-1.5 text-xs text-blue-600 dark:text-brand-blue-light/80">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 dark:text-brand-blue/60 mt-0.5">•</span>
                <span>Save addresses as contacts to send easier: "Save NQ18... as Mom"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 dark:text-brand-blue/60 mt-0.5">•</span>
                <span>Use voice input by clicking the microphone button</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 dark:text-brand-blue/60 mt-0.5">•</span>
                <span>Scan QR codes to quickly get wallet addresses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 dark:text-brand-blue/60 mt-0.5">•</span>
                <span>Keep messages under 200 words for best results</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Scroll Down Indicator - Floating Button */}
        <button
          onClick={() => {
            const container = document.getElementById('commands-scroll-container');
            if (container) {
              container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
          }}
          className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-brand-blue to-brand-blue-light text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all z-20 flex items-center justify-center group animate-bounce"
          aria-label="Scroll to bottom"
        >
          <Icon name="chevron-down" size={20} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
        </button>
      </Modal>

      {/* Onboarding/Welcome Guide Modal */}
      <Modal
        open={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          localStorage.setItem('nimhub_onboarding_seen', 'true');
        }}
        title="Welcome to NimHub AI!"
        subtitle="Your intelligent crypto assistant"
      >
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide space-y-6 relative" id="onboarding-scroll-container">
          {/* What is NimHub */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-gold to-gold-bright flex items-center justify-center flex-shrink-0">
                <Icon name="robot" size={20} strokeWidth={2.2} className="text-white" />
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">AI-Powered Crypto Wallet</h3>
                <p className="text-sm text-gray-600 dark:text-white/75 leading-relaxed">
                  Chat naturally with AI to manage your crypto. No complex menus or confusing interfaces — just tell me what you want to do.
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-600 dark:text-gold flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-600 dark:bg-gold rounded-full"></span>
              What I Can Do For You
            </h4>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10">
                <Icon name="send" size={18} strokeWidth={2} className="text-blue-600 dark:text-brand-blue-light flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Send &amp; Receive NIM</p>
                  <p className="text-xs text-gray-600 dark:text-white/65 mt-0.5">Instant, feeless transfers worldwide</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10">
                <Icon name="gift-card" size={18} strokeWidth={2} className="text-amber-600 dark:text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Buy Gift Cards</p>
                  <p className="text-xs text-gray-600 dark:text-white/65 mt-0.5">Amazon, Steam, iTunes, Netflix &amp; more</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10">
                <Icon name="airtime" size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Mobile Top-ups</p>
                  <p className="text-xs text-gray-600 dark:text-white/65 mt-0.5">Airtime &amp; data bundles globally</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10">
                <Icon name="bill" size={18} strokeWidth={2} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Pay Bills</p>
                  <p className="text-xs text-gray-600 dark:text-white/65 mt-0.5">Electricity, internet, TV subscriptions</p>
                </div>
              </div>
            </div>
          </div>

          {/* How to Use */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-blue-600 dark:text-brand-blue-light flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-600 dark:bg-brand-blue-light rounded-full"></span>
              How to Use the AI
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-brand-blue/20 text-blue-700 dark:text-brand-blue-light flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">
                  <strong className="text-gray-900 dark:text-white">Type naturally:</strong> "Send 50 NIM to Mom" or "Buy a $25 Amazon card"
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-brand-blue/20 text-blue-700 dark:text-brand-blue-light flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">
                  <strong className="text-gray-900 dark:text-white">Use quick prompts:</strong> Tap the suggestion buttons below the chat
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-brand-blue/20 text-blue-700 dark:text-brand-blue-light flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">
                  <strong className="text-gray-900 dark:text-white">Voice input:</strong> Tap the microphone button and speak
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-brand-blue/20 text-blue-700 dark:text-brand-blue-light flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed">
                  <strong className="text-gray-900 dark:text-white">Save contacts:</strong> "Save [address] as Mom" for quick sends later
                </p>
              </div>
            </div>
          </div>

          {/* Example Conversations */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-600 dark:text-gold flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-600 dark:bg-gold rounded-full"></span>
              Try These Examples
            </h4>
            <div className="space-y-2">
              {[
                { q: '"Send 100 NIM to my friend"', a: "I'll guide you through sending NIM" },
                { q: '"Buy a $50 Steam gift card"', a: "I'll help you purchase it with crypto" },
                { q: '"Top up +234... with $10"',   a: "I'll send airtime to that number" },
                { q: '"What\'s my balance?"',        a: "I'll show your NIM balance and value" },
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setShowOnboarding(false);
                    localStorage.setItem('nimhub_onboarding_seen', 'true');
                    setInput(example.q.replace(/['"]/g, ''));
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-amber-50 dark:bg-gold/8 border border-amber-200 dark:border-gold/25 hover:bg-amber-100 dark:hover:bg-gold/15 transition-all group"
                >
                  <p className="text-sm font-semibold text-amber-700 dark:text-gold mb-1 group-hover:text-amber-800 dark:group-hover:text-gold-bright">
                    {example.q}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-white/65">
                    → {example.a}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Security & Trust */}
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/25">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Icon name="check" size={16} strokeWidth={2.5} className="text-green-700 dark:text-green-400" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-green-800 dark:text-green-300 mb-1">Secure &amp; Transparent</h4>
                <p className="text-xs text-green-700 dark:text-green-200/80 leading-relaxed">
                  Your wallet stays in your control. All transactions are verified on the Nimiq blockchain. AI cannot access your funds without your approval.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowOnboarding(false);
                setShowHelp(true);
              }}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white border border-gray-200 dark:border-white/15 hover:bg-gray-200 dark:hover:bg-white/15 transition-colors"
            >
              View All Commands
            </button>
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem('nimhub_onboarding_seen', 'true');
                setInput('What can you do?');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-amber-500 dark:bg-gold text-white dark:text-background-primary hover:bg-amber-600 dark:hover:bg-gold-bright transition-colors shadow-lg shadow-amber-500/25"
            >
              Start Chatting →
            </button>
          </div>
        </div>

        {/* Scroll Down Indicator */}
        <button
          onClick={() => {
            const container = document.getElementById('onboarding-scroll-container');
            if (container) {
              container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
          }}
          className="absolute bottom-20 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 dark:from-gold to-gold-bright text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-110 active:scale-95 transition-all z-20 flex items-center justify-center group animate-bounce"
          aria-label="Scroll to bottom"
        >
          <Icon name="chevron-down" size={20} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
        </button>
      </Modal>
    </div>
  );
}