# Coinify Integration - Buy NIM with Fiat Currency

This document explains the Coinify integration for purchasing NIM with fiat currency (USD, EUR, GBP, NGN, GHS, KES, etc.).

## Overview

Users can now buy NIM directly within NimHub using credit/debit cards or bank transfers through Coinify, a licensed fiat-to-crypto payment provider.

### Features
- ✅ Multi-currency support (USD, EUR, GBP, NGN, GHS, KES, ZAR, INR, and more)
- ✅ Email-based KYC verification (simple 6-digit code)
- ✅ Real-time NIM price quotes (5-minute validity)
- ✅ Minimum purchase: $20 (or equivalent)
- ✅ Sandbox mode for testing
- ✅ Webhook support for payment status updates

## User Flow

1. **Get Quote**: User specifies amount in their local currency (e.g., $50 USD)
2. **Email Verification**: User enters email → receives 6-digit verification code
3. **Code Verification**: User inputs code to complete KYC
4. **Payment**: User receives payment instructions (card/bank transfer)
5. **NIM Delivery**: After payment confirmation, NIM is sent to user's wallet

## Architecture

### Frontend Components
- **BuyNimInterface.tsx**: Main UI component with stepper flow
  - Step 1: Amount & currency selection
  - Step 2: Email input
  - Step 3: Code verification
  - Step 4: Payment confirmation
  - Step 5: Completion

- **ActionCard.tsx**: Handles `buy-nim` action type
- **HomePage.tsx**: "Buy NIM" quick action button (blue, like other commerce services)

### Backend API Endpoints

#### 1. Get Quote
```
POST /api/coinify/quote
Body: { amountFiat: number, currency: string }
Response: {
  amountFiat: 50,
  currency: "USD",
  amountNIM: 1234.56,
  exchangeRate: 0.0405,
  coinifyFee: 1.25,
  quoteId: "QUOTE-123...",
  expiresAt: "2026-01-01T12:05:00Z"
}
```

#### 2. Initiate KYC
```
POST /api/coinify/initiate-kyc
Body: { email: string, walletAddress: string }
Response: {
  success: true,
  message: "Verification email sent",
  demoCode: "123456" // Only in sandbox mode
}
```

#### 3. Verify Code
```
POST /api/coinify/verify-code
Body: { email: string, code: string, walletAddress: string }
Response: {
  success: true,
  message: "Email verified successfully"
}
```

#### 4. Create Trade
```
POST /api/coinify/create-trade
Body: {
  quoteId: string,
  email: string,
  walletAddress: string,
  nimAddress: string
}
Response: {
  success: true,
  tradeId: "TRADE-123...",
  paymentInstructions: "...",
  message: "..."
}
```

#### 5. Get Trade Status
```
GET /api/coinify/trade-status/:tradeId
Response: {
  tradeId: "TRADE-123...",
  status: "pending_payment",
  nimAddress: "NQ...",
  createdAt: "...",
  txHash: "..." // When completed
}
```

#### 6. Webhook Handler
```
POST /api/coinify/webhook
Body: { event: string, trade_id: string, status: string }
```

### Database Schema

#### `coinify_verifications` table
```sql
- id: BIGSERIAL PRIMARY KEY
- email: TEXT NOT NULL
- wallet_address: TEXT NOT NULL
- verification_code: TEXT NOT NULL
- verified: BOOLEAN DEFAULT FALSE
- expires_at: TIMESTAMP WITH TIME ZONE NOT NULL
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- UNIQUE(email, wallet_address)
```

#### `coinify_trades` table
```sql
- id: BIGSERIAL PRIMARY KEY
- trade_id: TEXT NOT NULL UNIQUE
- quote_id: TEXT NOT NULL
- email: TEXT NOT NULL
- wallet_address: TEXT NOT NULL
- nim_address: TEXT NOT NULL
- amount_fiat: NUMERIC
- currency: TEXT
- amount_nim: NUMERIC
- status: TEXT DEFAULT 'pending_payment'
- tx_hash: TEXT
- created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- completed_at: TIMESTAMP WITH TIME ZONE
```

**Trade Statuses**:
- `pending_payment`: Waiting for user to complete payment
- `processing`: Payment received, processing NIM transfer
- `completed`: NIM sent to user's wallet
- `failed`: Payment or transfer failed
- `cancelled`: Trade cancelled by user or timeout

## Environment Variables

Add to `.env.local` and `.env.example`:

```bash
# Coinify Integration (Buy NIM with Fiat)
COINIFY_PARTNER_ID=your_partner_id_here
COINIFY_API_KEY=sandbox_47d81618-9e83-4f67-a142-cb8570fe01ec
COINIFY_ENVIRONMENT=sandbox # or "production"
COINIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

## AI Agent Integration

The AI agent now understands "buy NIM" requests:

### Trigger Phrases
- "buy NIM"
- "purchase NIM"
- "add funds"
- "get more NIM"
- "buy with card"
- "buy with fiat"

### AI Response
Creates a `buy-nim` action that opens the BuyNimInterface component.

### Empty Wallet Guidance
When a user's wallet is empty and they try to make a payment, the AI now:
1. **Recommends NimHub's "Buy NIM" feature FIRST** (easiest, built-in)
2. Mentions other options (Nimiq Wallet, exchanges, swaps, receive from others)
3. Offers to help: "Want me to help you buy NIM right now?" → creates `buy-nim` action

## Testing (Sandbox Mode)

### Test Flow
1. Set `COINIFY_ENVIRONMENT=sandbox` in `.env.local`
2. Use "Buy NIM" quick action or say "buy NIM" to AI
3. Enter any amount ≥ $20
4. Use any test email (e.g., `test@example.com`)
5. Check server console for verification code (also returned in API response in sandbox mode)
6. Enter code to verify
7. See sandbox payment instructions (test card: 4111 1111 1111 1111)

### Sandbox Notes
- Verification codes are logged to console
- Payment instructions show test card details
- No actual money is processed
- No NIM is actually sent (would need to integrate with real Coinify API)

## Production Setup

### Prerequisites
1. **Coinify Account**: Sign up at [Coinify](https://www.coinify.com/)
2. **KYB Verification**: Complete Know Your Business verification
3. **API Credentials**: Get Partner ID, API Key, and Webhook Secret
4. **Webhook URL**: Configure `https://your-backend.com/api/coinify/webhook`

### Production Checklist
- [ ] Update `COINIFY_PARTNER_ID` with real partner ID
- [ ] Update `COINIFY_API_KEY` with production API key
- [ ] Set `COINIFY_ENVIRONMENT=production`
- [ ] Configure `COINIFY_WEBHOOK_SECRET` for webhook verification
- [ ] Set up email service (SendGrid/Mailgun) for verification codes
- [ ] Integrate with real Coinify Trade API:
  - Create trade: `POST https://api.coinify.com/v3/trades`
  - Get trade status: `GET https://api.coinify.com/v3/trades/:id`
  - Handle webhooks for payment status updates
- [ ] Implement NIM sending after payment confirmation (use Nimiq Hub API or direct wallet integration)
- [ ] Test with small real amounts first
- [ ] Monitor trade success rates and payment failures
- [ ] Set up customer support flow for failed trades

### Real Coinify API Integration

Replace the demo endpoints in `n_server/server/index.js` with:

```javascript
// Example: Create real Coinify trade
const response = await fetch('https://api.coinify.com/v3/trades', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.COINIFY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    baseCurrency: currency,
    quoteCurrency: 'NIM',
    baseAmount: amountFiat,
    returnUrl: `${process.env.FRONTEND_URL}/buy-complete`,
    cancelUrl: `${process.env.FRONTEND_URL}/buy-cancelled`,
  }),
});

const trade = await response.json();
```

## Security Considerations

1. **Email Verification**: Prevents spam and provides basic KYC
2. **Quote Expiry**: 5-minute expiry prevents price manipulation
3. **Wallet Validation**: Ensures NIM is sent to valid addresses only
4. **Webhook Signature**: Verify Coinify webhook signatures in production
5. **Rate Limiting**: Already applied via global rate limiter
6. **HTTPS Only**: All API calls use HTTPS
7. **No PII Storage**: Only store email, not payment details (handled by Coinify)

## Monitoring & Analytics

### Key Metrics to Track
- Total buy orders (by status)
- Average order value (fiat and NIM)
- Popular currencies
- KYC completion rate (email verification)
- Payment success rate
- Time from quote to payment
- Failed trades (investigate reasons)

### Recommended Monitoring
```sql
-- Daily buy volume
SELECT 
  DATE(created_at) as date,
  COUNT(*) as trades,
  SUM(amount_fiat) as total_fiat,
  SUM(amount_nim) as total_nim
FROM coinify_trades
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Conversion funnel
SELECT 
  status,
  COUNT(*) as count
FROM coinify_trades
GROUP BY status;
```

## Troubleshooting

### Common Issues

**Quote expired before payment**
- Solution: User can refresh quote in UI
- Quotes expire after 5 minutes to prevent price slippage

**Verification code not received**
- In sandbox: Check server console logs
- In production: Check email service logs, spam folder

**Trade stuck in "pending_payment"**
- Check webhook logs
- Verify Coinify webhook is configured correctly
- Manually check trade status via Coinify dashboard

**NIM not delivered after payment**
- Check trade status in database
- Verify webhook received "completed" status
- Check NIM sending logs
- Refund if necessary via Coinify dashboard

## Support & Documentation

- **Coinify API Docs**: https://developer.coinify.com/apidoc/trade/
- **Coinify Getting Started**: https://coinify.readme.io/docs/getting-started
- **Coinify Environments**: https://coinify.readme.io/docs/environments
- **Coinify SDK**: https://coinify.readme.io/page/payment-service-sdk

## Roadmap

### Phase 1 (Current - Sandbox)
- ✅ UI implementation
- ✅ Backend API stubs
- ✅ Database schema
- ✅ AI agent integration
- ✅ Sandbox testing

### Phase 2 (Production)
- [ ] Real Coinify API integration
- [ ] Email service setup
- [ ] Automated NIM sending
- [ ] Webhook signature verification
- [ ] Production testing with small amounts

### Phase 3 (Enhancements)
- [ ] More payment methods (Apple Pay, Google Pay)
- [ ] Recurring purchases
- [ ] Price alerts
- [ ] Purchase history in UI
- [ ] Referral bonuses

## Files Changed

### New Files
- `src/components/BuyNimInterface.tsx` - Main buy NIM UI
- `n_server/migrations/coinify_tables.sql` - Database schema
- `COINIFY_INTEGRATION.md` - This documentation

### Modified Files
- `.env.example` - Added Coinify variables
- `.env.local` - Added Coinify variables (with sandbox key)
- `src/components/ActionCard.tsx` - Added buy-nim handler
- `src/components/pages/HomePage.tsx` - Changed "Cash Out" to "Buy NIM" (blue)
- `src/types/index.ts` - Added 'buy-nim' action type
- `n_server/server/index.js` - Added Coinify API endpoints
- `n_server/server/agent.js` - Added buy-nim knowledge and guidance

## Questions?

Contact the development team or refer to Coinify's documentation for API-specific questions.
