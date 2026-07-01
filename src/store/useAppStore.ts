import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Transaction, Message, Balance, ActionCard } from '@/types';
import { isWalletSessionRequiredError } from '@/lib/api-client';

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
      network: 'mainnet',
      aiLoading: false,
      aiStatus: null,
      walletSessionExpired: false,
      walletSessionError: null,

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },
      
      setTheme: (theme) => set({ theme }),
      
      setNetwork: (network) => set({ network }),

      setAiStatus: (status) => set({ aiStatus: status }),

      markWalletSessionExpired: (message) => set({
        walletSessionExpired: true,
        walletSessionError: message || 'Reconnect your wallet to refresh protected data.',
      }),

      clearWalletSessionExpired: () => set({
        walletSessionExpired: false,
        walletSessionError: null,
      }),

      connectWallet: async () => {
        // Guard against concurrent connect calls
        if (get().wallet.loading) return;

        set((state) => ({
          wallet: { ...state.wallet, loading: true, error: null },
        }));

        try {
          const { getUserAddress } = await import('@/lib/wallet');
          const address = await getUserAddress();
          
          set((state) => ({
            wallet: {
              ...state.wallet,
              address,
              connected: true,
              loading: false,
            },
            walletSessionExpired: false,
            walletSessionError: null,
          }));

          // Pre-warm the signature cache with one sign prompt BEFORE any API
          // calls need it — this prevents multiple concurrent sign prompts
          // from fetchBalance and loadOrCreateSession racing each other.
          try {
            const { getSignature, loginWithWallet } = await import('@/lib/api-client');
            await getSignature(address);
            await loginWithWallet(address);
          } catch {
            // Signature pre-warm is best-effort; API calls fall back to
            // signing individually if this fails.
          }

          // Now run balance + session serially so they share the cached sig
          await get().fetchBalance();
          get().loadOrCreateSession();
        } catch (error: any) {
          let errorMessage = 'Failed to connect wallet';
          if (error?.message?.includes('only inside the Nimiq Pay app')) {
            errorMessage = 'Open NimAgent inside the Nimiq Pay app to continue.';
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
            localStorage.removeItem('nimagent-wallet-session');
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
          walletSessionExpired: false,
          walletSessionError: null,
        });
      },

      refreshWalletSession: async () => {
        const { wallet, clearWalletSessionExpired, markWalletSessionExpired } = get();
        if (!wallet.address) return false;

        try {
          const { loginWithWallet } = await import('@/lib/api-client');
          await loginWithWallet(wallet.address);
          clearWalletSessionExpired();
          return true;
        } catch (error: any) {
          markWalletSessionExpired(error?.message || 'Reconnect your wallet to refresh protected data.');
          return false;
        }
      },

      fetchBalance: async () => {
        const { wallet } = get();
        if (!wallet.address) return;

        set((state) => ({
          wallet: { ...state.wallet, loading: true },
        }));

        try {
          const { formatBalanceForUi, getBalancesWithFallback } = await import('@/lib/balance');
          console.log('[fetchBalance] fetching for address:', wallet.address);
          const balances = await getBalancesWithFallback(wallet.address);
          console.log('[fetchBalance] raw response:', JSON.stringify(balances));
          const balance: Balance = formatBalanceForUi(balances);
          console.log('[fetchBalance] formatted:', JSON.stringify(balance));

          set((state) => ({
            wallet: {
              ...state.wallet,
              balance,
              loading: false,
              error: null,
            },
          }));
        } catch (error) {
          const errorMessage = error instanceof Error && error.name === 'NimiqSyncingError'
            ? 'Nimiq Pay is still syncing with the Nimiq network.'
            : 'Failed to fetch balance';
          set((state) => ({
            wallet: {
              ...state.wallet,
              loading: false,
              error: errorMessage,
            },
          }));
        }
      },

      loadOrCreateSession: async () => {
        const { wallet, currentSessionId, messages, markWalletSessionExpired, clearWalletSessionExpired } = get();
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
              const sessionMessages = await getChatHistory(currentSessionId, wallet.address, {
                requireWalletSession: false,
              });
              clearWalletSessionExpired();
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
              if (isWalletSessionRequiredError(err)) {
                markWalletSessionExpired();
              }
              // Silent failure
            }
          }
          
          // Get all sessions for this wallet
          const sessions = await getChatSessions(wallet.address, {
            requireWalletSession: false,
          });
          clearWalletSessionExpired();
          
          if (sessions.length > 0) {
            // Load the most recent session
            const latestSession = sessions[0];
            const sessionMessages = await getChatHistory(latestSession.sessionId, wallet.address, {
              requireWalletSession: false,
            });
            clearWalletSessionExpired();
            
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
          if (isWalletSessionRequiredError(error)) {
            markWalletSessionExpired();
          }
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
        set({ aiLoading: true, aiStatus: 'Understanding your request' });

        // Get history before adding user message — send more turns and include
        // action metadata so the server can build rich context for the AI.
        set({ aiStatus: 'Reviewing recent context' });
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
          set({ aiStatus: 'Asking NimAgent' });
          const response = await chatWithAgent(trimmed, history, walletAddress);
          
          // Handle action execution for non-UI actions (save, update, delete contacts)
          if (response.action && walletAddress) {
            const action = response.action;
            
            // Save contact
            if (action.type === 'save-contact' && action.nickname && action.recipientAddress) {
              try {
                set({ aiStatus: 'Saving contact' });
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
                set({ aiStatus: 'Updating contact' });
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
                set({ aiStatus: 'Removing contact' });
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

          if (response.action) {
            const statusByAction: Record<string, string> = {
              'show-contacts': 'Loading your contacts',
              'list-contacts': 'Loading your contacts',
              'send': 'Preparing payment details',
              'bill': 'Preparing bill payment',
              'airtime': 'Preparing airtime top-up',
              'gift-card': 'Preparing gift card checkout',
              'balance': 'Checking your balance',
              'qr-code': 'Preparing your QR code',
              'qr-scan': 'Preparing QR scanner',
              'support': 'Preparing support options',
              'referral': 'Preparing your referral link',
              'leaderboard': 'Loading leaderboard',
            };
            set({ aiStatus: statusByAction[response.action.type] || 'Preparing response' });
          } else {
            set({ aiStatus: 'Finalizing response' });
          }
          
          // Add AI response with action (for UI actions like show-contacts, send, etc.)
          set({ aiStatus: 'Finalizing response' });
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
          set({ aiLoading: false, aiStatus: null });
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
