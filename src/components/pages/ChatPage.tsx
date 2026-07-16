'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import ActionCard from '@/components/ActionCard';
import Icon, { type IconName } from '@/components/Icon';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import { openExternalUrl } from '@/lib/external-links';

// ─── Static data ──────────────────────────────────────────────────────────────

const ALL_COMMANDS = [
  { category: 'Quick Start', commands: [
    'What can you help me with?',
    'Tell me about Nimiq',
    'How do gift cards work?',
    'Send NIM',
    'Buy gift card',
    'Top up airtime',
    'Pay a bill',
  ]},
  { category: 'Send & Receive', commands: ['Send 50 NIM to [address]','Send to Mom (saved contact)','Show my address','Scan QR code','Check my balance','Request 50 NIM payment'] },
  { category: 'Saved Contacts', commands: ['Save [address] as Mom','Send to Coffee Shop','Show my contacts','Rename Mom to Mother','Delete Alice'] },
  { category: 'Gift Cards',     commands: ['Buy Amazon gift card','Get $50 Steam card','Netflix gift card $25'] },
  { category: 'Airtime & Data', commands: ['Top up +234... with $10','Buy 5GB data bundle'] },
  { category: 'Bill Payments',  commands: ['Pay electricity bill','Pay DSTV subscription','Pay internet bill'] },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ChatSession { sessionId: string; lastMessage: string; lastActivity: string; }

export default function ChatPage() {
  const {
    wallet, messages, addMessage, clearMessages,
    sendMessageToAI, startNewSession, loadOrCreateSession, currentSessionId,
    aiLoading, aiStatus,
  } = useAppStore();

  const [input,           setInput]           = useState('');
  const [isListening,     setIsListening]     = useState(false);
  const [hasInitialized,  setHasInitialized]  = useState(false);
  const [showSessions,    setShowSessions]    = useState(false);
  const [showHelp,        setShowHelp]        = useState(false);
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [keyboardOpen,    setKeyboardOpen]    = useState(false);
  const [showScrollBtn,   setShowScrollBtn]   = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [copiedTxHash, setCopiedTxHash] = useState<string | null>(null);
  const [voiceUnavailableReason, setVoiceUnavailableReason] = useState<string | null>(null);

  // Sessions
  const [sessions,        setSessions]        = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  const chatEndRef    = useRef<HTMLDivElement>(null);
  const messagesRef   = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});

  // Word count
  const MAX_WORDS  = 200;
  const wordCount  = input.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > MAX_WORDS;
  
  // DEBUG: State for showing debug panel
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // ── Keyboard detection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const THRESHOLD = 0.75;
    const handle = () => {
      setKeyboardOpen((window.visualViewport!.height / window.innerHeight) < THRESHOLD);
    };
    window.visualViewport.addEventListener('resize', handle);
    return () => window.visualViewport!.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const insideNimiqPay = !!window.nimiqPay;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!window.isSecureContext) {
      // In Nimiq Pay, even if not flagged as secure context, SpeechRecognition might work
      if (insideNimiqPay && SR) {
        // Try it anyway - Nimiq Pay WebView might support it
        setVoiceUnavailableReason(null);
        return;
      }
      setVoiceUnavailableReason(
        insideNimiqPay
          ? 'Voice input is not available in this Nimiq Pay session. Type your message instead.'
          : 'Voice input requires a secure connection.'
      );
      return;
    }

    if (!SR) {
      setVoiceUnavailableReason(
        insideNimiqPay
          ? 'Voice input is not available in this Nimiq Pay environment yet. Type your message instead.'
          : 'Voice input is not supported on this device.'
      );
      return;
    }

    setVoiceUnavailableReason(null);
  }, []);

  // ── Scroll-to-bottom detection ──────────────────────────────────────────────
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const handle = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, []);

  // ── Escape hatch ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        setShowOnboarding(false); setShowHelp(false);
        setShowSessions(false);   setSessionToDelete(null);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  // ── Onboarding ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('nimagent_onboarding_seen') && wallet.connected) {
      setShowOnboarding(true);
    }
  }, [wallet.connected]);

  // ── Session init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const WELCOME_CONNECTED    = "Hi, I'm your NimAgent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code: just ask in plain language. New here? Tap a suggestion below to explore what's possible.";
    const WELCOME_DISCONNECTED = "Hi, I'm your NimAgent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and more. Connect your wallet to get started, or ask me anything about NimAgent.";

    if (!hasInitialized && wallet.connected && wallet.address) {
      loadOrCreateSession().then(() => {
        if (useAppStore.getState().messages.length === 0) {
          addMessage({ role: 'ai', content: WELCOME_CONNECTED });
        }
        setHasInitialized(true);
      });
    } else if (!hasInitialized && !wallet.connected) {
      if (useAppStore.getState().messages.length === 0) {
        clearMessages();
        addMessage({ role: 'ai', content: WELCOME_DISCONNECTED });
      }
      setHasInitialized(true);
    }
  }, [hasInitialized, wallet.connected, wallet.address, loadOrCreateSession, clearMessages, addMessage]);

  // ── Handle app resume ───────────────────────────────────────────────────────
  // When returning from background, ensure chat state is fresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wallet.connected && hasInitialized) {
        console.log('[Chat] App resumed - refreshing chat state');
        // Scroll to bottom to show latest messages
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wallet.connected, hasInitialized]);

  // ── Scroll + desktop autofocus ──────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile && messages.length > 0 && messages[messages.length - 1].role === 'ai' && !aiLoading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, aiLoading]);

  // ─── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || aiLoading) return;
    setInput('');
    try {
      const lower = msg.toLowerCase().trim();
      console.log('[ChatPage] Message received:', msg, '| lowercase:', lower);
      
      // DEBUG: EVM diagnostic trigger (temporary - remove after testing)
      if (lower === 'debug evm') {
        console.log('[ChatPage] Debug EVM trigger activated');
        const report = {
          hasEthereum: typeof window.ethereum !== 'undefined',
          hasNimiqPay: typeof window.nimiqPay !== 'undefined',
          ethereumKeys: typeof window.ethereum !== 'undefined' ? Object.keys(window.ethereum).slice(0, 10) : [],
          isMetaMask: (window.ethereum as any)?.isMetaMask ?? null,
          ethereumIsConnected: typeof window.ethereum !== 'undefined' ? (window.ethereum as any)?.isConnected?.() ?? null : null,
          nimiqPayKeys: typeof window.nimiqPay !== 'undefined' ? Object.keys(window.nimiqPay).slice(0, 10) : [],
        };
        addMessage({
          role: 'ai',
          content: `🔍 **EVM Debug Report**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n${report.hasEthereum ? '✅ window.ethereum exists' : '❌ window.ethereum NOT found'}\n${report.hasNimiqPay ? '✅ window.nimiqPay exists' : '❌ window.nimiqPay NOT found'}`,
        });
        return;
      }
      
      // DEBUG: EVM connection test (temporary - remove after testing)
      if (lower === 'debug evm connect') {
        console.log('[ChatPage] Debug EVM Connect trigger activated');
        const report: any = { step: 'starting', startTime: Date.now() };
        
        if (typeof (window as any).ethereum === 'undefined') {
          addMessage({
            role: 'ai',
            content: `❌ **Cannot test connection**\n\nwindow.ethereum does not exist. Run "debug evm" first to check availability.`,
          });
          return;
        }
        
        try {
          report.step = 'calling eth_requestAccounts';
          const accountsPromise = (window as any).ethereum.request({ method: 'eth_requestAccounts' });
          
          // Race against a timeout so we know if it's hanging vs actually failing
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT after 10s - request never resolved or rejected')), 10000)
          );
          
          const accounts = await Promise.race([accountsPromise, timeoutPromise]);
          report.step = 'success';
          report.accounts = accounts;
          report.accountCount = (accounts as any)?.length ?? 0;
          report.firstAccount = (accounts as any)?.[0] ?? null;
          report.elapsedMs = Date.now() - report.startTime;
        } catch (err: any) {
          report.step = 'failed';
          report.errorMessage = err?.message;
          report.errorCode = err?.code;
          report.errorName = err?.name;
          report.elapsedMs = Date.now() - report.startTime;
        }
        
        addMessage({
          role: 'ai',
          content: `🔍 **EVM Connection Test**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n${
            report.step === 'success' 
              ? `✅ Connected successfully in ${report.elapsedMs}ms\nAccount: ${report.firstAccount}` 
              : report.errorMessage?.includes('TIMEOUT')
                ? `⏱️ **TIMEOUT** - Request hung for 10 seconds\nThis is likely a Nimiq Pay provider bridge issue.`
                : `❌ Failed: ${report.errorMessage}\nCode: ${report.errorCode}`
          }`,
        });
        return;
      }
      
      if (/^(scan|scan qr|scan qr code|scan a qr|qr scan)$/.test(lower)) {
        addMessage({ role: 'user', content: msg });
        addMessage({ role: 'ai', content: 'Ready to scan! Point your camera at a QR code.', action: { type: 'qr-scan' } });
        return;
      }
      await sendMessageToAI(msg, wallet.address || undefined);
    } catch (e) { /* Silent failure */ }
  }, [input, aiLoading, addMessage, sendMessageToAI, wallet.address]);

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // ── Voice ───────────────────────────────────────────────────────────────────
  const lastErrorRef = useRef<string | null>(null);
  
  const startRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'; r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const t = (e.results[0][0].transcript || '').trim();
      if (!t) return;
      setInput(t); setIsListening(false);
      lastErrorRef.current = null; // Clear error state on success
      setTimeout(() => sendMessageRef.current(t), 100);
    };
    r.onerror = (e: any) => {
      setIsListening(false);
      const errorType = e.error;
      
      // Prevent duplicate error messages
      if (lastErrorRef.current === errorType) {
        return;
      }
      lastErrorRef.current = errorType;
      
      const insideNimiqPay = typeof window !== 'undefined' && !!window.nimiqPay;
      
      if (errorType === 'not-allowed' || errorType === 'permission-denied') {
        addMessage({ 
          role: 'ai', 
          content: insideNimiqPay
            ? "Voice input isn't currently available inside the Nimiq Pay app — please type your message instead."
            : 'Microphone access denied. Allow it in your browser settings and try again.'
        });
      } else if (errorType === 'network') {
        addMessage({ role: 'ai', content: 'Voice recognition needs a network connection.' });
      } else if (errorType === 'no-speech') {
        // Silent - user didn't speak, don't show error
        lastErrorRef.current = null;
      } else {
        // Other errors
        console.error('[Voice] Recognition error:', errorType);
      }
    };
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    return r;
  }, [addMessage]);

  const toggleVoice = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    if (!SR) {
      addMessage({ role: 'ai', content: 'Voice input not supported. Use Chrome on Android/desktop or Safari on iOS.' });
      return;
    }
    try {
      const r = startRecognition();
      if (!r) return;
      
      // Clear previous error state when user tries again
      lastErrorRef.current = null;
      
      r.start(); 
      setIsListening(true);
    } catch (e: any) { 
      setIsListening(false);
      // Only show error if it's not a duplicate
      if (lastErrorRef.current !== 'start-error') {
        lastErrorRef.current = 'start-error';
        const insideNimiqPay = typeof window !== 'undefined' && !!window.nimiqPay;
        addMessage({ 
          role: 'ai', 
          content: insideNimiqPay
            ? "Voice input isn't currently available inside the Nimiq Pay app — please type your message instead."
            : 'Could not start voice input. Please check microphone permissions in your device settings.'
        });
      }
    }
  }, [isListening, addMessage, startRecognition]);

  // ── Sessions ────────────────────────────────────────────────────────────────
  const fetchSessions = async () => {
    if (!wallet.address) return;
    setLoadingSessions(true);
    try {
      const { getChatSessions } = await import('@/lib/api-client');
      setSessions(await getChatSessions(wallet.address, { requireWalletSession: false }));
    } catch (error) {}
    finally { setLoadingSessions(false); }
  };

  const loadSession = async (id: string) => {
    if (!wallet.address) return;
    setHasInitialized(true);
    try {
      const { getChatHistory } = await import('@/lib/api-client');
      const msgs = await getChatHistory(id, wallet.address, { requireWalletSession: false });
      useAppStore.setState({
        currentSessionId: id,
        messages: msgs.map((m: any) => ({ role: m.role, content: m.content, action: m.action, timestamp: new Date(m.created_at).getTime() })),
      });
      setShowSessions(false);
    } catch (error) {}
  };

  const confirmDelete = async () => {
    if (!sessionToDelete || !wallet.address) return;
    setDeleting(true);
    try {
      const { deleteChatSession } = await import('@/lib/api-client');
      await deleteChatSession(sessionToDelete, wallet.address);
      fetchSessions();
      if (sessionToDelete === currentSessionId) {
        startNewSession();
        await new Promise(r => setTimeout(r, 50));
        await addMessage({ role: 'ai', content: "Hi, I'm your NimAgent. Just ask in plain language what you'd me like to do." });
      }
    } catch { /* silent */ }
    finally { setDeleting(false); setSessionToDelete(null); }
  };

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-x-0 max-w-2xl mx-auto w-full flex flex-col bg-white dark:bg-[#0F1219]"
      style={{
        top: '60px',
        bottom: keyboardOpen ? '0px' : '80px',
        height: keyboardOpen ? 'calc(100dvh - 60px)' : 'calc(100dvh - 140px)',
      }}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#1F2348]/10 dark:border-white/10 bg-white dark:bg-[#0F1219] z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 dark:bg-brand-blue flex items-center justify-center">
            <Icon name="robot" size={14} strokeWidth={2.2} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[#1F2348] dark:text-white tracking-tight">AI Chat</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History / New */}
          <div className="flex items-center rounded-full border border-[#1F2348]/20 dark:border-white/20 overflow-hidden bg-white/80 dark:bg-white/[0.08]">
            <button
              onClick={() => { showSessions ? setShowSessions(false) : (fetchSessions(), setShowSessions(true)); }}
              disabled={!wallet.connected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#1F2348] dark:text-white/75 hover:bg-[#1F2348]/[0.05] dark:hover:bg-white/[0.15] hover:text-[#1F2348] dark:hover:text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Icon name="history" size={12} strokeWidth={2.2} />
              <span className="hidden sm:inline">History</span>
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-white/20" />
            <button
              onClick={async () => {
                setShowSessions(false);
                startNewSession();
                if (useAppStore.getState().messages.length > 0) clearMessages();
                await addMessage({ role: 'ai', content: "Hi, I'm your NimAgent. Just ask in plain language what you'd like to do." });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1F2348] dark:text-white/75 hover:bg-[#1F2348]/[0.05] dark:hover:bg-white/[0.15] hover:text-[#1F2348] dark:hover:text-white hover:scale-105 active:scale-95 transition-all"
              title="New chat"
            >
              <Icon name="plus" size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-brand-blue/15 text-blue-700 dark:text-brand-blue-light border border-blue-300 dark:border-brand-blue/30 hover:bg-blue-200 dark:hover:bg-brand-blue/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Icon name="info" size={12} strokeWidth={2.5} />
            <span className="hidden sm:inline">Commands</span>
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#E9B213]/10 dark:bg-gold/15 text-[#E9B213] dark:text-gold border border-[#E9B213]/30 dark:border-gold/30 hover:bg-amber-200 dark:hover:bg-gold/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Icon name="sparkles" size={12} strokeWidth={2.5} />
            <span className="hidden sm:inline">Guide</span>
          </button>
          
          {/* DEBUG: Temporary EVM debug button - remove after testing */}
          <button
            onClick={() => setShowDebugPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30 hover:bg-red-200 dark:hover:bg-red-500/30 hover:scale-105 active:scale-95 transition-all"
            title="EVM Debug Tools"
          >
            🔧
          </button>
        </div>
      </div>

      {/* ── Sessions panel ──────────────────────────────────────────────────── */}
      {showSessions && (
        <div className="absolute top-[52px] left-0 right-0 mx-4 mt-1 z-30 glass-strong rounded-2xl shadow-xl overflow-hidden animate-modal-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-sm font-bold text-[#1F2348] dark:text-white">Chat Sessions</span>
            <button onClick={() => setShowSessions(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1F2348]/60 dark:text-white/55 hover:bg-white dark:hover:bg-white/[0.06] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <LoadingSpinner size="sm" type="circular" />
                <span className="text-xs text-[#1F2348]/60 dark:text-white/55">Loading...</span>
              </div>
            ) : sessions.length ? sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => loadSession(s.sessionId)}
                className={`flex items-start justify-between gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                  s.sessionId === currentSessionId
                    ? 'bg-[#E9B213]/10 dark:bg-gold/15 border border-[#E9B213]/30 dark:border-gold/30'
                    : 'hover:bg-white dark:hover:bg-white/[0.07] border border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1F2348] dark:text-white/90 truncate font-medium">{s.lastMessage}</p>
                  <p className="text-[11px] text-[#1F2348]/60 dark:text-white/55 mt-0.5">{new Date(s.lastActivity).toLocaleString()}</p>
                  {s.sessionId === currentSessionId && (
                    <p className="text-[10px] text-[#E9B213] font-semibold mt-1 flex items-center gap-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                      Current session
                    </p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setSessionToDelete(s.sessionId); }}
                  className="p-1 rounded-lg text-red-500 dark:text-error/70 hover:text-red-700 dark:hover:text-error hover:bg-red-100 dark:hover:bg-error/15 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Icon name="delete" size={14} strokeWidth={2} />
                </button>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-sm text-[#1F2348]/80 dark:text-white/55">No previous sessions</p>
                <p className="text-xs text-[#1F2348]/60 dark:text-white/55 mt-1">Start chatting to create one</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto scrollbar-hide py-4 px-4 min-h-0 space-y-3"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 animate-fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            {/* AI avatar */}
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-600 dark:bg-brand-blue text-white shadow-sm shadow-blue-500/20">
                <Icon name="robot" size={14} strokeWidth={2.2} />
              </div>
            )}

            <div className={`flex flex-col gap-1.5 max-w-[95%] sm:max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Bubble */}
              <div className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'bg-[#E9B213] text-white dark:text-[#1F2348] font-medium rounded-br-sm'
                  : 'bg-white/80 dark:bg-white/[0.07] text-[#1F2348] dark:text-white/90 border border-[#1F2348]/10 dark:border-white/[0.06] rounded-bl-sm'
              }`}>
                {msg.content.split('\n').map((line, idx) => {
                  const txMatch = line.match(/Transaction Hash[:\s]+([a-f0-9]{64})/i);
                  const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                  if (txMatch) {
                    const hash = txMatch[1];
                    const base = 'https://nimiq.watch/#';
                    return (
                      <div key={idx} className="mt-2 space-y-2">
                        <div
                          onClick={async () => {
                            await navigator.clipboard.writeText(hash);
                            setCopiedTxHash(hash);
                            setTimeout(() => setCopiedTxHash(null), 2000);
                          }}
                          className="flex items-center gap-2 bg-black/20 dark:bg-black/30 rounded-lg px-2.5 py-1.5 font-mono text-[10px] cursor-pointer hover:bg-black/30 dark:hover:bg-black/40 transition-colors group/hash break-all"
                        >
                          <span className="flex-1 opacity-80 font-mono">{hash.slice(0, 10)}…{hash.slice(-8)}</span>
                          {copiedTxHash === hash ? (
                            <Icon name="check" size={11} strokeWidth={2} className="opacity-80" />
                          ) : (
                            <Icon name="copy" size={11} strokeWidth={2} className="opacity-40 group-hover/hash:opacity-80 transition-opacity" />
                          )}
                        </div>
                        <a href={`${base}${hash}`} onClick={(e) => { e.preventDefault(); openExternalUrl(`${base}${hash}`); }}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[#E9B213]/80 hover:text-[#E9B213] dark:hover:text-gold transition-colors break-all">
                          <Icon name="explorer" size={11} strokeWidth={2} className="flex-shrink-0" />
                          <span className="underline underline-offset-2">View on Explorer</span>
                        </a>
                      </div>
                    );
                  }
                  if (urlMatch) {
                    const url = urlMatch[1];
                    let host = ''; try { host = new URL(url).hostname.toLowerCase(); } catch {}
                    const trusted = ['nimiq.watch', 'test.nimiq.watch'].some(h => host === h || host.endsWith('.' + h));
                    if (!trusted) return <p key={idx} className="break-all">{line}</p>;
                    return (
                      <a key={idx} href={url} onClick={(e) => { e.preventDefault(); openExternalUrl(url); }}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#E9B213]/80 hover:text-[#E9B213] dark:hover:text-gold transition-colors mt-1 break-all">
                        <Icon name="explorer" size={11} strokeWidth={2} className="flex-shrink-0" />
                        <span className="underline underline-offset-2">View on Explorer</span>
                      </a>
                    );
                  }
                  if (line.includes('View on explorer:')) return null;
                  if (line.trim()) return <p key={idx}>{line}</p>;
                  return null;
                })}
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(msg.content);
                    setCopiedMessageIndex(i);
                    setTimeout(() => setCopiedMessageIndex(null), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-[#1F2348]/60 dark:text-white/55 hover:text-[#1F2348] dark:hover:text-white/80 hover:bg-white dark:hover:bg-white/5 transition-colors"
                >
                  {copiedMessageIndex === i ? (
                    <><Icon name="check" size={10} strokeWidth={2} /> Copied!</>
                  ) : (
                    <><Icon name="copy" size={10} strokeWidth={2} /> Copy</>
                  )}
                </button>
                {msg.role === 'ai' && (
                  <button
                    onClick={() => { setInput(`Re: "${msg.content.slice(0, 60).replace(/\n/g, ' ').trim()}${msg.content.length > 60 ? '…' : ''}" `); inputRef.current?.focus(); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-[#1F2348]/60 dark:text-white/55 hover:text-[#1F2348] dark:hover:text-white/80 hover:bg-white dark:hover:bg-white/5 transition-colors"
                  >
                    <Icon name="chevron-right" size={10} strokeWidth={2} /> Reply
                  </button>
                )}
                {msg.role === 'user' && i === messages.length - 1 && !aiLoading && (
                  <button
                    onClick={() => sendMessage(msg.content)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-blue-600 dark:text-brand-blue-light hover:bg-blue-50 dark:hover:bg-brand-blue/10 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                    Retry
                  </button>
                )}
              </div>

              {msg.action && msg.role === 'ai' && <ActionCard action={msg.action} />}
            </div>
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* ── Scroll-to-bottom button ──────────────────────────────────────────── */}
      {showScrollBtn && !aiLoading && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{ bottom: keyboardOpen ? '72px' : '152px' }}>
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex flex-col items-center gap-0.5 group"
            aria-label="Scroll to latest message"
          >
            <span className="text-[9px] font-medium text-[#1F2348]/60 dark:text-white/50 group-hover:text-[#1F2348] dark:group-hover:text-white/70 transition-colors">
              new messages
            </span>
            <span className="w-7 h-7 rounded-full bg-white dark:bg-[#1c1e2e] border border-[#1F2348]/10 dark:border-white/15 shadow-md flex items-center justify-center text-[#1F2348]/60 dark:text-white/65 group-hover:text-[#E9B213] dark:group-hover:text-gold group-hover:border-[#E9B213]/30 dark:group-hover:border-gold/30 transition-all animate-scroll-hint">
              <Icon name="chevron-down" size={14} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 pt-2 bg-white dark:bg-[#0F1219] border-t border-gray-100 dark:border-white/[0.05] z-10"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        {aiLoading && (
          <div className="px-1 pb-2 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2 text-[12px] text-[#1F2348]/80 dark:text-white/75">
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#E9B213]/30 dark:bg-gold/35 animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#E9B213]" />
                </span>
                <span className="truncate">{aiStatus || 'Thinking through your request'}</span>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#1F2348]/50 dark:text-white/50">
                AI
              </span>
            </div>
            <div className="mt-2 h-px overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/[0.08]">
              <div className="h-full w-24 rounded-full bg-gradient-to-r from-transparent via-amber-500/80 to-transparent dark:via-gold animate-shimmer" />
            </div>
          </div>
        )}

        {/* Input row */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all ${
          isListening
            ? 'bg-red-50 dark:bg-error/8 border-red-300 dark:border-error/30'
            : wallet.connected && wallet.authCompleted === 0
            ? 'bg-[#E9B213]/10 dark:bg-gold/8 border-[#E9B213]/30 dark:border-gold/30'
            : 'bg-white/60 dark:bg-white/[0.08] border-[#1F2348]/10 dark:border-white/[0.12] focus-within:border-amber-400 dark:focus-within:border-gold/40 focus-within:bg-white dark:focus-within:bg-white/[0.10]'
        }`}>
          {/* Mic button */}
          <button
            onClick={toggleVoice}
            disabled={aiLoading || !!voiceUnavailableReason || (wallet.connected && wallet.authCompleted === 0)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              isListening
                ? 'bg-red-500 dark:bg-error text-white'
                : 'text-[#1F2348]/60 dark:text-white/60 hover:text-[#1F2348] dark:hover:text-white/80 hover:bg-white dark:hover:bg-white/[0.10]'
            } disabled:opacity-40`}
            title={
              wallet.connected && wallet.authCompleted === 0
                ? 'Sign in to use voice input'
                : voiceUnavailableReason || (isListening ? 'Stop' : 'Voice input')
            }
          >
            {isListening ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <Icon name="mic" size={16} strokeWidth={2} />
            )}
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isOverLimit && sendMessage()}
            disabled={aiLoading || isListening || (wallet.connected && wallet.authCompleted === 0)}
            placeholder={
              wallet.connected && wallet.authCompleted === 0
                ? 'Sign in to unlock chat…'
                : isListening
                ? 'Listening…'
                : 'Ask me anything…'
            }
            className="flex-1 bg-transparent text-[14px] text-[#1F2348] dark:text-white placeholder-gray-400 dark:placeholder-white/65 outline-none disabled:cursor-not-allowed"
          />

          {/* Word count (only when near limit) */}
          {wordCount > MAX_WORDS * 0.75 && input.trim() && (
            <span className={`text-[10px] font-mono flex-shrink-0 ${isOverLimit ? 'text-red-500 dark:text-error' : 'text-[#1F2348]/60 dark:text-white/60'}`}>
              {wordCount}/{MAX_WORDS}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || aiLoading || isOverLimit || (wallet.connected && wallet.authCompleted === 0)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40 ${
              input.trim() && !isOverLimit && !(wallet.connected && wallet.authCompleted === 0)
                ? 'bg-[#E9B213] text-white dark:text-[#1F2348] shadow-sm shadow-amber-500/25'
                : 'bg-white/80 dark:bg-white/[0.08] text-[#1F2348]/50 dark:text-white/60'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Status lines */}
        {isListening && (
          <p className="text-[11px] text-red-500 dark:text-error text-center mt-1.5 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-error animate-pulse inline-block" />
            Listening, speak now
          </p>
        )}
        {!isListening && voiceUnavailableReason && !aiLoading && (
          <p className="text-[11px] text-[#E9B213] text-center mt-1.5">
            {voiceUnavailableReason}
          </p>
        )}
        {wallet.connected && wallet.authCompleted === 0 && !isListening && !aiLoading && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).__triggerManualAuth) {
                  (window as any).__triggerManualAuth();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 dark:bg-[#E9B213]/100 text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Icon name="lock" size={11} strokeWidth={2} />
              Sign In to Unlock
            </button>
            <p className="text-[11px] text-[#E9B213] dark:text-amber-400 font-medium">
              24h session
            </p>
          </div>
        )}
        {!wallet.connected && !isListening && !aiLoading && (
          <p className="text-[11px] text-[#1F2348]/60 dark:text-white/60 text-center mt-1.5 flex items-center justify-center gap-1">
            <Icon name="wallet" size={11} strokeWidth={2} className="text-amber-500 dark:text-gold/80" />
            Connect your wallet for full functionality
          </p>
        )}

      </div>

      {/* ── Delete session modal ─────────────────────────────────────────────── */}
      <Modal
        open={!!sessionToDelete}
        onClose={() => !deleting && setSessionToDelete(null)}
        title="Delete this chat?"
        subtitle="All messages will be permanently removed."
        footer={
          <>
            <button onClick={() => setSessionToDelete(null)} disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[#1F2348]/60 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 dark:bg-error text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {deleting ? <><LoadingSpinner size="sm" type="circular" color="white" /> Deleting…</> : <><Icon name="delete" size={14} strokeWidth={2.2} /> Delete</>}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center flex-shrink-0">
            <Icon name="delete" size={18} strokeWidth={2} />
          </span>
          <p className="text-sm text-[#1F2348]/80 dark:text-white/70 leading-relaxed pt-1">This action cannot be undone.</p>
        </div>
      </Modal>

      {/* ── Commands modal ───────────────────────────────────────────────────── */}
      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Commands" subtitle="Tap any example to use it">
        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide space-y-4 relative" id="commands-container">
          {ALL_COMMANDS.map(section => (
            <div key={section.category} className="space-y-1.5">
              <p className="text-xs font-bold text-[#E9B213] px-1">{section.category}</p>
              <div className="space-y-1">
                {section.commands.map(cmd => (
                  <button key={cmd}
                    onClick={() => { setShowHelp(false); setInput(cmd); setTimeout(() => inputRef.current?.focus(), 80); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] text-[#1F2348] dark:text-white/70 bg-white/60 dark:bg-white/[0.03] hover:bg-[#E9B213]/10 dark:hover:bg-gold/8 hover:text-[#E9B213] dark:hover:text-gold border border-transparent hover:border-[#E9B213]/20 dark:hover:border-gold/20 transition-all">
                    "{cmd}"
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-brand-blue/8 border border-blue-200 dark:border-brand-blue/20 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 dark:text-brand-blue-light flex items-center gap-1.5"><Icon name="info" size={13} strokeWidth={2.5} /> Tips</p>
            {['Save NQ18... as Mom to send quickly later', 'Use the mic button for voice input', 'Scan QR codes to get wallet addresses', 'Keep messages under 200 words'].map(t => (
              <p key={t} className="text-xs text-blue-600 dark:text-brand-blue-light/75 flex items-start gap-1.5"><span className="mt-1 w-1 h-1 rounded-full bg-blue-400 dark:bg-brand-blue/60 flex-shrink-0" />{t}</p>
            ))}
          </div>
          {/* Scroll hint */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pt-2 pb-1 pointer-events-none">
            <span className="animate-scroll-hint text-[#1F2348]/60 dark:text-white/50">
              <Icon name="chevron-down" size={16} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </Modal>

      {/* ── Onboarding modal ─────────────────────────────────────────────────── */}
      <Modal
        open={showOnboarding}
        onClose={() => { setShowOnboarding(false); localStorage.setItem('nimagent_onboarding_seen', 'true'); }}
        title="Welcome to NimAgent AI"
        subtitle="Your intelligent crypto assistant"
      >
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide space-y-5 relative" id="onboarding-container">
          <p className="text-sm text-[#1F2348]/80 dark:text-white/75 leading-relaxed">
            Chat naturally to manage crypto — send NIM, buy gift cards, top up airtime, pay bills, and more. No menus, no jargon.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: 'send'      as IconName, title: 'Send & Receive',  desc: 'Instant, feeless',        color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-500/15',   border: 'border-blue-200 dark:border-blue-500/20' },
              { icon: 'gift-card' as IconName, title: 'Gift Cards',       desc: 'Amazon, Steam & more',    color: 'text-[#E9B213]',       bg: 'bg-[#E9B213]/10 dark:bg-gold/15',      border: 'border-[#E9B213]/20 dark:border-gold/20' },
              { icon: 'airtime'   as IconName, title: 'Mobile Top-ups',   desc: 'Airtime & data globally', color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-500/15', border: 'border-green-200 dark:border-green-500/20' },
              { icon: 'bill'      as IconName, title: 'Pay Bills',         desc: 'Electricity, TV & more', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/15', border: 'border-purple-200 dark:border-purple-500/20' },
            ].map(f => (
              <div key={f.title} className={`p-3 rounded-xl ${f.bg} border ${f.border}`}>
                <Icon name={f.icon} size={18} strokeWidth={2} className={`${f.color} mb-1.5`} />
                <p className="text-sm font-semibold text-[#1F2348] dark:text-white">{f.title}</p>
                <p className="text-[11px] text-[#1F2348]/80 dark:text-white/65 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-[#E9B213]">Try saying</p>
            {[
              { q: '"Send 100 NIM to my friend"',  a: "I'll guide you through the send" },
              { q: '"Buy a $50 Steam gift card"',   a: "I'll set it up with your NIM" },
              { q: '"Top up +234... with $10"',     a: "I'll detect the operator and send" },
            ].map((ex, i) => (
              <button key={i}
                onClick={() => {
                  setShowOnboarding(false);
                  localStorage.setItem('nimagent_onboarding_seen', 'true');
                  setInput(ex.q.replace(/['"]/g, ''));
                  setTimeout(() => inputRef.current?.focus(), 80);
                }}
                className="w-full text-left p-3 rounded-xl bg-[#E9B213]/10 dark:bg-gold/10 border border-[#E9B213]/30 dark:border-gold/25 hover:bg-amber-200 dark:hover:bg-gold/18 transition-all group"
              >
                <p className="text-[13px] font-semibold text-[#E9B213]">{ex.q}</p>
                <p className="text-[11px] text-[#1F2348]/80 dark:text-white/60 mt-0.5">→ {ex.a}</p>
              </button>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-green-100 dark:bg-green-500/15 border border-green-300 dark:border-green-500/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-200 dark:bg-green-500/25 flex items-center justify-center flex-shrink-0">
              <Icon name="check" size={15} strokeWidth={2.5} className="text-green-700 dark:text-green-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800 dark:text-green-300 mb-0.5">Non-custodial</p>
              <p className="text-[11px] text-green-700 dark:text-green-200 leading-relaxed">Your wallet stays under your control. AI cannot move funds without your approval on every transaction.</p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => { setShowOnboarding(false); setShowHelp(true); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-200 dark:bg-white/10 text-[#1F2348] dark:text-white border border-[#1F2348]/20 dark:border-white/20 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
            >
              View Commands
            </button>
            <button
              onClick={() => { setShowOnboarding(false); localStorage.setItem('nimagent_onboarding_seen', 'true'); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#E9B213] text-white dark:text-[#1F2348] hover:bg-amber-600 dark:hover:bg-gold-bright transition-colors"
            >
              Start Chatting
            </button>
          </div>

          {/* Scroll hint */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pt-1 pointer-events-none">
            <span className="animate-scroll-hint text-[#1F2348]/60 dark:text-white/60">
              <Icon name="chevron-down" size={16} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </Modal>
      
      {/* ── DEBUG: EVM Debug Panel (temporary - remove after testing) ─────── */}
      <Modal
        open={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
        title="🔧 EVM Debug Tools"
        subtitle="Diagnose USDT wallet connection issues"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1F2348]/80 dark:text-white/75">
            Use these tools to diagnose why the USDT wallet popup isn't appearing in Nimiq Pay.
          </p>
          
          <button
            onClick={async () => {
              const report = {
                hasEthereum: typeof window.ethereum !== 'undefined',
                hasNimiqPay: typeof window.nimiqPay !== 'undefined',
                ethereumKeys: typeof window.ethereum !== 'undefined' ? Object.keys(window.ethereum).slice(0, 15) : [],
                isMetaMask: (window.ethereum as any)?.isMetaMask ?? null,
                ethereumIsConnected: typeof window.ethereum !== 'undefined' ? (window.ethereum as any)?.isConnected?.() ?? null : null,
                nimiqPayKeys: typeof window.nimiqPay !== 'undefined' ? Object.keys(window.nimiqPay).slice(0, 15) : [],
              };
              addMessage({
                role: 'ai',
                content: `🔍 **EVM Provider Check**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n${report.hasEthereum ? '✅ window.ethereum exists' : '❌ window.ethereum NOT found'}\n${report.hasNimiqPay ? '✅ window.nimiqPay exists' : '❌ window.nimiqPay NOT found'}`,
              });
              setShowDebugPanel(false);
            }}
            className="w-full py-3 px-4 rounded-xl text-left bg-blue-100 dark:bg-blue-500/15 border border-blue-300 dark:border-blue-500/30 hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
          >
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
              1️⃣ Check EVM Provider
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400/75">
              Does window.ethereum exist? What methods are available?
            </p>
          </button>
          
          <button
            onClick={async () => {
              if (typeof (window as any).ethereum === 'undefined') {
                addMessage({
                  role: 'ai',
                  content: `❌ **Cannot test connection**\n\nwindow.ethereum does not exist. Run test #1 first.`,
                });
                setShowDebugPanel(false);
                return;
              }
              
              addMessage({
                role: 'ai',
                content: `⏳ **Testing wallet connection...**\n\nAttempting to connect to EVM wallet. This may take up to 10 seconds.`,
              });
              setShowDebugPanel(false);
              
              const report: any = { step: 'starting', startTime: Date.now() };
              
              try {
                report.step = 'calling eth_requestAccounts';
                const accountsPromise = (window as any).ethereum.request({ method: 'eth_requestAccounts' });
                
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('TIMEOUT after 10s - request never resolved or rejected')), 10000)
                );
                
                const accounts = await Promise.race([accountsPromise, timeoutPromise]);
                report.step = 'success';
                report.accounts = accounts;
                report.accountCount = (accounts as any)?.length ?? 0;
                report.firstAccount = (accounts as any)?.[0] ?? null;
                report.elapsedMs = Date.now() - report.startTime;
              } catch (err: any) {
                report.step = 'failed';
                report.errorMessage = err?.message;
                report.errorCode = err?.code;
                report.errorName = err?.name;
                report.elapsedMs = Date.now() - report.startTime;
              }
              
              addMessage({
                role: 'ai',
                content: `🔍 **Wallet Connection Test**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n${
                  report.step === 'success' 
                    ? `✅ **Connected successfully** in ${report.elapsedMs}ms\n\nAccount: ${report.firstAccount}\n\n**Next:** Run test #3 to check network switching.` 
                    : report.errorMessage?.includes('TIMEOUT')
                      ? `⏱️ **TIMEOUT** - Request hung for 10 seconds\n\n**Root cause:** Nimiq Pay's EVM provider bridge has an issue. The \`eth_requestAccounts\` call never completes.\n\n**Action:** Report this to the Nimiq Pay development team - it's not a bug in your app code.`
                      : `❌ **Failed:** ${report.errorMessage}\n\n**Error code:** ${report.errorCode}\n\n**Action:** Share this error with me and I can suggest a fix.`
                }`,
              });
            }}
            className="w-full py-3 px-4 rounded-xl text-left bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors"
          >
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
              2️⃣ Test Wallet Connection
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400/75">
              Call eth_requestAccounts with 10s timeout. May show popup.
            </p>
          </button>
          
          <button
            onClick={async () => {
              if (typeof (window as any).ethereum === 'undefined') {
                addMessage({
                  role: 'ai',
                  content: `❌ **Cannot test network switch**\n\nwindow.ethereum does not exist. Run test #1 first.`,
                });
                setShowDebugPanel(false);
                return;
              }
              
              addMessage({
                role: 'ai',
                content: `⏳ **Testing network switching...**\n\nChecking current chain, then switching to Polygon if needed. This may take up to 18 seconds.`,
              });
              setShowDebugPanel(false);
              
              const report: any = { steps: [] };
              
              // Step 1: check current chain
              try {
                const t0 = Date.now();
                const chainId = await Promise.race([
                  (window as any).ethereum.request({ method: 'eth_chainId' }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 8s')), 8000))
                ]);
                report.steps.push({ 
                  step: 'eth_chainId', 
                  result: chainId, 
                  elapsedMs: Date.now() - t0, 
                  isPolygon: chainId === '0x89',
                  chainName: chainId === '0x89' ? 'Polygon' : chainId === '0x1' ? 'Ethereum' : `Unknown (${chainId})`
                });
              } catch (err: any) {
                report.steps.push({ 
                  step: 'eth_chainId', 
                  error: err?.message, 
                  code: err?.code 
                });
                addMessage({
                  role: 'ai',
                  content: `🔍 **Network Switch Test**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n❌ **Failed at step 1:** Cannot check current chain.\n\n**Action:** Share this error - the provider can't even tell us what network it's on.`,
                });
                return;
              }
              
              // Step 2: switch if not on Polygon
              if (report.steps[0].result !== '0x89') {
                try {
                  const t1 = Date.now();
                  await Promise.race([
                    (window as any).ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x89' }],
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 10s - switch never resolved')), 10000))
                  ]);
                  report.steps.push({ 
                    step: 'wallet_switchEthereumChain', 
                    success: true, 
                    elapsedMs: Date.now() - t1 
                  });
                } catch (err: any) {
                  report.steps.push({ 
                    step: 'wallet_switchEthereumChain', 
                    error: err?.message, 
                    code: err?.code,
                    note: err?.code === 4902 ? 'Chain not added - would need wallet_addEthereumChain fallback' : undefined
                  });
                }
              } else {
                report.steps.push({ 
                  step: 'wallet_switchEthereumChain', 
                  skipped: 'already on Polygon' 
                });
              }
              
              // Analyze results
              let analysis = '';
              if (report.steps[0].isPolygon && report.steps[1].skipped) {
                analysis = `✅ **Already on Polygon!** No switch needed.\n\n**Next:** The problem must be in the actual USDT transfer (\`eth_sendTransaction\`). Let me know and I'll add a test for that.`;
              } else if (report.steps[1].success) {
                analysis = `✅ **Switch successful!** Took ${report.steps[1].elapsedMs}ms.\n\n**Next:** The problem must be in the actual USDT transfer. Let me know and I'll add a test for that.`;
              } else if (report.steps[1].error?.includes('TIMEOUT')) {
                analysis = `⏱️ **TIMEOUT** - Switch request hung for 10 seconds.\n\n**Root cause:** Network switch popup never appeared or provider didn't respond.\n\n**Action:** Report to Nimiq Pay team - \`wallet_switchEthereumChain\` hangs.`;
              } else if (report.steps[1].code === 4902) {
                analysis = `⚠️ **Chain not added** - Error code 4902.\n\n**Expected:** The app should auto-fallback to \`wallet_addEthereumChain\` (check \`src/lib/wallet/evm.ts\` - fallback logic exists).\n\n**Action:** The fallback might not be triggering. Let me check the code.`;
              } else if (report.steps[1].error) {
                analysis = `❌ **Failed:** ${report.steps[1].error}\n\n**Error code:** ${report.steps[1].code}\n\n**Action:** Share this error for diagnosis.`;
              }
              
              addMessage({
                role: 'ai',
                content: `🔍 **Network Switch Test**\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n${analysis}`,
              });
            }}
            className="w-full py-3 px-4 rounded-xl text-left bg-purple-100 dark:bg-purple-500/15 border border-purple-300 dark:border-purple-500/30 hover:bg-purple-200 dark:hover:bg-purple-500/25 transition-colors"
          >
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
              3️⃣ Test Network Switching
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400/75">
              Check current chain, then switch to Polygon if needed.
            </p>
          </button>
          
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-300 dark:border-red-500/30">
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              <strong>⚠️ Remove this button before production!</strong> This is a temporary diagnostic tool. Search for "DEBUG: EVM Debug Panel" and delete the modal.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}



