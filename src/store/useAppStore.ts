import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Transaction, Message, Balance } from '@/types';

// Generate a unique session ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      wallet: {
        address: null,
        connected: false,
        balance: null,
        loading: false,
        error: null,
      },
      transactions: [],
      messages: [],
      activeTab: 'home',
      currentSessionId: null,
      theme: 'dark',
      network: 'testnet',

      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setTheme: (theme) => set({ theme }),
      
      setNetwork: (network) => set({ network }),

      connectWallet: async () => {
        set((state) => ({
          wallet: { ...state.wallet, loading: true, error: null },
        }));

        try {
          // Resolve the active wallet (Nimiq Pay mini-app provider or Hub popup)
          const { getUserAddress } = await import('@/lib/wallet');
          const address = await getUserAddress();
          
          set((state) => ({
            wallet: {
              ...state.wallet,
              address,
              connected: true,
              loading: false,
            },
          }));

          // Fetch balance after connecting
          get().fetchBalance();
          
          // Load last chat session or create new one
          get().loadOrCreateSession();
        } catch (error) {
          set((state) => ({
            wallet: {
              ...state.wallet,
              loading: false,
              error: 'Failed to connect wallet',
            },
          }));
        }
      },

      disconnectWallet: () => {
        set({
          wallet: {
            address: null,
            connected: false,
            balance: null,
            loading: false,
            error: null,
          },
          currentSessionId: null,
        });
      },

      fetchBalance: async () => {
        const { wallet } = get();
        if (!wallet.address) return;

        set((state) => ({
          wallet: { ...state.wallet, loading: true },
        }));

        try {
          // Fetch actual balance from API
          const { getBalances } = await import('@/lib/api-client');
          const balances = await getBalances(wallet.address);

          // Ensure balance values are valid numbers
          const nimBalance = Math.max(0, balances.nim.balance || 0);
          const nimBalanceUSD = Math.max(0, balances.nim.balanceUSD || 0);
          const reloadlyBalance = Math.max(0, balances.reloadly.balance || 0);
          const totalUSD = Math.max(0, balances.totalUSD || 0);

          const balance: Balance = {
            nim: {
              balance: nimBalance,
              balanceFormatted: nimBalance < 0.01 
                ? '0.00'
                : nimBalance.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  }),
              balanceUSD: nimBalanceUSD < 0.01
                ? '0.00'
                : nimBalanceUSD.toFixed(2),
            },
            usdt: {
              balance: reloadlyBalance,
              balanceFormatted: reloadlyBalance.toFixed(2),
              balanceUSD: reloadlyBalance.toFixed(2),
              network: 'Polygon',
            },
            totalUSD: totalUSD < 0.01
              ? '0.00'
              : totalUSD.toFixed(2),
          };

          set((state) => ({
            wallet: {
              ...state.wallet,
              balance,
              loading: false,
            },
          }));
        } catch (error) {
          console.error('Balance fetch error:', error);
          set((state) => ({
            wallet: {
              ...state.wallet,
              loading: false,
              error: 'Failed to fetch balance',
            },
          }));
        }
      },

      loadOrCreateSession: async () => {
        const { wallet, currentSessionId } = get();
        if (!wallet.address) return;

        try {
          const { getChatSessions, getChatHistory } = await import('@/lib/api-client');
          
          // Get all sessions for this wallet
          const sessions = await getChatSessions(wallet.address);
          
          if (sessions.length > 0 && !currentSessionId) {
            // Load the most recent session
            const latestSession = sessions[0];
            const messages = await getChatHistory(latestSession.sessionId, wallet.address);
            
            set({
              currentSessionId: latestSession.sessionId,
              messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                action: m.action,
                timestamp: new Date(m.created_at).getTime(),
              })),
            });
          } else if (!currentSessionId) {
            // Create new session
            const newSessionId = generateSessionId();
            set({ currentSessionId: newSessionId, messages: [] });
          }
        } catch (error) {
          console.error('Failed to load chat session:', error);
          // Create new session on error
          const newSessionId = generateSessionId();
          set({ currentSessionId: newSessionId, messages: [] });
        }
      },

      startNewSession: () => {
        const newSessionId = generateSessionId();
        set({ currentSessionId: newSessionId, messages: [] });
      },

      addMessage: async (message) => {
        const { wallet, currentSessionId } = get();
        const newMessage = { ...message, timestamp: Date.now() };
        
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        // Save to database if wallet is connected
        if (wallet.address && currentSessionId) {
          try {
            const { saveChatMessage } = await import('@/lib/api-client');
            await saveChatMessage({
              walletAddress: wallet.address,
              sessionId: currentSessionId,
              role: message.role,
              content: message.content,
              action: message.action,
            });
          } catch (error) {
            console.error('Failed to save message to database:', error);
          }
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      sendMessageToAI: async (content: string, walletAddress?: string) => {
        const { messages, addMessage } = get();

        // Client-side guard: trim and cap message length (server also enforces).
        const trimmed = (content || '').trim().slice(0, 2000);
        if (!trimmed) return;

        // Get history before adding user message
        const history = messages.slice(-10).map(m => ({
          role: m.role,
          text: m.content,
        }));

        // Add user message
        await addMessage({ role: 'user', content: trimmed });

        try {
          // Import and call chat API
          const { chatWithAgent } = await import('@/lib/api-client');
          const response = await chatWithAgent(trimmed, history, walletAddress);
          
          // Add AI response
          await addMessage({
            role: 'ai',
            content: response.message,
            action: response.action,
          });
        } catch (error: any) {
          console.error('Chat error:', error);
          const isRateLimit = typeof error?.message === 'string' && error.message.includes('429');
          await addMessage({
            role: 'ai',
            content: isRateLimit
              ? "You're sending messages a bit fast. Please wait a few seconds and try again."
              : "I'm currently unable to connect to the AI service. This could be due to network issues or server maintenance. Please try again in a moment, or check your connection.",
          });
        }
      },

      addTransaction: (transaction) => {
        set((state) => ({
          transactions: [transaction, ...state.transactions],
        }));
      },
    }),
    {
      name: 'nimhub-storage',
      partialize: (state) => ({
        wallet: {
          address: state.wallet.address,
          connected: state.wallet.connected,
        },
        transactions: state.transactions,
        currentSessionId: state.currentSessionId,
        activeTab: state.activeTab, // Persist active tab
        theme: state.theme, // Persist theme preference
        network: state.network, // Persist network preference
      }),
    }
  )
);