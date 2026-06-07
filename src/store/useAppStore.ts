import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Transaction, Message, Balance, ActionCard } from '@/types';

// FIX 3 FRONTEND: Generate UUID v4 format for sessionIds (backend validation requirement)
function generateSessionId(): string {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

      setActiveTab: (tab) => {
        console.log('[Store] Setting active tab:', tab);
        set({ activeTab: tab });
      },
      
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
        } catch (error: any) {
          console.error('[Wallet] Connection failed:', error);
          
          // Provide specific error messages
          let errorMessage = 'Failed to connect wallet';
          if (error?.message?.includes('popup')) {
            errorMessage = 'Please allow popups and try again';
          } else if (error?.message?.includes('closed') || error?.message?.includes('reject')) {
            errorMessage = 'Connection cancelled';
          } else if (error?.message?.includes('unavailable')) {
            errorMessage = 'Wallet unavailable. Try opening in Nimiq Pay app.';
          } else if (error?.message?.includes('timeout')) {
            errorMessage = 'Connection timed out. Please try again.';
          }
          
          set((state) => ({
            wallet: {
              ...state.wallet,
              loading: false,
              error: errorMessage,
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
        const { wallet, currentSessionId, messages } = get();
        if (!wallet.address) return;

        // If we have both a sessionId and messages in local storage, don't reload
        if (currentSessionId && messages.length > 0) {
          console.log('[Store] Using cached session:', currentSessionId);
          return;
        }

        try {
          const { getChatSessions, getChatHistory } = await import('@/lib/api-client');
          
          // If we have a sessionId but no messages, try to load from that session
          if (currentSessionId) {
            try {
              const sessionMessages = await getChatHistory(currentSessionId, wallet.address);
              if (sessionMessages.length > 0) {
                set({
                  messages: sessionMessages.map(m => ({
                    role: m.role,
                    content: m.content,
                    action: m.action,
                    timestamp: new Date(m.created_at).getTime(),
                  })),
                });
                console.log('[Store] Loaded existing session:', currentSessionId);
                return;
              }
            } catch (err) {
              console.warn('[Store] Failed to load session, will load latest or create new');
            }
          }
          
          // Get all sessions for this wallet
          const sessions = await getChatSessions(wallet.address);
          
          if (sessions.length > 0) {
            // Load the most recent session
            const latestSession = sessions[0];
            const sessionMessages = await getChatHistory(latestSession.sessionId, wallet.address);
            
            set({
              currentSessionId: latestSession.sessionId,
              messages: sessionMessages.map(m => ({
                role: m.role,
                content: m.content,
                action: m.action,
                timestamp: new Date(m.created_at).getTime(),
              })),
            });
            console.log('[Store] Loaded latest session:', latestSession.sessionId);
          } else {
            // Create new session only if no sessions exist
            const newSessionId = generateSessionId();
            set({ currentSessionId: newSessionId, messages: [] });
            console.log('[Store] Created new session:', newSessionId);
          }
        } catch (error) {
          console.error('Failed to load chat session:', error);
          // Keep existing session if load fails
          if (!currentSessionId) {
            const newSessionId = generateSessionId();
            set({ currentSessionId: newSessionId, messages: [] });
          }
        }
      },

      startNewSession: () => {
        const newSessionId = generateSessionId();
        // Set both new session ID and clear messages atomically
        set({ currentSessionId: newSessionId, messages: [] });
        console.log('[Store] Started new session:', newSessionId, '- Messages cleared');
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
          } catch (error: any) {
            console.error('Failed to save chat message:', error);
            // Log details for debugging
            console.debug('[Store] Save attempt details:', {
              hasWalletAddress: !!wallet.address,
              walletAddress: wallet.address?.slice(0, 10) + '...',
              hasSessionId: !!currentSessionId,
              sessionId: currentSessionId?.slice(0, 20) + '...',
              role: message.role,
              contentLength: message.content?.length,
              hasAction: !!message.action,
            });
          }
        } else {
          console.debug('[Store] Skipping chat save - wallet or session not ready:', {
            hasWallet: !!wallet.address,
            hasSession: !!currentSessionId,
          });
        }
      },

      updateActionState: async (messageIndex: number, actionUpdates: Partial<ActionCard>) => {
        const { wallet, currentSessionId, messages } = get();
        
        // Update the message in local state
        set((state) => ({
          messages: state.messages.map((msg, idx) => 
            idx === messageIndex && msg.action 
              ? { ...msg, action: { ...msg.action, ...actionUpdates } }
              : msg
          ),
        }));
        
        console.log(`[Store] Updated action state for message ${messageIndex}:`, actionUpdates);
        
        // If we have the updated message with an action, save it to database
        const message = messages[messageIndex];
        if (wallet.address && currentSessionId && message?.action) {
          try {
            const updatedMessage = {
              ...message,
              action: { ...message.action, ...actionUpdates }
            };
            
            const { saveChatMessage } = await import('@/lib/api-client');
            await saveChatMessage({
              walletAddress: wallet.address,
              sessionId: currentSessionId,
              role: updatedMessage.role,
              content: updatedMessage.content,
              action: updatedMessage.action,
            });
            console.log(`[Store] Saved updated action state to database`);
          } catch (error) {
            console.error('Failed to save updated action state:', error);
          }
        }
      },

      clearMessages: () => {
        console.log('[Store] Clearing all messages');
        set({ messages: [] });
      },

      sendMessageToAI: async (content: string, walletAddress?: string) => {
        const { messages, addMessage } = get();

        // Client-side guard: trim and cap message length (server also enforces).
        const trimmed = (content || '').trim().slice(0, 2000);
        if (!trimmed) return;

        // Rate limiting: prevent spam
        const now = Date.now();
        const lastMessageTime = messages.length > 0 ? messages[messages.length - 1].timestamp : 0;
        const timeSinceLastMessage = now - (lastMessageTime || 0);
        
        if (timeSinceLastMessage < 2000) {
          await addMessage({
            role: 'ai',
            content: 'Please wait a moment before sending another message.',
          });
          return;
        }

        // Get history before adding user message
        const history = messages.slice(-10).map(m => ({
          role: m.role,
          text: m.content,
        }));

        // Add user message
        await addMessage({ role: 'user', content: trimmed });

        try {
          // Import and call chat API
          const { chatWithAgent, saveAddress, updateSavedAddress, deleteSavedAddress, findAddressByNickname } = await import('@/lib/api-client');
          const response = await chatWithAgent(trimmed, history, walletAddress);
          
          // Handle action execution for non-UI actions (save, update, delete contacts)
          if (response.action && walletAddress) {
            const action = response.action;
            
            // Save contact
            if (action.type === 'save-contact' && action.nickname && action.recipientAddress) {
              try {
                const validCategories = ['personal', 'merchant', 'friend', 'family', 'other'] as const;
                const category = validCategories.includes(action.category as any) 
                  ? (action.category as 'personal' | 'merchant' | 'friend' | 'family' | 'other')
                  : 'other';
                
                await saveAddress({
                  wallet: walletAddress,
                  recipientAddress: action.recipientAddress,
                  nickname: action.nickname,
                  category,
                  notes: action.notes || '',
                });
                await addMessage({
                  role: 'ai',
                  content: response.message || `✅ Saved ${action.nickname} to your contacts!`,
                });
                return; // Don't add action card
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to save contact: ${err.message || 'Unknown error'}`,
                });
                return;
              }
            }
            
            // Update contact
            if (action.type === 'update-contact' && action.nickname) {
              try {
                // Find contact by nickname to get ID
                const found = await findAddressByNickname(walletAddress, action.nickname);
                if (!found.success || !found.found || !found.address) {
                  await addMessage({
                    role: 'ai',
                    content: `I couldn't find a contact named '${action.nickname}'. Check the spelling or ask me to show your contact list.`,
                  });
                  return;
                }
                
                await updateSavedAddress(found.address.id, walletAddress, {
                  nickname: action.newNickname,
                  category: action.category,
                  notes: action.notes,
                });
                await addMessage({
                  role: 'ai',
                  content: response.message || `✅ Updated ${action.nickname} in your contacts!`,
                });
                return;
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to update contact: ${err.message || 'Unknown error'}`,
                });
                return;
              }
            }
            
            // Delete contact
            if (action.type === 'delete-contact' && action.nickname) {
              try {
                // Find contact by nickname to get ID
                const found = await findAddressByNickname(walletAddress, action.nickname);
                if (!found.success || !found.found || !found.address) {
                  await addMessage({
                    role: 'ai',
                    content: `I couldn't find a contact named '${action.nickname}'. Check the spelling or ask me to show your contact list.`,
                  });
                  return;
                }
                
                await deleteSavedAddress(found.address.id, walletAddress);
                await addMessage({
                  role: 'ai',
                  content: response.message || `✅ Removed ${action.nickname} from your contacts!`,
                });
                return;
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to delete contact: ${err.message || 'Unknown error'}`,
                });
                return;
              }
            }
          }
          
          // Add AI response with action (for UI actions like show-contacts, send, etc.)
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
        messages: state.messages, // Persist messages to keep action card states
        currentSessionId: state.currentSessionId,
        activeTab: state.activeTab, // Persist active tab
        theme: state.theme, // Persist theme preference
        network: state.network, // Persist network preference
      }),
    }
  )
);