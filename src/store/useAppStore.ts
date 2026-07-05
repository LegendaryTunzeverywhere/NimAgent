import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Balance, ActionCard, Message } from '@/types';

let isSendingMessage = false;

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

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },
      
      setTheme: (theme) => set({ theme }),
      
      setNetwork: (network) => set({ network }),

      setAiStatus: (status) => set({ aiStatus: status }),

      connectWallet: async () => {
        // Guard against concurrent connect calls
        if (get().wallet.loading) return;

        set((state) => ({
          wallet: { ...state.wallet, loading: true, error: null },
        }));

        // Safety net — if connect takes > 30s, reset loading so the button
        // never stays permanently stuck on "Connecting..."
        const loadingTimeout = setTimeout(() => {
          if (get().wallet.loading && !get().wallet.connected) {
            set((state) => ({
              wallet: { ...state.wallet, loading: false, error: 'Connection timed out. Please try again.' },
            }));
          }
        }, 30_000);

        try {
          const { getUserAddress } = await import('@/lib/wallet');
          const address = await getUserAddress();

          clearTimeout(loadingTimeout);

          set((state) => ({
            wallet: {
              ...state.wallet,
              address,
              connected: true,
              loading: false,
            },
          }));

          // Now run balance + session restore after connecting the wallet.
          await get().fetchBalance();
          get().loadOrCreateSession();
        } catch (error: any) {
          clearTimeout(loadingTimeout);
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

        set((state) => ({ wallet: { ...state.wallet, loading: true } }));

        try {
          const { formatBalanceForUi, getBalancesWithFallback } = await import('@/lib/balance');
          const balances = await getBalancesWithFallback(wallet.address);
          const balance: Balance = formatBalanceForUi(balances);

          set((state) => ({
            wallet: { ...state.wallet, balance, loading: false, error: null },
          }));
        } catch {
          set((state) => ({
            wallet: { ...state.wallet, loading: false, error: 'Failed to fetch balance' },
          }));
        }
      },

      loadOrCreateSession: async () => {
        const { wallet } = get();
        if (!wallet.address) return;

        try {
          const { getChatSessions, getChatHistory } = await import('@/lib/api-client');
          
          // Always get all sessions from backend to ensure sync
          const sessions = await getChatSessions(wallet.address, {
            requireWalletSession: false,
          });
          
          if (sessions.length > 0) {
            // Load the most recent session
            const latestSession = sessions[0];
            const sessionMessages = await getChatHistory(latestSession.sessionId, wallet.address, {
              requireWalletSession: false,
            });
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
          // Create fresh session if load fails
          const newSessionId = generateSessionId();
          set({ currentSessionId: newSessionId, messages: [] });
        }
      },

      startNewSession: () => {
        const newSessionId = generateSessionId();
        // Set both new session ID and clear messages atomically
        set({ currentSessionId: newSessionId, messages: [] });
      },

      addMessage: async (message, forSessionId?: string) => {
        const { wallet, currentSessionId } = get();
        // If we specified which session this message is for, check if it's still active
        if (forSessionId && forSessionId !== currentSessionId) {
          // Session changed - don't add this message to the new session
          return;
        }
        const newMessage = { ...message, timestamp: Date.now() };
        
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        // Persist to DB — fire-and-forget but log failures so they're visible
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
            console.warn('[addMessage] DB persist failed (non-fatal).');
          }
        }
      },

      updateActionState: async (messageIndex: number, actionUpdates: Partial<ActionCard>) => {
        const { wallet, currentSessionId, messages } = get();
        
        // Update local state first
        set((state) => ({
          messages: state.messages.map((msg, idx) => 
            idx === messageIndex && msg.action 
              ? { ...msg, action: { ...msg.action, ...actionUpdates } }
              : msg
          ),
        }));
        
        // Persist updated action to the matching stored message row
        const message = messages[messageIndex];
        if (wallet.address && currentSessionId && message?.action) {
          try {
            const updatedAction = { ...message.action, ...actionUpdates };
            const { saveChatMessage } = await import('@/lib/api-client');
            await saveChatMessage({
              walletAddress: wallet.address,
              sessionId: currentSessionId,
              role: message.role,
              content: message.content,   // same content → upsert finds the row
              action: updatedAction,
            });
          } catch (error) {
            console.warn('[updateActionState] DB persist failed (non-fatal).');
          }
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      sendMessageToAI: async (content: string, walletAddress?: string, options?: { bypassRateLimit?: boolean }) => {
        // Guard: prevent multiple concurrent calls
        if (isSendingMessage) return;
        isSendingMessage = true;

        try {
          const { messages, addMessage } = get();
          const requestSessionId = get().currentSessionId ?? undefined;

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
              }, requestSessionId);
              return;
            }
          }

        // Set loading state - only if still in the same session
        if (get().currentSessionId === requestSessionId) {
          set({ aiLoading: true, aiStatus: 'Understanding your request' });
        }

        // Get history before adding user message — send more turns and include
        // action metadata so the server can build rich context for the AI.
        if (get().currentSessionId === requestSessionId) {
          set({ aiStatus: 'Reviewing recent context' });
        }
        const history = messages.slice(-20).map(m => ({
          role: m.role,
          text: m.content,
          action: m.action || null, // include resolved actions for context
        }));

        // Add user message
        await addMessage({ role: 'user', content: trimmed }, requestSessionId);

        try {
          // Import and call chat API
          const { chatWithAgent, saveAddress, updateSavedAddress, deleteSavedAddress, findAddressByNickname } = await import('@/lib/api-client');
          if (get().currentSessionId === requestSessionId) {
            set({ aiStatus: 'Asking NimAgent' });
          }
          const response = await chatWithAgent(trimmed, history, walletAddress);
          
          // First check: if session changed, stop processing entirely
          if (get().currentSessionId !== requestSessionId) {
            return;
          }
          
          // Handle action execution for non-UI actions (save, update, delete contacts)
          if (response.action && walletAddress) {
            const action = response.action;
            
            // Save contact
            if (action.type === 'save-contact' && action.nickname && action.recipientAddress) {
              try {
                if (get().currentSessionId === requestSessionId) {
                  set({ aiStatus: 'Saving contact' });
                }
                // Validate address before saving
                const cleanAddress = action.recipientAddress.replace(/\s/g, '').toUpperCase();
                
                // Validate address format and length
                // Nimiq addresses: NQ + 34 alphanumeric = 36 chars total (unformatted)
                // With spaces: 44 chars (groups of 4 separated by spaces)
                if (!cleanAddress.startsWith('NQ')) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address format. Nimiq addresses must start with "NQ".\n\nProvided: ${action.recipientAddress}`,
                  }, requestSessionId);
                  return;
                }
                
                // Check exact length: must be 36 characters unformatted
                if (cleanAddress.length !== 36) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address length. Nimiq addresses must be exactly 36 characters (without spaces).\n\nProvided address: ${cleanAddress}\nLength: ${cleanAddress.length} characters (expected 36)\n\nPlease provide a complete, valid Nimiq address.`,
                  }, requestSessionId);
                  return;
                }
                
                // Validate format with regex (NQ + 34 alphanumeric)
                if (!/^NQ[0-9A-Z]{34}$/.test(cleanAddress)) {
                  await addMessage({
                    role: 'ai',
                    content: `❌ Invalid address format. Nimiq addresses must be "NQ" followed by exactly 34 alphanumeric characters.\n\nProvided: ${cleanAddress}`,
                  }, requestSessionId);
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
                }, requestSessionId);
                return; // Don't add action card
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to save contact: ${err.message || 'Unknown error'}`,
                }, requestSessionId);
                return;
              }
            }
            
            // Update contact
            if (action.type === 'update-contact' && (action.oldNickname || action.nickname)) {
              try {
                if (get().currentSessionId === requestSessionId) {
                  set({ aiStatus: 'Updating contact' });
                }
                // Use oldNickname (new format) or fallback to nickname (old format)
                // Normalize to lowercase for case-insensitive lookup (backend uses ilike)
                const lookupNickname = (action.oldNickname || action.nickname || '').trim();
                
                // Type guard: ensure we have a nickname to look up
                if (!lookupNickname) {
                  await addMessage({
                    role: 'ai',
                    content: 'Cannot update contact: no nickname provided.',
                  }, requestSessionId);
                  return;
                }
                
                // Find contact by nickname to get ID
                const found = await findAddressByNickname(walletAddress, lookupNickname);
                if (!found.success || !found.found || !found.address) {
                  await addMessage({
                    role: 'ai',
                    content: `I couldn't find a contact named '${lookupNickname}'. Check the spelling or ask me to show your contact list.`,
                  }, requestSessionId);
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
                }, requestSessionId);
                return;
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to update contact: ${err.message || 'Unknown error'}`,
                }, requestSessionId);
                return;
              }
            }
            
            // Delete contact
            if (action.type === 'delete-contact' && action.nickname) {
              try {
                if (get().currentSessionId === requestSessionId) {
                  set({ aiStatus: 'Removing contact' });
                }
                // Normalize for case-insensitive lookup
                const deleteNickname = action.nickname.trim();
                const found = await findAddressByNickname(walletAddress, deleteNickname);
                if (!found.success || !found.found || !found.address) {
                  await addMessage({
                    role: 'ai',
                    content: `I couldn't find a contact named '${action.nickname}'. Check the spelling or ask me to show your contact list.`,
                  }, requestSessionId);
                  return;
                }
                
                await deleteSavedAddress(found.address.id, walletAddress);
                await addMessage({
                  role: 'ai',
                  content: `✅ Removed ${action.nickname} from your contacts!`,
                }, requestSessionId);
                return;
              } catch (err: any) {
                await addMessage({
                  role: 'ai',
                  content: `Failed to delete contact: ${err.message || 'Unknown error'}`,
                }, requestSessionId);
                return;
              }
            }
          }

          if (response.action && get().currentSessionId === requestSessionId) {
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
          } else if (get().currentSessionId === requestSessionId) {
            set({ aiStatus: 'Finalizing response' });
          }
          
          // Add AI response with action (for UI actions like show-contacts, send, etc.)
          if (get().currentSessionId === requestSessionId) {
            set({ aiStatus: 'Finalizing response' });
          }
          await addMessage({
            role: 'ai',
            content: response.message,
            action: response.action ?? undefined,
          }, requestSessionId);
        } catch (error: any) {
          const isRateLimit = typeof error?.message === 'string' && error.message.includes('429');
          await addMessage({
            role: 'ai',
            content: isRateLimit
              ? "You're sending messages a bit fast. Please wait a few seconds and try again."
              : "I'm currently unable to connect to the AI service. This could be due to network issues or server maintenance. Please try again in a moment, or check your connection.",
          }, requestSessionId);
        } finally {
          // Clear loading state - only if still in the same session
          if (get().currentSessionId === requestSessionId) {
            set({ aiLoading: false, aiStatus: null });
          }
        }
      } finally {
        isSendingMessage = false;
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

// ---------------------------------------------------------------------------
// Global balance polling — runs regardless of which tab is active.
// HTLCs are dynamic: they can settle at any time while the user is chatting
// or viewing history. Poll every 30s so the balance stays fresh.
// Also refresh on visibility change so returning to the app always shows
// the current balance.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  const poll = () => {
    const { wallet } = useAppStore.getState();
    if (wallet.connected && wallet.address) {
      useAppStore.getState().fetchBalance();
    }
  };

  // Poll every 30 seconds
  setInterval(poll, 30_000);

  // Refresh immediately when the app regains focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') poll();
  });
}
