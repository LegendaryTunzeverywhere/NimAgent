'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
            content: "Hi, I'm your NimHub agent. I can send NIM, buy gift cards, top up airtime, pay bills, swap crypto, and show your QR code — just ask in plain language. New here? Tap a suggestion below to explore what's possible.",
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
  }, [messages, loading]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
          // Automatically send the transcribed text to AI
          setTimeout(() => {
            sendMessage(transcript);
          }, 100);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      addMessage({
        role: 'ai',
        content: 'Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setLoading(true);

    try {
      // Handle QR scan requests directly
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('scan') && (lowerMsg.includes('qr') || lowerMsg.includes('code'))) {
        addMessage({
          role: 'user',
          content: msg,
        });
        addMessage({
          role: 'ai',
          content: 'Ready to scan! Point your camera at a QR code containing a Nimiq address or payment request. 📷',
          action: {
            type: 'qr-scan',
          }
        });
        setLoading(false);
        return;
      }

      // Handle swap requests directly
      if (lowerMsg.includes('swap') || lowerMsg.includes('exchange') || lowerMsg.includes('trade')) {
        addMessage({
          role: 'user',
          content: msg,
        });
        addMessage({
          role: 'ai',
          content: 'Welcome to the crypto swap interface! 🔄\n\nExchange NIM for BTC or BTC for NIM with real-time rates. Perfect for diversifying your crypto portfolio!',
          action: {
            type: 'crypto-swap',
          }
        });
        setLoading(false);
        return;
      }

      await sendMessageToAI(msg, wallet.address || undefined);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

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
      const { getChatHistory } = await import('@/lib/api-client');
      const messages = await getChatHistory(sessionId, wallet.address);
      
      clearMessages();
      messages.forEach((msg: any) => {
        addMessage({
          role: msg.role,
          content: msg.content,
          action: msg.action,
          timestamp: new Date(msg.created_at).getTime(),
        });
      });
      
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
        startNewSession();
        clearMessages();
        setHasInitialized(false);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setDeleting(false);
      setSessionToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-2xl mx-auto w-full px-4">
      {/* Header with New Chat and History buttons */}
      <div className="flex items-center justify-between py-3 border-b border-white/5 shrink-0">
        <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest flex items-center gap-2">
          <Icon name="robot" size={16} strokeWidth={2} className="text-brand-blue-light" />
          AI Chat
        </h2>
        <div className="flex gap-2">
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
            className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 font-semibold bg-white/[0.04] text-white/70 border border-white/10 hover:bg-white/[0.08] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="history" size={13} strokeWidth={2.2} /> History
          </button>
          <button
            onClick={() => {
              startNewSession();
              clearMessages();
              setHasInitialized(false);
              setShowSessions(false);
            }}
            className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 font-semibold bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
          >
            <Icon name="plus" size={13} strokeWidth={2.5} /> New Chat
          </button>
        </div>
      </div>

      {/* Sessions Dropdown */}
      {showSessions && (
        <div className="glass rounded-2xl p-4 mt-3 max-h-64 overflow-y-auto animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white/80">Chat Sessions</h3>
            <button
              onClick={() => setShowSessions(false)}
              className="text-white/40 hover:text-white/70 transition-colors"
              aria-label="Close sessions"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          
          {loadingSessions ? (
            <div className="text-center py-4">
              <div className="w-7 h-7 mx-auto mb-2 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              <p className="text-xs text-white/40">Loading sessions...</p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  onClick={() => loadSession(session.sessionId)}
                  className={`p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 ${
                    session.sessionId === currentSessionId ? 'bg-gold/10 border border-gold/20' : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 truncate">{session.lastMessage}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {new Date(session.lastActivity).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => requestDeleteSession(session.sessionId, e)}
                      className="text-error/50 hover:text-error transition-colors flex-shrink-0 p-1"
                      title="Delete session"
                    >
                      <Icon name="delete" size={15} strokeWidth={2} />
                    </button>
                  </div>
                  {session.sessionId === currentSessionId && (
                    <p className="text-xs text-gold mt-2 flex items-center gap-1">
                      <Icon name="check" size={11} strokeWidth={3} /> Current session
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-white/40">No previous sessions</p>
              <p className="text-xs text-white/30 mt-1">Start chatting to create a session</p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4 py-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 animate-fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light">
                <Icon name="robot" size={17} strokeWidth={2} />
              </div>
            )}
            <div className={`flex flex-col gap-2 max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gold text-background-primary font-semibold'
                    : 'glass text-white/85'
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
                        <div className="bg-black/30 rounded-lg p-2.5 font-mono text-[10px] leading-relaxed break-all border border-white/5">
                          {txHash}
                        </div>
                        <a
                          href={`${baseUrl}${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-bright transition-colors"
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
                        className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-bright transition-colors mt-2"
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
              {msg.action && msg.role === 'ai' && (
                <ActionCard action={msg.action} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-3 animate-fade-up">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-blue/15 border border-brand-blue/30 text-brand-blue-light animate-breathe">
              <span className="animate-bob inline-flex">
                <Icon name="robot" size={17} strokeWidth={2} />
              </span>
            </div>
            <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue-light inline-block dot-typing-1" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue-light inline-block dot-typing-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue-light inline-block dot-typing-3" />
              </span>
              <span className="text-xs text-white/45 font-medium">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="shrink-0 pt-3 pb-2">
        {/* Discover prompts — teach users about NimHub. Shown early in a chat. */}
        {messages.length <= 3 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2 -mx-4 px-4">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-blue-light whitespace-nowrap flex-shrink-0 self-center pr-1">
              <Icon name="sparkles" size={12} strokeWidth={2} />
              Discover
            </span>
            {DISCOVER_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => sendMessage(prompt.query)}
                disabled={loading}
                className="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors bg-brand-blue/10 text-brand-blue-light border border-brand-blue/25 hover:bg-brand-blue/20 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
            {/* Trailing spacer so the last chip isn't clipped at the edge */}
            <span className="w-1 flex-shrink-0" aria-hidden="true" />
          </div>
        )}

        {/* Quick action prompts */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 -mx-4 px-4">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              onClick={() => sendMessage(prompt.label)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 disabled:opacity-50"
            >
              <Icon name={prompt.icon} size={13} strokeWidth={2} />
              {prompt.label}
            </button>
          ))}
          {/* Trailing spacer so the last chip isn't clipped at the edge */}
          <span className="w-1 flex-shrink-0" aria-hidden="true" />
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 glass">
          <button
            onClick={toggleVoiceInput}
            disabled={loading}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              isListening 
                ? 'bg-error text-white animate-pulse' 
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
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
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
            placeholder="Ask me to send NIM, buy gift cards, pay bills…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={loading || isListening}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50"
            style={{
              background: input.trim() && !loading ? '#F5A623' : 'rgba(255,255,255,0.07)',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={input.trim() && !loading ? '#0A0C17' : 'rgba(255,255,255,0.25)'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {!wallet.connected && (
          <p className="text-xs text-white/45 text-center mt-3 flex items-center justify-center gap-1.5">
            <Icon name="wallet" size={12} strokeWidth={2} className="text-gold" />
            Connect your wallet for full AI functionality
          </p>
        )}

        {isListening && (
          <p className="text-xs text-error text-center mt-3 animate-pulse flex items-center justify-center gap-1.5">
            <Icon name="mic" size={12} strokeWidth={2.2} /> Listening... Speak now
          </p>
        )}
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
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteSession}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-error/90 text-white hover:bg-error transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {deleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Deleting…
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
            You can&apos;t undo this. The messages in this session will be gone for good.
          </p>
        </div>
      </Modal>
    </div>
  );
}
