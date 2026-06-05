# Email Service & Automated NIM Sending Setup

## Overview

Two critical services have been integrated:
1. **Resend Email Service** - Send gift cards, verification codes, and confirmations
2. **Automated NIM Sending** - Send NIM from hot wallet when Coinify payments complete

Both services are **optional** - the system works in demo mode if not configured.

---

## 1. Resend Email Service Setup

### Why Resend?
- ✅ **Permanent free tier**: 3,000 emails/month (no trial, no credit card)
- ✅ **Native Next.js integration**: Built for React/Next.js
- ✅ **Simple API**: Easy to use
- ✅ **High deliverability**: Great inbox placement

### Get API Key

1. **Sign up**: Go to [resend.com](https://resend.com/)
2. **Create API Key**: Dashboard → API Keys → Create
3. **Copy key**: Starts with `re_...`

### Add to Environment

```bash
# In Railway (backend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### What Gets Sent

#### 1. **Gift Card Delivery**
- Sent when user orders gift card with email
- Contains: Card code, PIN, serial number
- Beautiful HTML email matching NimHub design

#### 2. **Verification Code (Coinify KYC)**
- Sent when user starts "Buy NIM" flow
- 6-digit code valid for 10 minutes
- Large, easy-to-read format

#### 3. **Payment Confirmation**
- Sent after successful NIM purchase
- Includes: Amount, TX hash, explorer link
- Green checkmark design

### Demo Mode (No API Key)

If `RESEND_API_KEY` is not set:
- Emails are logged to console
- Verification codes shown in server logs
- System works normally (emails just aren't sent)

### Custom Domain (Optional)

To send from `payments@nimhub.app`:

1. Add domain in Resend dashboard
2. Add DNS records (MX, TXT, DKIM)
3. Verify domain
4. Update `from:` in `n_server/server/email.js`

Default (no domain): `noreply@resend.dev`

---

## 2. Automated NIM Sending Setup

### Why Automated Sending?

When users buy NIM via Coinify:
1. They pay with card/bank (fiat → Coinify)
2. Coinify webhook confirms payment
3. **Our hot wallet sends NIM to user** ← This is automated

### Security Architecture

```
Hot Wallet (Your Server)
├── Holds NIM for automated sends
├── Private key on server only (never exposed)
├── Daily send limit: 1,000 NIM max
├── Per-request limit: 100 NIM max
├── Minimum balance alert: 50 NIM
└── All sends logged to database
```

### Setup Steps

#### 1. **Create Hot Wallet**

Go to [wallet.nimiq.com](https://wallet.nimiq.com/):
1. Create new wallet
2. **Save private key securely** (you'll need it)
3. **Save address** (starts with NQ)
4. Fund it with NIM (start with 100-500 NIM)

#### 2. **Add to Environment**

```bash
# In Railway (backend) - KEEP PRIVATE KEY SECRET!
HOT_WALLET_ADDRESS=NQ07 YOUR WALLET ADDRESS HERE
HOT_WALLET_PRIVATE_KEY=your_64_char_hex_private_key_here
NIMIQ_RPC_URL=https://rpc.testnet.nimiqwatch.com

# For mainnet:
# NIMIQ_RPC_URL=https://rpc.nimiqwatch.com
```

**⚠️ SECURITY CRITICAL:**
- Never commit private key to git
- Only set it in Railway environment variables
- Never log it
- Never expose it to frontend

#### 3. **Fund Hot Wallet**

Transfer NIM to your hot wallet address:
- **Testnet**: Get free testnet NIM from [faucet]
- **Mainnet**: Transfer real NIM from your main wallet

**Recommended amounts:**
- Development/Testing: 50-100 NIM
- Production: 500-1,000 NIM (1 week of expected sales)

#### 4. **Monitor Balance**

The system alerts when balance drops below 50 NIM:
```
[NIM Sender] ⚠️ LOW BALANCE ALERT: 45.23 NIM (minimum: 50 NIM)
```

Top up manually when you see this warning.

### Security Limits

All configured in `n_server/server/nim-sender.js`:

```javascript
const MAX_SEND_PER_REQUEST_NIM = 100;  // Max 100 NIM per transaction
const MAX_DAILY_SEND_NIM = 1000;       // Max 1,000 NIM per day
const MIN_HOT_WALLET_BALANCE = 50;     // Alert threshold
```

**What this protects against:**
- ✅ Single large theft attempt (max 100 NIM per request)
- ✅ Repeated theft attempts (max 1,000 NIM per day)
- ✅ Wallet running dry (alerts before balance hits zero)
- ✅ Audit trail (every send logged to database)

### Monitoring Sends

All sends logged to `nim_sends` table:

```sql
SELECT 
  to_address,
  amount_nim,
  tx_hash,
  purpose,
  created_at
FROM nim_sends
ORDER BY created_at DESC
LIMIT 10;
```

**Purposes tracked:**
- `coinify-purchase` - User bought NIM via Coinify
- `reward` - Promotional reward
- `refund` - Refund for failed order
- `manual` - Manual send by admin

### API Endpoints for Monitoring

#### Get Hot Wallet Stats
```bash
GET /api/nim-sender/stats

Response:
{
  "balance": 234.56,
  "sentToday": 45.23,
  "remainingDailyLimit": 954.77,
  "sendsCount": 3,
  "recentSends": [...],
  "limits": {
    "maxPerRequest": 100,
    "maxDaily": 1000,
    "minBalance": 50
  }
}
```

#### Manual Send (Admin Only)
```bash
POST /api/nim-sender/send
{
  "toAddress": "NQ07...",
  "amountNIM": 50,
  "message": "Refund for order #123",
  "purpose": "refund"
}
```

### Demo Mode (No Hot Wallet)

If hot wallet not configured:
- System logs what it would send
- Coinify webhook marks trades as `pending_manual_send`
- Admin must manually send NIM

---

## 3. Database Migration

Run this SQL in Supabase:

```sql
-- Email & NIM Sender Tables

-- 1. Coinify tables (if not already created)
\i n_server/migrations/coinify_tables.sql

-- 2. NIM sends tracking
\i n_server/migrations/nim_sends_table.sql
```

Or copy contents of:
- `n_server/migrations/coinify_tables.sql`
- `n_server/migrations/nim_sends_table.sql`

And run in Supabase SQL Editor.

---

## 4. Testing

### Test Email Service

```bash
# Start backend
cd n_server
npm start

# Send test email (manually trigger in code or via endpoint)
```

Check:
- ✅ Email arrives in inbox
- ✅ Design looks good
- ✅ Links work
- ✅ Codes are readable

### Test NIM Sender

```bash
# Check hot wallet balance
curl http://localhost:3000/api/nim-sender/stats

# Test send (testnet only!)
curl -X POST http://localhost:3000/api/nim-sender/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_SECRET" \
  -d '{
    "toAddress": "NQ07 TEST ADDRESS HERE",
    "amountNIM": 1,
    "message": "Test send",
    "purpose": "manual"
  }'
```

Check:
- ✅ Transaction appears on explorer
- ✅ Recipient receives NIM
- ✅ Send logged to database
- ✅ Daily limit checked

---

## 5. Production Checklist

### Before Launch

- [ ] Resend API key added to Railway
- [ ] Custom domain configured in Resend (optional)
- [ ] Hot wallet created and funded
- [ ] Hot wallet address added to Railway
- [ ] **Hot wallet private key added to Railway** (SECRET!)
- [ ] Database migrations run
- [ ] Test email delivery
- [ ] Test NIM sending (small amounts first)
- [ ] Verify daily limits work
- [ ] Set up balance monitoring alerts
- [ ] Document hot wallet top-up process

### After Launch

- [ ] Monitor `nim_sends` table daily
- [ ] Check hot wallet balance weekly
- [ ] Top up hot wallet before it hits 50 NIM
- [ ] Review send logs for anomalies
- [ ] Set up email delivery monitoring
- [ ] Configure Resend webhooks for bounce tracking

---

## 6. Cost Estimates

### Resend
- **Free tier**: 3,000 emails/month
- **Paid**: $20/month for 50,000 emails
- **Typical usage**: ~100-500 emails/month (well within free tier)

### NIM Sending
- **No API costs**: Direct blockchain transactions
- **Transaction fees**: 0 NIM (Nimiq is feeless)
- **Only cost**: NIM inventory in hot wallet

---

## 7. Support & Troubleshooting

### Email Not Sending

1. Check Railway logs for errors
2. Verify `RESEND_API_KEY` is set
3. Check Resend dashboard for delivery status
4. Verify recipient email is valid

### NIM Not Sending

1. Check hot wallet balance
2. Verify private key is correct
3. Check daily send limit not exceeded
4. Review `nim_sends` table for error logs
5. Verify RPC URL is correct for network

### Common Errors

**"Hot wallet not configured"**
- Solution: Add `HOT_WALLET_ADDRESS` and `HOT_WALLET_PRIVATE_KEY` to Railway

**"Daily limit exceeded"**
- Solution: Wait until tomorrow or increase limit in code

**"Insufficient hot wallet balance"**
- Solution: Transfer more NIM to hot wallet

**"Email send failed"**
- Solution: Check Resend API key and domain configuration

---

## 8. Security Best Practices

### Hot Wallet
1. **Never commit private key to git**
2. **Only store in Railway environment variables**
3. **Use different wallet for hot wallet vs service wallet**
4. **Keep hot wallet balance low** (1 week's worth max)
5. **Monitor sends daily**
6. **Set up alerts for large sends**
7. **Rotate private key every 6 months**

### Email
1. **Use Resend's reputation** (don't send spam)
2. **Include unsubscribe links** (if sending marketing)
3. **Monitor bounce rates**
4. **Don't send sensitive data** (no passwords)

---

## 9. Files Created

- `n_server/server/email.js` - Email service with Resend
- `n_server/server/nim-sender.js` - Automated NIM sending
- `n_server/migrations/nim_sends_table.sql` - Database schema
- `EMAIL_NIM_SENDER_SETUP.md` - This documentation

## 10. Integration Points

### Coinify Flow
1. User completes payment → Coinify webhook
2. Webhook validates payment
3. **Automated NIM send** from hot wallet
4. **Confirmation email** sent to user
5. Trade marked completed

### Gift Card Flow
1. User orders gift card
2. Payment verified on-chain
3. Gift card ordered from Reloadly
4. **Gift card email** sent with code
5. Order marked completed

---

## Questions?

- **Resend**: [docs.resend.com](https://docs.resend.com)
- **Nimiq RPC**: [nimiq.com/developers](https://nimiq.com/developers)
- **Team**: Check server logs or contact devs
