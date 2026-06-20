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
      aiLoading: false,

      setActiveTab: (tab) => {
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
        // Clear signature cache from localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('nimagent-signature-cache');
          } catch (e) {
            // Silent failure
          }
        }
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
                return;
              }
            } catch (err) {
              // Silent failure
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
          } else {
            // Create new session only if no sessions exist
            const newSessionId = generateSessionId();
            set({ currentSessionId: newSessionId, messages: [] });
          }
        } catch (error) {
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
            // Silent failure
          }
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
          } catch (error) {
            // Silent failure
          }
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      sendMessageToAI: async (content: string, walletAddress?: string, options?: { bypassRateLimit?: boolean }) => {
        const { messages, addMessage } = get();

        // Client-side guard: trim and cap message length (server also enforces).
        const trimmed = (content || '').trim().slice(0, 2000);
        if (!trimmed) return;

        // Rate limiting: prevent spam, but allow bypassing for saved contact sends
        if (!options?.bypassRateLimit) {
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
        }

        // Set loading state
        set({ aiLoading: true });

        // Get history before adding user message — send more turns and include
        // action metadata so the server can build rich context for the AI.
        const history = messages.slice(-20).map(m => ({
          role: m.role,
          text: m.content,
          action: m.action || null, // include resolved actions for context
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
                // Validate address before saving
                const cleanAddress = action.recipientAddress.replace(/\s/g, '').toUpperCase();
                
                // Validate address format and length
                // Nimiq addresses: NQ + 34 alphanumeric = 36 chars total (unformatted)
                // With spaces: 44 chars (groups of 4 separated by spaces)
                if (!cleanAddress.startsWith('NQ')) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address format. Nimiq addresses must start with "NQ".\n\nProvided: ${action.recipientAddress}`,
                  });
                  return;
                }
                
                // Check exact length: must be 36 characters unformatted
                if (cleanAddress.length !== 36) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address length. Nimiq addresses must be exactly 36 characters (without spaces).\n\nProvided address: ${cleanAddress}\nLength: ${cleanAddress.length} characters (expected 36)\n\nPlease provide a complete, valid Nimiq address.`,
                  });
                  return;
                }
                
                // Validate format with regex (NQ + 34 alphanumeric)
                if (!/^NQ[0-9A-Z]{34}$/.test(cleanAddress)) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address format. Nimiq addresses must be "NQ" followed by exactly 34 alphanumeric characters.\n\nProvided: ${cleanAddress}`,
                  });
                  return;
                }
                
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
                  content: `✅ Saved ${action.nickname} to your contacts!`,
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
            if (action.type === 'update-contact' && (action.oldNickname || action.nickname)) {
              try {
                // Use oldNickname (new format) or fallback to nickname (old format)
                // Normalize to lowercase for case-insensitive lookup (backend uses ilike)
                const lookupNickname = (action.oldNickname || action.nickname || '').trim();
                
                // Type guard: ensure we have a nickname to look up
                if (!lookupNickname) {
                  await addMessage({
                    role: 'ai',
                    content: 'Cannot update contact: no nickname provided.',
                  });
                  return;
                }
                
                // Find contact by nickname to get ID
                const found = await findAddressByNickname(walletAddress, lookupNickname);
                if (!found.success || !found.found || !found.address) {
                  await addMessage({
                    role: 'ai',
                    content: `I couldn't find a contact named '${lookupNickname}'. Check the spelling or ask me to show your contact list.`,
                  });
                  return;
                }
                
                // Build update object - only include fields that are provided
                const updateData: any = {};
                if (action.nickname && action.nickname !== lookupNickname) {
                  updateData.nickname = action.nickname;
                }
                if (action.category) {
                  updateData.category = action.category;
                }
                if (action.notes !== undefined) {
                  updateData.notes = action.notes;
                }
                
                await updateSavedAddress(found.address.id, walletAddress, updateData);
                await addMessage({
                  role: 'ai',
                  content: `✅ Updated ${lookupNickname} in your contacts!`,
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
                // Normalize for case-insensitive lookup
                const deleteNickname = action.nickname.trim();
                const found = await findAddressByNickname(walletAddress, deleteNickname);
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
                  content: `✅ Removed ${action.nickname} from your contacts!`,
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
            action: response.action ?? undefined,
          });
        } catch (error: any) {
          const isRateLimit = typeof error?.message === 'string' && error.message.includes('429');
          await addMessage({
            role: 'ai',
            content: isRateLimit
              ? "You're sending messages a bit fast. Please wait a few seconds and try again."
              : "I'm currently unable to connect to the AI service. This could be due to network issues or server maintenance. Please try again in a moment, or check your connection.",
          });
        } finally {
          // Clear loading state
          set({ aiLoading: false });
        }
      },

      addTransaction: (transaction) => {
        set((state) => ({
          transactions: [transaction, ...state.transactions],
        }));
      },
    }),
    {
      name: 'nimagent-storage',
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