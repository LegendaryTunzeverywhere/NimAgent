# NimAgent Server Documentation

## Overview

The `server/` folder contains the **backend API and business logic** for NimAgent, a Nimiq-powered AI payment assistant. This Express.js server handles:

- AI chat interactions (Gemini/Claude)
- Cryptocurrency payments (NIM, USDT on Polygon)
- Third-party commerce (gift cards, airtime, bills via Reloadly + Cryptorefills)
- Wallet authentication and security
- Database operations (Supabase)
- Email notifications (Resend)
- **Phase B**: Product catalog caching and AI context injection
- **Phase C**: User favorites, price tracking, and personalization

**⚠️ CONTAINS SENSITIVE DATA:**
- API keys for Gemini, Claude, Reloadly, Supabase
- Hot wallet credentials for automated NIM sends
- Service wallet addresses
- CSRF secrets and session tokens
- Production database credentials
- Cryptorefills Partner ID

---

## Recent Updates (Phase B & C)

### Phase B: Product Discovery (Complete ✅)
**Implemented**: Cryptorefills catalog caching system
- Added `cryptorefills-catalog.js` - Caches brands, products, trending items
- Refreshes every 6 hours (mirrors Reloadly pattern)
- AI now knows about products from BOTH catalogs (Reloadly + Cryptorefills)
- System prompt includes catalog context automatically
- AI can tell users about NIM vs USDT payment options

### Phase C: Enhanced UI Features (Backend Complete ✅)
**Implemented**: Favorites, price tracking, personalization
- Added `favorites-tracking.js` - Complete backend module
- Added 9 new API endpoints to `index.js`
- Created database migration `001_favorites_and_tracking.sql`
- Updated AI agent to announce new features
- AI proactively suggests favoriting products and tracking prices

**Features Available**:
- ⭐ Favorites/Wishlist - Save products for quick access
- 📊 Price Tracking - Monitor prices, set alerts
- 🎯 Personalized Recommendations - AI learns from behavior
- 🔥 Trending Products - See what's popular

**Status**: Backend ready, requires database migration to activate

---

## File-by-File Breakdown

### Complete Server File Structure

```
server/
├── migrations/
│   └── 001_favorites_and_tracking.sql    # Phase C database schema
├── public/
│   ├── reconciliation-portal.html        # Admin reconciliation dashboard
│   ├── refund-portal.html                # Refund management interface
│   └── referrals.html                    # Referral analytics dashboard
├── node_modules/                          # Dependencies
├── .env                                   # ⚠️ SENSITIVE - Environment variables
├── .env.example                           # Template for .env
├── package.json                           # Node.js dependencies
├── package-lock.json                      # Locked dependency versions
├── README.md                              # Server setup instructions
│
├── index.js                               # 🔴 Main server entry point
├── agent.js                               # AI chat engine (Gemini/Claude)
├── supabase.js                            # Database client
├── utils.js                               # Helper functions
│
├── wallet-auth.js                         # Wallet authentication (Ed25519)
├── security-middleware.js                 # Rate limiting, quotes, logging
├── csrf-middleware.js                     # CSRF protection
├── portal-security.js                     # Admin portal authentication
│
├── reloadly.js                            # Reloadly API (NIM payments)
├── cryptorefills.js                       # Cryptorefills API (USDT payments)
├── cryptorefills-catalog.js               # Cryptorefills product cache (Phase B)
├── usdt-payment.js                        # USDT payment verification
├── catalog-cache.js                       # Reloadly product cache
│
├── favorites-tracking.js                  # Phase C: Favorites & price tracking
├── nim-sender.js                          # Hot wallet automated sends
├── nim-verification.js                    # Blockchain transaction verification
├── nimiq-client.js                        # Nimiq RPC client wrapper
│
├── referrals.js                           # Referral program logic
├── cashback.js                            # Cashback reward system
├── saved-addresses.js                     # Contact management
├── email.js                               # Email delivery (Resend)
│
├── refund-helpers.js                      # Automatic refund processing
├── reconciliation.js                      # Daily reconciliation job
├── crypto-swap.js                         # Crypto swap quotes
└── admin-routes.js                        # Admin API endpoints
```

### Core Server Files

#### **`index.js`** (Main Entry Point)
- Express server initialization
- Route registration for all API endpoints
- Middleware setup (CORS, Helmet, rate limiting, CSRF)
- Database connection and startup jobs
- Health check endpoint

**Key Routes:**
- `/api/chat` - AI agent interactions
- `/api/orders` - Gift card/airtime/bill orders
- `/api/orders/crypto/*` - Cryptorefills USDT payment orders
- `/api/transactions` - NIM transaction history
- `/api/auth/*` - Wallet authentication
- `/api/referrals/*` - Referral system
- `/api/cashback/*` - Cashback rewards
- `/api/favorites/*` - Product favorites (Phase C)
- `/api/tracking/*` - Price tracking (Phase C)
- `/api/recommendations` - Personalized suggestions (Phase C)
- `/api/trending` - Trending products (Phase C)
- `/api/interactions/track` - User behavior tracking (Phase C)
- `/api/nim-price` - Cryptocurrency pricing
- `/api/crypto-swap` - Crypto swap quotes

#### **`package.json`**
Node.js dependencies:
- `@anthropic-ai/sdk` - Claude AI integration
- `@google/genai` - Gemini AI integration
- `@nimiq/core` - Nimiq blockchain client
- `@supabase/supabase-js` - Database client
- `express` - Web framework
- `helmet`, `cors`, `express-rate-limit` - Security
- `csrf-csrf` - CSRF protection
- `resend` - Email service
- `dotenv` - Environment variables

---

### Authentication & Security

#### **`wallet-auth.js`**
Cryptographic wallet authentication system:
- Challenge-response signature verification using Ed25519
- 24-hour session management
- Prevents replay attacks and unauthorized access
- No passwords or personal data required

**Functions:**
- `createChallenge(wallet)` - Generate nonce for signature
- `verifyChallenge(wallet, signature)` - Verify cryptographic proof
- `getSession(wallet)` - Check if wallet has valid session
- `logout(wallet)` - Revoke session
- `requireVerifiedWallet` - Middleware to protect routes

#### **`security-middleware.js`**
Multi-layer security controls:
- Rate limiting per wallet/IP
- Quote system to prevent payment replay attacks
- Security event logging (suspicious activity)
- Payment verification tracking
- Periodic cleanup of expired quotes/logs

**Key Features:**
- Wallet-specific rate limits (prevents abuse)
- Quote expiry (payments valid for 10 minutes)
- Automatic security log pruning (7-day retention)

#### **`csrf-middleware.js`**
CSRF token generation and validation:
- Double-submit cookie pattern
- Protects state-changing operations
- Integrated with `csrf-csrf` library

#### **`portal-security.js`**
Admin portal authentication:
- Separate security layer for admin tools
- IP whitelisting support
- Access logging

---

### AI Agent System

#### **`agent.js`**
Core AI chat engine with multi-provider failover:

**Architecture:**
1. **Primary**: Google Gemini (2.5 Flash → 3.0 Flash → 3.5 Flash)
2. **Fallback**: Anthropic Claude (Opus 4.5 → Sonnet 4.5)
3. **Multi-key rotation**: Cascades through API keys on quota exhaustion

**Capabilities:**
- Natural language payment processing
- Gift card/airtime/bill recommendations
- Transaction history queries
- Balance checks
- Saved address management
- Referral link generation

**Function Calling:**
- `send_nim` - Process NIM transfers
- `create_gift_card_order` - Purchase gift cards
- `create_airtime_order` - Mobile top-ups
- `create_bill_order` - Bill payments
- `get_transactions` - Fetch history
- `get_balance` - Check wallet balance
- `save_address` - Store contact addresses
- `get_referral_link` - Generate referral URL

---

### Payment Processing

#### **`cryptorefills.js`**
Cryptorefills API integration for USDT-paid gift cards on Polygon:

**Gift Cards via USDT:**
- `getPaymentMethods()` - Get supported payment currencies (USDT)
- `getProducts(country)` - List gift card products for USDT payment
- `getProductPrice(productId, paymentVia)` - Get USDT price quote
- `createCryptoOrder(orderData)` - Create order and get payment address
- `verifyAndFulfillOrder(orderData)` - Verify USDT payment and fulfill order

**Payment Flow:**
1. User selects product → Get USDT price
2. Create order → Returns payment address
3. User sends USDT on Polygon → Backend verifies on-chain
4. Order fulfilled → Gift card delivered

**Configuration:**
- Partner ID: `1nsGF81Y8dso`
- Token: USDT (6 decimals)
- Network: Polygon (Chain ID 137)
- Contract: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`

#### **`cryptorefills-catalog.js`** (Phase B)
Cryptorefills product catalog caching:
- Loads brands, products, trending on startup
- Refreshes every 6 hours (like Reloadly)
- `getCryptoCatalogContext()` - AI-formatted catalog for system prompt

**AI Integration:**
- Catalog injected into agent system prompt
- AI knows about products from BOTH Reloadly (NIM) and Cryptorefills (USDT)
- Mentions payment options (NIM vs USDT) when browsing

#### **`reloadly.js`**
Reloadly API integration for commerce services:

**Gift Cards:**
- `searchGiftCards(query)` - Search 5000+ brands
- `getGiftCardProducts()` - List available products
- `orderGiftCard(productId, amount, email)` - Purchase gift card
- `matchGiftCard(brand)` - Brand name matching

**Airtime:**
- `detectOperator(phone, country)` - Auto-detect carrier
- `getOperators(country)` - List carriers by country
- `sendTopup(phone, amount, operator)` - Top-up mobile

**Bills:**
- `getBillServices(country, type)` - List bill providers
- `findBiller(name, country)` - Match bill company
- `payBill(billerId, accountNumber, amount)` - Pay bill

**Transaction Tracking:**
- `getTransactionDetails(txId)` - Check order status
- Automatic refund on failure
- Balance validation before orders

#### **`usdt-payment.js`**
USDT (Polygon) payment processor:
- Verify USDT payments to Reloadly's wallet
- Check on-chain transaction confirmations
- Used for large gift card orders when NIM insufficient

**Functions:**
- `processUSDTPayment(txHash, wallet)` - Validate USDT transaction
- `getReloadlyUSDTAddress()` - Get payment address
- `getReloadlyBalance()` - Check merchant USDT balance

#### **`nim-sender.js`**
Automated NIM sending from hot wallet:
- Send cashback rewards
- Send referral payouts
- Send refunds
- Emergency top-ups

**Functions:**
- `sendNIMFromHotWallet(to, amount, reason)` - Execute transfer
- `getHotWalletBalance()` - Check hot wallet balance
- `getSendStats()` - Usage analytics

**Security:**
- Hot wallet private key stored in env (encrypted at rest)
- Transaction signing done server-side
- Rate-limited to prevent drainage

---

### Transaction & History

#### **`nim-verification.js`**
Blockchain transaction verification:
- Fetch transaction data from Nimiq network
- Verify payment amounts and recipients
- Confirm payment to service wallet
- Prevent double-spending

**Functions:**
- `fetchNimTransaction(txHash)` - Get transaction from blockchain
- `verifyServicePayment(txHash, expectedAmount)` - Validate payment
- `checkPaymentOnce(txHash)` - Quick verification
- `verifyPaymentAsync(txHash, expectedAmount)` - Async verification with retries

#### **`nimiq-client.js`**
Nimiq blockchain client wrapper:
- Connect to Nimiq RPC node
- Query blockchain state
- Monitor transactions
- Balance lookups

---

### Referral & Rewards System

#### **`referrals.js`**
Complete referral program logic:

**User Referrals:**
- `getReferralCode(wallet)` - Generate unique code
- `getReferralLink(wallet)` - Create shareable link
- `trackReferral(wallet, referrerCode)` - Record sign-up
- `trackReferralSpending(wallet, amountUSD)` - Track spending progress

**Rewards:**
- Referrer earns 10 NIM when referee spends $1,000
- `claimReferralRewards(wallet)` - Payout pending rewards
- `getReferralStatus(wallet)` - Check earnings/referrals
- `getReferrals(wallet)` - List referred users

**Leaderboard:**
- `getLeaderboard()` - Top 20 referrers by earnings
- `getReferralSummary()` - Platform-wide stats

#### **`cashback.js`**
Cashback reward system:
- `trackCashback(wallet, orderId, amount)` - Record cashback
- `getCashback(wallet)` - Get pending cashback
- `processPendingCashbacks()` - Batch payout (cron job)

**Rules:**
- 1% cashback on gift cards
- 0.5% cashback on airtime/bills
- Automatic payout after 24 hours
- Sent from hot wallet

---

### Error Handling & Operations

#### **`refund-helpers.js`**
Automatic refund system for failed orders:
- `logOrderFailure(orderId, reason)` - Record failure
- `processAutomaticRefunds()` - Issue refunds (cron job)
- `categorizeFailure(error)` - Classify error type
- `checkReloadlyBalance()` - Validate merchant balance
- `validateReloadlyAvailability()` - Pre-order checks

**Refund Triggers:**
- Reloadly API errors
- Insufficient merchant balance
- Product unavailable
- Invalid phone number
- Network timeouts

#### **`reconciliation.js`**
Daily reconciliation job:
- Compare database records with blockchain
- Detect missing/duplicate transactions
- Flag discrepancies for manual review
- Generate reconciliation reports

**Schedule:** Runs daily at 2 AM UTC

**Functions:**
- `startReconciliationJob()` - Initialize cron job
- `reconcileTransactions(date)` - Match records
- `generateReport()` - Create audit log

---

### Data & Caching

#### **`supabase.js`**
Supabase database client initialization:
- PostgreSQL database connection
- Row Level Security (RLS) bypassed with service key
- Used for all data persistence

**Tables:**
- `transactions` - NIM payment records
- `orders` - Gift card/airtime/bill orders
- `users` - Wallet profiles
- `referrals` - Referral relationships
- `cashback` - Reward tracking
- `saved_addresses` - Contact book
- `security_logs` - Audit trail
- `payment_quotes` - Anti-replay protection
- `product_favorites` - User favorites/wishlist (Phase C)
- `price_tracking` - Price alerts and history (Phase C)
- `product_interactions` - User behavior for personalization (Phase C)

#### **`catalog-cache.js`**
Gift card catalog caching:
- Fetch all Reloadly products (5000+)
- Cache for 24 hours to reduce API calls
- Background refresh every 6 hours
- Country-specific filtering

**Functions:**
- `startCatalogSync()` - Start background sync
- `getCatalog()` - Get full catalog
- `getCatalogForCountry(country)` - Filtered by country
- `getCatalogContext()` - AI-formatted catalog

---

### Favorites & Personalization (Phase C)

#### **`favorites-tracking.js`**
Complete user favorites, price tracking, and personalization system:

**Favorites/Wishlist:**
- `addFavorite(wallet, productData)` - Add product to favorites
- `removeFavorite(wallet, brand, type)` - Remove from favorites
- `getFavorites(wallet)` - Get user's favorite products
- `incrementFavoriteView(wallet, brand, type)` - Track view count
- `isFavorited(wallet, brand, type)` - Check if product is favorited

**Price Tracking:**
- `startPriceTracking(wallet, trackingData)` - Start tracking product price
- `stopPriceTracking(wallet, brand, amount, currency)` - Stop tracking
- `getTrackedPrices(wallet)` - Get all tracked prices for user
- `updateTrackedPrice(wallet, brand, amount, currency, currentPrice)` - Update price history
- `isTracked(wallet, brand, amount, currency)` - Check if price is tracked

**Price Tracking Features:**
- Target price alerts (notify when price drops below threshold)
- Price history tracking (last 100 price points)
- Alert sent flag (prevent duplicate notifications)
- Supports both NIM and USDT payment currencies

**Personalization:**
- `trackInteraction(wallet, interactionData)` - Track user actions (view, purchase, favorite, search)
- `getPersonalizedRecommendations(wallet, limit)` - Get AI-powered suggestions based on history
- `getTrendingProducts(limit)` - Get popular products across all users

**Recommendation Algorithm:**
- Weighted scoring: purchases (10x), favorites (5x), views (1x), searches (2x)
- Based on last 50 interactions per user
- Returns top brands by score

**Use Cases:**
- Quick access to frequently purchased products
- Price drop notifications
- Personalized product suggestions
- Trending product discovery
- User behavior analytics

**Database Tables:**
- `product_favorites` - Saved products with view counts
- `price_tracking` - Tracked prices with history and alerts
- `product_interactions` - All user interactions for ML/personalization

**API Endpoints:**
- `POST /api/favorites/add` - Add to favorites
- `POST /api/favorites/remove` - Remove from favorites
- `GET /api/favorites` - Get favorites
- `POST /api/tracking/start` - Start price tracking
- `POST /api/tracking/stop` - Stop tracking
- `GET /api/tracking` - Get tracked prices
- `GET /api/recommendations` - Get personalized recommendations
- `GET /api/trending` - Get trending products
- `POST /api/interactions/track` - Track user behavior

**AI Integration:**
- AI announces features to users naturally
- Proactively suggests favoriting products
- Mentions price tracking when relevant
- Shows personalized recommendations based on history
- References trending products

---

### Database Migrations

#### **`migrations/001_favorites_and_tracking.sql`**
Phase C database schema:
- Creates `product_favorites` table with unique constraints
- Creates `price_tracking` table with price history JSONB
- Creates `product_interactions` table for behavior tracking
- Sets up indexes for fast lookups
- Enables Row Level Security (RLS)
- Creates backend access policies

**Migration Status:** ⚠️ Must be run manually in Supabase SQL Editor

---

### Saved Addresses

#### **`saved-addresses.js`**
Contact management for frequent recipients:
- `getSavedAddresses(wallet)` - List contacts
- `saveAddress(wallet, address, nickname)` - Add contact
- `updateAddress(id, nickname)` - Edit nickname
- `deleteAddress(id)` - Remove contact
- `findAddressByNickname(wallet, nickname)` - Search contacts
- `recordAddressUsage(wallet, address)` - Track usage
- `getFrequentAddresses(wallet)` - Most-used contacts

---

### Email

#### **`email.js`**
Email delivery via Resend:
- `sendGiftCardEmail(to, card)` - Email gift card codes
- `isEmailConfigured()` - Check if Resend is enabled

**Use Cases:**
- Gift card delivery (code, PIN, instructions)
- Order confirmations
- Refund notifications

---

### Utilities

#### **`utils.js`**
Helper functions:
- `normalizeNimAddress(addr)` - Format Nimiq addresses
- `isValidUUID(str)` - Validate UUIDs
- `formatAmount(luna)` - Convert luna to NIM
- `sanitizeInput(str)` - Input validation

---

## Environment Variables (.env)

### Required
```bash
# Server
PORT=3000
FRONTEND_URL=https://nimagent.com

# Authentication
API_SECRET=random_secret_for_bff_auth

# Service Wallet (receives payments)
SERVICE_WALLET_ADDRESS=NQ07...

# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key

# AI (Primary)
GEMINI_API_KEYS=key1,key2,key3  # Comma-separated for failover

# Commerce
RELOADLY_CLIENT_ID=xxx
RELOADLY_CLIENT_SECRET=xxx
RELOADLY_SANDBOX=false  # Set to 'false' for production

# Blockchain
NIMIQ_RPC_URL=https://rpc.nimiqx.com
```

### Optional
```bash
# AI (Backup)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODELS=claude-opus-4-5,claude-sonnet-4-5

# Hot Wallet (for automated sends)
HOT_WALLET_PRIVATE_KEY=xxx
HOT_WALLET_ADDRESS=NQ...

# Email
RESEND_API_KEY=re_...

# USDT Payments (Cryptorefills)
CRYPTOREFILLS_PARTNER_ID=1nsGF81Y8dso
POLYGON_RPC_URL=https://polygon-rpc.com
USDT_CONTRACT_ADDRESS=0xc2132D05D31c914a87C6611C10748AEb04B58e8F

# Model Overrides
GEMINI_MODELS=gemini-2.5-flash,gemini-3-flash-preview
```

---

## Admin Portals (public/)

#### **`reconciliation-portal.html`**
Daily transaction reconciliation dashboard:
- View discrepancies between database and blockchain
- Manual approval/rejection of flagged transactions
- Download reconciliation reports

#### **`refund-portal.html`**
Refund management interface:
- View pending refunds
- Approve/reject refund requests
- Process manual refunds
- Refund history

#### **`referrals.html`**
Referral analytics dashboard:
- Leaderboard view
- Referral payout tracking
- Fraud detection (unusual referral patterns)
- Batch reward processing

**Security:** All portals require IP whitelisting + API key authentication

---

## Background Jobs

### Startup Jobs (index.js)
1. **Catalog Sync** - Fetch Reloadly products (NIM payments)
2. **Crypto Catalog Sync** - Fetch Cryptorefills products (USDT payments)
3. **Reconciliation** - Daily at 2 AM UTC
4. **Security Cleanup** - Hourly, prune old logs
5. **Cashback Processor** - Every 6 hours

### Scheduled Tasks
- **Every 6 hours:** Cashback payouts, catalog refresh (both Reloadly + Cryptorefills)
- **Every 24 hours:** Catalog refresh (fallback)
- **Daily 2 AM UTC:** Transaction reconciliation
- **Hourly:** Security log cleanup (7-day retention)

---

## Security Features

### Multi-Layer Protection
1. **Wallet Authentication:** Ed25519 signature verification
2. **Rate Limiting:** Per-wallet and per-IP limits
3. **CSRF Protection:** Double-submit cookie tokens
4. **Quote System:** Prevents payment replay attacks
5. **Helmet.js:** Security headers (XSS, clickjacking, etc.)
6. **CORS:** Restricted to trusted frontend domains
7. **Input Validation:** Sanitize all user inputs
8. **API Key Rotation:** Multi-key failover for AI services

### Data Protection
- **Environment Variables:** Never committed to Git
- **Database:** Row Level Security (RLS) on Supabase
- **Private Keys:** Encrypted at rest, never logged
- **Session Tokens:** HTTP-only cookies with 24h expiry
- **TLS/HTTPS:** All production traffic encrypted

---

## Why This Must Be Deleted

### Sensitive Data Exposure
The `server/` folder contains:
- **API Keys:** Gemini, Claude, Reloadly, Supabase credentials
- **Private Keys:** Hot wallet credentials for automated NIM sends
- **Service Wallet:** Production wallet address receiving payments
- **Database Credentials:** Full admin access to Supabase
- **Session Secrets:** CSRF and authentication tokens

### Security Risks
If this code is in Git history:
- Attackers can extract API keys from old commits
- Hot wallet private key could be stolen (funds lost)
- Service wallet address is public but should not be in code
- Database could be compromised via leaked credentials

### Best Practices Violated
- **Never commit .env files** (even .env.example with real keys)
- **Backend should be separate repo** from frontend
- **API keys should use secret management** (AWS Secrets Manager, etc.)
- **Hot wallet should use hardware security module** (HSM) or cold storage

---

## Recommended Architecture

### Separate Repositories
1. **Frontend Repo** (nimpay-next) - Public
   - Next.js app
   - Client-side components
   - No secrets

2. **Backend Repo** (nimagent-server) - Private
   - Express.js API
   - Business logic
   - Secrets in environment variables

3. **Infrastructure Repo** (nimagent-infra) - Private
   - Terraform/CloudFormation
   - Deployment configs
   - Secret references (not values)

### Secret Management
- Use **GitHub Secrets** for CI/CD
- Use **AWS Secrets Manager** or **Vault** in production
- Rotate keys quarterly
- Never log secrets

---

## Migration Plan

After removing `server/` from history:

1. **Create new private repo:** `nimagent-server`
2. **Move server files** to new repo
3. **Update .env** with fresh credentials (rotate all keys)
4. **Update frontend** to point to new backend URL
5. **Deploy backend** separately (Heroku, Railway, AWS, etc.)
6. **Set up CI/CD** with secret injection
7. **Archive old credentials** (revoke old keys)

---

## Contact

For questions about server architecture:
- Review this documentation first
- Check Supabase dashboard for database schema
- Review Reloadly API docs for commerce integration
- Consult Nimiq blockchain explorer for transaction details

**Do not share server code or credentials publicly.**
