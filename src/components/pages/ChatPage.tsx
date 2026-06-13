'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import ActionCard from '@/components/ActionCard';
import Icon, { type IconName } from '@/components/Icon';
import Modal from '@/components/Modal';

// ─── Static data ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS: { label: string; icon: IconName; query?: string }[] = [
  { label: 'Send NIM',       icon: 'send' },
  { label: 'Gift card',      icon: 'gift-card',  query: 'Buy gift card' },
  { label: 'Top up airtime', icon: 'airtime' },
  { label: 'Pay a bill',     icon: 'bill' },
];

const DISCOVER_PROMPTS: { label: string; query: string }[] = [
  { label: 'What can you do?',       query: 'What can you help me with on NimHub?' },
  { label: 'About Nimiq',            query: 'Tell me something interesting about Nimiq and NIM.' },
  { label: 'Feeless transfers?',     query: 'Are NIM transfers really feeless? How does that work?' },
  { label: 'How gift cards work',    query: 'How do gift card purchases work on NimHub?' },
];

const ALL_COMMANDS = [
  { category: 'Send & Receive', commands: ['Send 50 NIM to [address]','Send to Mom (saved contact)','Show my address','Scan QR code','Check my balance'] },
  { category: 'Saved Contacts', commands: ['Save [address] as Mom','Send to Coffee Shop','Show my contacts','Rename Mom to Mother','Delete Alice'] },
  { category: 'Gift Cards',     commands: ['Buy Amazon gift card','Get $50 Steam card','Netflix gift card $25'] },
  { category: 'Airtime & Data', commands: ['Top up +234... with $10','Buy 5GB data bundle'] },
  { category: 'Bill Payments',  commands: ['Pay electricity bill','Pay DSTV subscription','Pay internet bill'] },
  { category: 'Crypto Swap',    commands: ['Swap NIM to BTC','Cash out (swap to BTC)'] },
  { category: 'Staking',        commands: ['Stake my NIM','Which validator is best?','Unstake my NIM'] },
  { category: 'Buy NIM',        commands: ['Buy NIM with card','Add funds'] },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ChatSession { sessionId: string; lastMessage: string; lastActivity: string; }

export default function ChatPage() {
  const {
    wallet, messages, addMessage, clearMessages,
    sendMessageToAI, startNewSession, loadOrCreateSession, currentSessionId,
  } = useAppStore();

  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [hasInitialized,  setHasInitialized]  = useState(false);
  const [showSessions,    setShowSessions]    = useState(false);
  const [showHelp,        setShowHelp]        = useState(false);
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [keyboardOpen,    setKeyboardOpen]    = useState(false);
  const [showScrollBtn,   setShowScrollBtn]   = useState(false);

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
    if (!localStorage.getItem('nimhub_onboarding_seen') && wallet.connected) {
      setShowOnboarding(true);
    }
  }, [wallet.connected]);

  // ── Session init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const WELCOME_CONNECTED    = "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code: just ask in plain language. New here? Tap a suggestion below to explore what's possible.";
    const WELCOME_DISCONNECTED = "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and more. Connect your wallet to get started, or ask me anything about NimHub.";

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

  // ── Scroll + desktop autofocus ──────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile && messages.length > 0 && messages[messages.length - 1].role === 'ai' && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    try {
      const lower = msg.toLowerCase().trim();
      if (/^(scan|scan qr|scan qr code|scan a qr|qr scan)$/.test(lower)) {
        addMessage({ role: 'user', content: msg });
        addMessage({ role: 'ai', content: 'Ready to scan! Point your camera at a QR code.', action: { type: 'qr-scan' } });
        setLoading(false);
        return;
      }
      await sendMessageToAI(msg, wallet.address || undefined);
    } catch (e) { console.error('Chat error:', e); }
    finally    { setLoading(false); }
  }, [input, loading, addMessage, sendMessageToAI, wallet.address]);

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // ── Voice ───────────────────────────────────────────────────────────────────
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
      setTimeout(() => sendMessageRef.current(t), 100);
    };
    r.onerror = (e: any) => {
      setIsListening(false);
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        addMessage({ role: 'ai', content: 'Microphone access denied. Allow it in browser settings and try again.' });
      } else if (e.error === 'network') {
        addMessage({ role: 'ai', content: 'Voice recognition needs a network connection.' });
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
      r.start(); setIsListening(true);
    } catch (e: any) { console.warn('[Voice]', e?.message); setIsListening(false); }
  }, [isListening, addMessage, startRecognition]);

  // ── Sessions ────────────────────────────────────────────────────────────────
  const fetchSessions = async () => {
    if (!wallet.address) return;
    setLoadingSessions(true);
    try {
      const { getChatSessions } = await import('@/lib/api-client');
      setSessions(await getChatSessions(wallet.address));
    } catch { /* silent */ }
    finally { setLoadingSessions(false); }
  };

  const loadSession = async (id: string) => {
    if (!wallet.address) return;
    setHasInitialized(true);
    try {
      const { getChatHistory } = await import('@/lib/api-client');
      const msgs = await getChatHistory(id, wallet.address);
      useAppStore.setState({
        currentSessionId: id,
        messages: msgs.map((m: any) => ({ role: m.role, content: m.content, action: m.action, timestamp: new Date(m.created_at).getTime() })),
      });
      setShowSessions(false);
    } catch { /* silent */ }
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
        await addMessage({ role: 'ai', content: "Hi, I'm your NimHub agent. Just ask in plain language what you'd me like to do." });
      }
    } catch { /* silent */ }
    finally { setDeleting(false); setSessionToDelete(null); }
  };

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-x-0 max-w-2xl mx-auto w-full flex flex-col bg-white dark:bg-background-primary"
      style={{
        top: '60px',
        bottom: keyboardOpen ? '0px' : '80px',
        height: keyboardOpen ? 'calc(100dvh - 60px)' : 'calc(100dvh - 140px)',
      }}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-background-primary z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 dark:bg-brand-blue flex items-center justify-center">
            <Icon name="robot" size={14} strokeWidth={2.2} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">AI Chat</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History / New */}
          <div className="flex items-center rounded-full border border-gray-300 dark:border-white/12 overflow-hidden bg-gray-100 dark:bg-white/[0.05]">
            <button
              onClick={() => { showSessions ? setShowSessions(false) : (fetchSessions(), setShowSessions(true)); }}
              disabled={!wallet.connected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="history" size={12} strokeWidth={2.2} />
              <span className="hidden sm:inline">History</span>
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-white/12" />
            <button
              onClick={async () => {
                setShowSessions(false);
                startNewSession();
                if (useAppStore.getState().messages.length > 0) clearMessages();
                await addMessage({ role: 'ai', content: "Hi, I'm your NimHub agent. Just ask in plain language what you'd like to do." });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white transition-colors"
              title="New chat"
            >
              <Icon name="plus" size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-brand-blue/15 text-blue-700 dark:text-brand-blue-light border border-blue-300 dark:border-brand-blue/30 hover:bg-blue-200 dark:hover:bg-brand-blue/25 transition-all"
          >
            <Icon name="info" size={12} strokeWidth={2.5} />
            <span className="hidden sm:inline">Commands</span>
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold border border-amber-300 dark:border-gold/30 hover:bg-amber-200 dark:hover:bg-gold/25 transition-all"
          >
            <Icon name="sparkles" size={12} strokeWidth={2.5} />
            <span className="hidden sm:inline">Guide</span>
          </button>
        </div>
      </div>

      {/* ── Sessions panel ──────────────────────────────────────────────────── */}
      {showSessions && (
        <div className="absolute top-[52px] left-0 right-0 mx-4 mt-1 z-30 bg-white dark:bg-[#16182a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-modal-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Chat Sessions</span>
            <button onClick={() => setShowSessions(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/55 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-5 h-5 border-2 border-gray-300 dark:border-gold/30 border-t-gray-600 dark:border-t-gold rounded-full animate-spin" />
                <span className="text-xs text-gray-500 dark:text-white/55">Loading...</span>
              </div>
            ) : sessions.length ? sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => loadSession(s.sessionId)}
                className={`flex items-start justify-between gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                  s.sessionId === currentSessionId
                    ? 'bg-amber-50 dark:bg-gold/8 border border-amber-200 dark:border-gold/20'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-white/85 truncate">{s.lastMessage}</p>
                  <p className="text-[11px] text-gray-500 dark:text-white/50 mt-0.5">{new Date(s.lastActivity).toLocaleString()}</p>
                  {s.sessionId === currentSessionId && (
                    <p className="text-[10px] text-amber-600 dark:text-gold font-semibold mt-1">Current session</p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setSessionToDelete(s.sessionId); }}
                  className="p-1 rounded-lg text-red-400 dark:text-error/50 hover:text-red-600 dark:hover:text-error hover:bg-red-50 dark:hover:bg-error/10 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Icon name="delete" size={14} strokeWidth={2} />
                </button>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 dark:text-white/55">No previous sessions</p>
                <p className="text-xs text-gray-500 dark:text-white/55 mt-1">Start chatting to create one</p>
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

            <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Bubble */}
              <div className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-600 dark:bg-gold text-white dark:text-background-primary font-medium rounded-br-sm'
                  : 'bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white/90 border border-gray-200 dark:border-white/[0.06] rounded-bl-sm'
              }`}>
                {msg.content.split('\n').map((line, idx) => {
                  const txMatch = line.match(/Transaction Hash[:\s]+([a-f0-9]{64})/i);
                  const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                  if (txMatch) {
                    const hash = txMatch[1];
                    const base = (process.env.NEXT_PUBLIC_NIMIQ_NETWORK === 'mainnet') ? 'https://nimiq.watch/#' : 'https://test.nimiq.watch/#';
                    return (
                      <div key={idx} className="mt-2 space-y-2">
                        <div
                          onClick={() => navigator.clipboard.writeText(hash)}
                          className="flex items-center gap-2 bg-black/20 dark:bg-black/30 rounded-lg px-2.5 py-1.5 font-mono text-[10px] cursor-pointer hover:bg-black/30 dark:hover:bg-black/40 transition-colors group/hash"
                        >
                          <span className="flex-1 opacity-80">{hash.slice(0, 10)}…{hash.slice(-8)}</span>
                          <Icon name="copy" size={11} strokeWidth={2} className="opacity-40 group-hover/hash:opacity-80 transition-opacity" />
                        </div>
                        <a href={`${base}${hash}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-amber-200 dark:text-gold/80 hover:text-amber-100 dark:hover:text-gold transition-colors">
                          <Icon name="explorer" size={11} strokeWidth={2} />
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
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-amber-200 dark:text-gold/80 hover:text-amber-100 dark:hover:text-gold transition-colors mt-1">
                        <Icon name="explorer" size={11} strokeWidth={2} />
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
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-500 dark:text-white/55 hover:text-gray-700 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Icon name="copy" size={10} strokeWidth={2} /> Copy
                </button>
                {msg.role === 'ai' && (
                  <button
                    onClick={() => { setInput(`Re: "${msg.content.slice(0, 60).replace(/\n/g, ' ').trim()}${msg.content.length > 60 ? '…' : ''}" `); inputRef.current?.focus(); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-500 dark:text-white/55 hover:text-gray-700 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <Icon name="chevron-right" size={10} strokeWidth={2} /> Reply
                  </button>
                )}
                {msg.role === 'user' && i === messages.length - 1 && !loading && (
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

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5 animate-fade-up">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-600 dark:bg-brand-blue text-white animate-breathe shadow-sm shadow-blue-500/20">
              <Icon name="robot" size={14} strokeWidth={2.2} />
            </div>
            <div className="bg-gray-100 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-white/40 dot-typing-1 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-white/40 dot-typing-2 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-white/40 dot-typing-3 inline-block" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Scroll-to-bottom button ──────────────────────────────────────────── */}
      {showScrollBtn && !loading && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{ bottom: keyboardOpen ? '72px' : '152px' }}>
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex flex-col items-center gap-0.5 group"
            aria-label="Scroll to latest message"
          >
            <span className="text-[9px] font-medium text-gray-500 dark:text-white/50 group-hover:text-gray-700 dark:group-hover:text-white/70 transition-colors">
              new messages
            </span>
            <span className="w-7 h-7 rounded-full bg-white dark:bg-[#1c1e2e] border border-gray-200 dark:border-white/15 shadow-md flex items-center justify-center text-gray-500 dark:text-white/65 group-hover:text-amber-600 dark:group-hover:text-gold group-hover:border-amber-300 dark:group-hover:border-gold/30 transition-all animate-scroll-hint">
              <Icon name="chevron-down" size={14} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 pt-2 bg-white dark:bg-background-primary border-t border-gray-100 dark:border-white/[0.05] z-10"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        {/* Prompt chips — single scrollable row, hidden when keyboard open */}
        {!keyboardOpen && messages.length <= 4 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {DISCOVER_PROMPTS.map(p => (
              <button key={p.label} onClick={() => sendMessage(p.query)} disabled={loading}
                className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-brand-blue/15 text-blue-700 dark:text-brand-blue-light border border-blue-300 dark:border-brand-blue/30 hover:bg-blue-200 dark:hover:bg-brand-blue/25 disabled:opacity-50 transition-colors whitespace-nowrap">
                {p.label}
              </button>
            ))}
          </div>
        )}

        {!keyboardOpen && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => sendMessage(p.query || p.label)} disabled={loading}
                className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-gold/15 text-amber-700 dark:text-gold border border-amber-300 dark:border-gold/30 hover:bg-amber-200 dark:hover:bg-gold/25 disabled:opacity-50 transition-colors whitespace-nowrap">
                <Icon name={p.icon} size={11} strokeWidth={2} />
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all ${
          isListening
            ? 'bg-red-50 dark:bg-error/8 border-red-300 dark:border-error/30'
            : 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] focus-within:border-amber-400 dark:focus-within:border-gold/40 focus-within:bg-white dark:focus-within:bg-white/[0.06]'
        }`}>
          {/* Mic button */}
          <button
            onClick={toggleVoice}
            disabled={loading}
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              isListening
                ? 'bg-red-500 dark:bg-error text-white'
                : 'text-gray-500 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
            } disabled:opacity-40`}
            title={isListening ? 'Stop' : 'Voice input'}
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
            disabled={loading || isListening}
            placeholder={isListening ? 'Listening…' : 'Ask me anything…'}
            className="flex-1 bg-transparent text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none disabled:cursor-not-allowed"
          />

          {/* Word count (only when near limit) */}
          {wordCount > MAX_WORDS * 0.75 && input.trim() && (
            <span className={`text-[10px] font-mono flex-shrink-0 ${isOverLimit ? 'text-red-500 dark:text-error' : 'text-gray-500 dark:text-white/50'}`}>
              {wordCount}/{MAX_WORDS}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || isOverLimit}
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40 ${
              input.trim() && !isOverLimit
                ? 'bg-amber-600 dark:bg-gold text-white dark:text-background-primary shadow-sm shadow-amber-500/25'
                : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-white/35'
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
            Listening — speak now
          </p>
        )}
        {!wallet.connected && !isListening && (
          <p className="text-[11px] text-gray-500 dark:text-white/50 text-center mt-1.5 flex items-center justify-center gap-1">
            <Icon name="wallet" size={11} strokeWidth={2} className="text-amber-500 dark:text-gold/80" />
            Connect your wallet for full functionality
          </p>
        )}
        <p className="text-[9px] text-center text-gray-500 dark:text-white/50 mt-1.5">
          Independent Project · Not affiliated with Nimiq Foundation
        </p>
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
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 dark:bg-error text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {deleting ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Deleting…</> : <><Icon name="delete" size={14} strokeWidth={2.2} /> Delete</>}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center flex-shrink-0">
            <Icon name="delete" size={18} strokeWidth={2} />
          </span>
          <p className="text-sm text-gray-600 dark:text-white/65 leading-relaxed pt-1">This action cannot be undone.</p>
        </div>
      </Modal>

      {/* ── Commands modal ───────────────────────────────────────────────────── */}
      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Commands" subtitle="Tap any example to use it">
        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide space-y-4 relative" id="commands-container">
          {ALL_COMMANDS.map(section => (
            <div key={section.category} className="space-y-1.5">
              <p className="text-xs font-bold text-amber-600 dark:text-gold px-1">{section.category}</p>
              <div className="space-y-1">
                {section.commands.map(cmd => (
                  <button key={cmd}
                    onClick={() => { setShowHelp(false); setInput(cmd); setTimeout(() => inputRef.current?.focus(), 80); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] text-gray-700 dark:text-white/70 bg-gray-50 dark:bg-white/[0.03] hover:bg-amber-50 dark:hover:bg-gold/8 hover:text-amber-700 dark:hover:text-gold border border-transparent hover:border-amber-200 dark:hover:border-gold/20 transition-all">
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
            <span className="animate-scroll-hint text-gray-500 dark:text-white/50">
              <Icon name="chevron-down" size={16} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </Modal>

      {/* ── Onboarding modal ─────────────────────────────────────────────────── */}
      <Modal
        open={showOnboarding}
        onClose={() => { setShowOnboarding(false); localStorage.setItem('nimhub_onboarding_seen', 'true'); }}
        title="Welcome to NimHub AI"
        subtitle="Your intelligent crypto assistant"
      >
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide space-y-5 relative" id="onboarding-container">
          <p className="text-sm text-gray-600 dark:text-white/75 leading-relaxed">
            Chat naturally to manage crypto — send NIM, buy gift cards, top up airtime, pay bills, and more. No menus, no jargon.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: 'send'      as IconName, title: 'Send & Receive',  desc: 'Instant, feeless',        color: 'text-blue-600 dark:text-brand-blue-light',   bg: 'bg-blue-50 dark:bg-brand-blue/8' },
              { icon: 'gift-card' as IconName, title: 'Gift Cards',       desc: 'Amazon, Steam & more',    color: 'text-amber-600 dark:text-gold',              bg: 'bg-amber-50 dark:bg-gold/8' },
              { icon: 'airtime'   as IconName, title: 'Mobile Top-ups',   desc: 'Airtime & data globally', color: 'text-green-600 dark:text-green-400',         bg: 'bg-green-50 dark:bg-green-500/8' },
              { icon: 'bill'      as IconName, title: 'Pay Bills',         desc: 'Electricity, TV & more', color: 'text-purple-600 dark:text-purple-400',        bg: 'bg-purple-50 dark:bg-purple-500/8' },
            ].map(f => (
              <div key={f.title} className={`p-3 rounded-xl ${f.bg} border border-gray-100 dark:border-white/[0.06]`}>
                <Icon name={f.icon} size={18} strokeWidth={2} className={`${f.color} mb-1.5`} />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-white/50 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-amber-600 dark:text-gold">Try saying</p>
            {[
              { q: '"Send 100 NIM to my friend"',  a: "I'll guide you through the send" },
              { q: '"Buy a $50 Steam gift card"',   a: "I'll set it up with your NIM" },
              { q: '"Top up +234... with $10"',     a: "I'll detect the operator and send" },
            ].map((ex, i) => (
              <button key={i}
                onClick={() => {
                  setShowOnboarding(false);
                  localStorage.setItem('nimhub_onboarding_seen', 'true');
                  setInput(ex.q.replace(/['"]/g, ''));
                  setTimeout(() => inputRef.current?.focus(), 80);
                }}
                className="w-full text-left p-3 rounded-xl bg-amber-50 dark:bg-gold/6 border border-amber-200 dark:border-gold/20 hover:bg-amber-100 dark:hover:bg-gold/12 transition-all group"
              >
                <p className="text-[13px] font-semibold text-amber-700 dark:text-gold">{ex.q}</p>
                <p className="text-[11px] text-gray-500 dark:text-white/50 mt-0.5">→ {ex.a}</p>
              </button>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-green-50 dark:bg-green-500/8 border border-green-200 dark:border-green-500/20 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name="check" size={15} strokeWidth={2.5} className="text-green-700 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800 dark:text-green-300 mb-0.5">Non-custodial</p>
              <p className="text-[11px] text-green-700 dark:text-green-200/75 leading-relaxed">Your wallet stays under your control. AI cannot move funds without your approval on every transaction.</p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => { setShowOnboarding(false); setShowHelp(true); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-white/8 text-gray-800 dark:text-white border border-gray-200 dark:border-white/12 hover:bg-gray-200 dark:hover:bg-white/12 transition-colors"
            >
              View Commands
            </button>
            <button
              onClick={() => { setShowOnboarding(false); localStorage.setItem('nimhub_onboarding_seen', 'true'); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 dark:bg-gold text-white dark:text-background-primary hover:bg-amber-600 dark:hover:bg-gold-bright transition-colors"
            >
              Start Chatting
            </button>
          </div>

          {/* Scroll hint */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pt-1 pointer-events-none">
            <span className="animate-scroll-hint text-gray-500 dark:text-white/50">
              <Icon name="chevron-down" size={16} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
