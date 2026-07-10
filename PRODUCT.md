# NimAgent

**AI-powered Nimiq payment platform**

## What

NimAgent is a conversational AI agent that makes crypto payments as simple as chatting. Users connect their Nimiq wallet, chat with the AI to send payments, buy gift cards, top up airtime, pay bills, and manage their crypto—all in natural language. The app runs as a mini-app inside Nimiq Pay, combining the security of on-device wallet signatures with the approachability of an AI conversation.

## Who

**Primary:** Crypto-curious users who want to use digital currency without learning blockchain jargon. They're comfortable with chat interfaces (WhatsApp, Messenger) but intimidated by traditional crypto wallets.

**Secondary:** Existing Nimiq users who want faster, more intuitive ways to transact—especially for recurring actions like topping up phone credit or splitting bills.

**Not for:** Power traders, DeFi natives, or users who prefer manual transaction construction. NimAgent abstracts complexity; advanced users want direct control.

## Why

Traditional crypto wallets force users to navigate transaction forms, manually paste addresses, calculate amounts, and understand gas/fees. NimAgent removes that friction: "Send 50 NIM to Alice" or "Top up my phone with $10" replaces five screens of forms. By running inside Nimiq Pay, it inherits wallet security without exposing private keys to a web app.

The AI doesn't just parse commands—it guides discovery. "What can I do?" gets a contextual answer. "I need to pay rent" suggests bill payment services. The interface learns what the user actually needs instead of forcing them to learn the interface.

## Register

`product` — This is app UI. Design serves the product (payments, transactions, AI chat), not the reverse. Clarity, speed, and trust beat brand expression.

## Critical paths

1. **Connect + Authenticate:** User opens NimAgent → connects Nimiq wallet → signs authentication message → reaches home screen with balance visible.
2. **Send payment via AI:** User taps "AI Chat" → types "Send 100 NIM to [address/nickname]" → AI shows action card with recipient, amount, message → user reviews and confirms → transaction broadcasts → success feedback.
3. **Buy gift card:** User asks "I want a $25 Amazon card" → AI shows card options → user selects → confirms payment → receives digital card code + transaction record.
4. **Resume after suspension:** User closes app → reopens hours later → app detects stale session → forces fresh wallet connection + re-auth → user regains access (no double popups, no broken state).

## Non-negotiable constraints

- **Nimiq Pay mini-app only:** NimAgent doesn't run standalone. It requires the Nimiq Pay SDK for wallet access. Detection code must block usage outside Nimiq Pay with a clear "Open in Nimiq Pay" message.
- **Session persistence vs. staleness:** Auth sessions last 24 hours via HTTP-only cookies. After 10 minutes of app inactivity (phone locked, app backgrounded), stale sessions force wallet disconnect + fresh sign-in. No silent re-auth that leaves broken state.
- **No key exposure:** NimAgent never touches private keys. All signatures happen in Nimiq Pay's secure context. If a feature requires key access, it's out of scope.
- **Referral + payment link handling:** Deep links with `?to=address&amount=...` or `?ref=code` must fire on both initial connection AND reconnection after auto-disconnect (not just first mount).
- **Feeless + fast:** Nimiq transactions confirm in ~60 seconds with zero fees. UI must emphasize this ("Send instantly, no fees") because users expect Bitcoin-style delays.

## Current state

- **Working:** Wallet connection, 24h auth sessions with localStorage cache (survives app suspension), dual-mode UI (light/dark), AI chat with action cards (send, gift cards, airtime, bills, QR scan), transaction history, referral rewards, payment request links, session staleness detection with auto-disconnect.
- **Styling:** Recently integrated official Nimiq UI Kit design tokens (colors, gradients, easing, 8px grid, typography) to match Nimiq Wallet's visual language. Core functionality 100% intact.
- **Needs work:** Some UI elements still use pre-Nimiq-Kit colors/styling. Icon usage isn't fully consistent with Nimiq iconography. Animation timing could be more refined with Nimiq easing. Typography hierarchy could better leverage the Muli + Fira Mono stack from Nimiq.

## Aesthetic / vibe

**Not:** Generic SaaS cream backgrounds, crypto exchange dashboards with charts everywhere, gamified neon fintech, sterile banking minimalism.

**Yes:** Conversational warmth. Dark mode with Nimiq blue (#1F2348) as the primary background, gold (#E9B213) for crypto actions, light blue (#0582CA) for commerce/AI. Generous spacing, no cramped layouts. Feels secure but approachable—like a trusted friend who happens to know crypto inside-out.

Think: Nimiq Wallet's polished design language + chat app immediacy + zero intimidation factor.

## Key workflows

### First-time user
1. User launches NimAgent inside Nimiq Pay
2. See landing screen: balance card (skeleton if loading), quick actions, welcome message
3. Tap "Connect Wallet" → Nimiq Pay prompts for account selection → user picks account
4. Tap "Sign In" on sign-in page → Nimiq Pay prompts for signature → user confirms
5. Return to home with live balance, transaction history, quick actions enabled

### Send payment (chat)
1. Tap "AI Chat" tab
2. Type "Send 50 NIM to Sarah" (or paste address)
3. AI responds with action card: recipient, amount, optional memo field, "Confirm Payment" button
4. User reviews, taps "Confirm Payment"
5. Nimiq Pay shows transaction confirmation → user approves
6. Success message in chat, balance updates, transaction appears in history

### Buy gift card
1. Chat: "I want a $20 Uber gift card"
2. AI shows card options with prices
3. User picks one → confirms payment
4. Transaction processes → digital card code delivered in chat + saved to history
5. User can copy code, view purchase details

### App resume after long suspension
1. User closes app (phone sleeps, app backgrounds)
2. Hours pass (>10 minutes inactivity)
3. User reopens NimAgent
4. App detects stale session → auto-disconnects wallet
5. User sees "Session expired. Connect your wallet again." → taps Connect → signs in fresh
6. Payment/referral links in URL fire after reconnection completes

## Tech stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS 3.4, custom Nimiq design tokens (OKLCH colors preferred), Framer Motion for animations
- **State:** Zustand with persist middleware (localStorage for wallet/session, survives suspension)
- **Wallet:** @nimiq/mini-app-sdk (miniAppAdapter for signatures, getUserAddress, requestPayment)
- **Auth:** HTTP-only cookies (24h expiry), localStorage auth cache (23h expiry, survives suspension)
- **Backend:** Separate Node.js server (`n_server/`) with Express, Supabase for DB, OpenRouter for AI, Reloadly for gift cards/airtime/bills

## Open questions

- Should we add Nimiq identicons (from @nimiq/identicons) for wallet addresses in transaction history?
- Should quick action tiles use Nimiq's radial gradients or keep flat backgrounds with accent borders?
- Should we integrate the extended nimiq-icons set (bitcoin logos, social icons, etc.) or stick to the core @nimiq/style icon sprite?
