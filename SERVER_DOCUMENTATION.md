# NimAgent Server Documentation

## Overview

The `server/` folder contains the **backend API and business logic** for NimAgent, a Nimiq-powered AI payment assistant. This Express.js server handles:

- AI chat interactions (Gemini/Claude)
- Cryptocurrency payments (NIM, USDT)
- Third-party commerce (gift cards, airtime, bills via Reloadly)
- Wallet authentication and security
- Database operations (Supabase)
- Email notifications (Resend)

**⚠️ CONTAINS SENSITIVE DATA:**
- API keys for Gemini, Claude, Reloadly, Supabase
- Hot wallet credentials for automated NIM sends
- Service wallet addresses
- CSRF secrets and session tokens
- Production database credentials

---

## File-by-File Breakdown

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
- `/api/transactions` - NIM transaction history
- `/api/auth/*` - Wallet authentication
- `/api/referrals/*` - Referral system
- `/api/cashback/*` - Cashback rewards
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

# USDT Payments
RELOADLY_USDT_ADDRESS=0x...
POLYGON_RPC_URL=https://polygon-rpc.com

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
1. **Catalog Sync** - Fetch Reloadly products
2. **Reconciliation** - Daily at 2 AM UTC
3. **Security Cleanup** - Hourly, prune old logs
4. **Cashback Processor** - Every 6 hours

### Scheduled Tasks
- **Every 6 hours:** Cashback payouts
- **Every 24 hours:** Catalog refresh
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
