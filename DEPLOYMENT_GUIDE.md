# Deployment Guide - Coinify Integration

## Current Issue

The Coinify endpoints return 404 because the backend hasn't been deployed with the new routes yet.

**Error:**
```
POST https://nimhub.vercel.app/api/coinify/quote 404 (Not Found)
```

## Solution: Deploy Backend to Railway

The backend server (`n_server/server/index.js`) has the new Coinify endpoints, but Railway needs to be updated.

### Steps to Deploy:

#### 1. **Commit Changes**

```bash
# Ensure all changes are committed
git add .
git commit -m "Add Coinify integration for Buy NIM feature"
git push origin main
```

#### 2. **Railway Auto-Deploy**

If Railway is connected to your GitHub repo:
- Railway will **automatically deploy** when you push to main
- Wait 2-3 minutes for build and deployment
- Check Railway dashboard for deployment status

#### 3. **Manual Deploy (if needed)**

If auto-deploy is not configured:

```bash
# Navigate to backend folder
cd n_server

# Deploy via Railway CLI
railway up
```

Or via Railway Dashboard:
1. Go to https://railway.app/
2. Select your project
3. Click "Deploy" → "Redeploy"

#### 4. **Verify Deployment**

Check backend is running with new endpoints:

```bash
# Health check
curl https://nserver-production.up.railway.app/health

# Test Coinify quote endpoint (should return 400 for missing params, not 404)
curl -X POST https://nserver-production.up.railway.app/api/coinify/quote \
  -H "x-api-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"amountFiat": 50, "currency": "USD"}'
```

Expected response (not 404):
```json
{
  "amountFiat": 50,
  "currency": "USD",
  "amountNIM": 1234.56,
  ...
}
```

### What Gets Deployed:

The following new Coinify endpoints in `n_server/server/index.js`:

1. `POST /api/coinify/quote` - Get buy quote
2. `POST /api/coinify/initiate-kyc` - Send verification email
3. `POST /api/coinify/verify-code` - Verify email code
4. `POST /api/coinify/create-trade` - Create buy order
5. `GET /api/coinify/trade-status/:tradeId` - Check order status
6. `POST /api/coinify/webhook` - Handle Coinify callbacks

### Frontend Proxy (Already Configured)

The Next.js BFF proxy (`src/app/api/[...path]/route.ts`) automatically forwards:

```
Browser → /api/coinify/quote
  ↓
Next.js API Route (adds API secret)
  ↓
Railway Backend → https://nserver-production.up.railway.app/api/coinify/quote
  ↓
Response back to browser
```

**No frontend changes needed** - the proxy handles everything!

## Database Migration

Before the backend can work fully, run the database migration:

### 1. **Access Supabase SQL Editor**

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

### 2. **Run Migration**

Copy and paste the contents of `n_server/migrations/coinify_tables.sql` and click "Run".

This creates:
- `coinify_verifications` table (email KYC)
- `coinify_trades` table (orders)
- Indexes and triggers
- RLS policies

### 3. **Verify Tables Created**

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'coinify%';

-- Should return:
-- coinify_verifications
-- coinify_trades
```

## Environment Variables

### Backend (Railway)

Ensure these are set in Railway dashboard:

```bash
# Existing
BACKEND_URL=https://nserver-production.up.railway.app
API_SECRET=your_api_secret_here
NIMIQ_ENV=testnet

# New Coinify Variables
COINIFY_PARTNER_ID=your_partner_id_here
COINIFY_API_KEY=sandbox_47d81618-9e83-4f67-a142-cb8570fe01ec
COINIFY_ENVIRONMENT=sandbox
COINIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

To add in Railway:
1. Go to Railway dashboard
2. Select your backend service
3. Go to "Variables" tab
4. Click "New Variable"
5. Add each Coinify variable
6. Click "Deploy" to restart with new variables

### Frontend (Vercel)

No changes needed - frontend doesn't need Coinify variables (they're server-side only).

## Testing After Deployment

### 1. **Test Quote Endpoint**

```bash
# Via Next.js proxy (browser makes this call)
curl -X POST https://nimhub.vercel.app/api/coinify/quote \
  -H "Content-Type: application/json" \
  -d '{"amountFiat": 50, "currency": "USD"}'
```

Should return:
```json
{
  "amountFiat": 50,
  "currency": "USD",
  "amountNIM": 1234.56,
  "exchangeRate": 0.0405,
  "coinifyFee": 1.25,
  "quoteId": "QUOTE-...",
  "expiresAt": "2026-01-01T12:05:00Z"
}
```

### 2. **Test in Browser**

1. Go to https://nimhub.vercel.app
2. Click "Buy NIM" button (blue button on home page)
3. Enter amount ≥ $20
4. Should see real-time quote with NIM amount

### 3. **Check Logs**

**Railway Logs:**
```
[BFF] POST request to path: coinify/quote
[Coinify Quote] 50 USD → $50.00 USD → 1234.56789 NIM (markup: none)
```

**Browser Console:**
```
No 404 errors
Quote fetched successfully
```

## Troubleshooting

### Issue: Still getting 404

**Cause:** Backend not deployed or environment variables missing

**Fix:**
1. Check Railway dashboard - is the latest commit deployed?
2. Check Railway logs for startup errors
3. Verify `BACKEND_URL` in Vercel environment variables
4. Verify `API_SECRET` matches between Vercel and Railway

### Issue: 500 Internal Server Error

**Cause:** Database tables not created or environment variables missing

**Fix:**
1. Run database migration in Supabase SQL Editor
2. Check Railway environment variables (Coinify vars)
3. Check Railway logs for specific error

### Issue: Quote returns wrong NIM amount

**Cause:** NIM price API failure or currency conversion issue

**Fix:**
1. Check Railway logs for "[NIM Price]" errors
2. Verify CoinGecko API is accessible from Railway
3. Check if currency is supported in `SUPPORTED_FIAT` array

## Verification Checklist

- [ ] Backend deployed to Railway with latest code
- [ ] Database migration run in Supabase
- [ ] Coinify environment variables added to Railway
- [ ] Test quote endpoint returns 200 (not 404)
- [ ] Buy NIM UI loads without errors
- [ ] Real-time quote appears when amount entered
- [ ] Word counter appears in chat input
- [ ] No console errors (except MetaMask warnings - ignore those)

## MetaMask Warnings (Ignore These)

These warnings are unrelated to our app:
```
MaxListenersExceededWarning: Possible EventEmitter memory leak
ObjectMultiplex - orphaned data for stream
```

**Cause:** MetaMask browser extension conflicts

**Impact:** None - these don't affect NimHub functionality

**Fix:** Not needed - they're from MetaMask, not our code

## Next Steps After Deployment

1. **Test Full Flow:**
   - Get quote → Email verification → Code verification → Trade creation

2. **Monitor:**
   - Railway logs for errors
   - Supabase database for trades
   - User feedback

3. **Production Setup:**
   - Follow `COINIFY_INTEGRATION.md` production checklist
   - Get real Coinify API credentials
   - Set up email service
   - Configure webhooks

## Support

If deployment issues persist:

1. Check Railway logs: `railway logs`
2. Check Vercel deployment logs
3. Check Supabase logs
4. Verify all environment variables are set correctly
5. Ensure database migration was successful

## Quick Deploy Script

```bash
#!/bin/bash
# Deploy backend with Coinify integration

echo "🚀 Deploying Coinify Integration..."

# 1. Commit changes
git add .
git commit -m "Add Coinify integration for Buy NIM"
git push origin main

echo "✅ Code pushed to GitHub"
echo "⏳ Waiting for Railway auto-deploy..."
echo "📊 Check Railway dashboard: https://railway.app/"
echo ""
echo "After deployment:"
echo "1. Run database migration in Supabase SQL Editor"
echo "2. Add Coinify environment variables to Railway"
echo "3. Test at https://nimhub.vercel.app"
```

Save as `deploy-coinify.sh` and run: `bash deploy-coinify.sh`
