# 🚀 Deployment Checklist - NimHub Security Fix

## Current Status: FIXED LOCALLY ✅

Your code is now properly configured with the BFF (Backend-for-Frontend) security pattern. All API calls now go through the Next.js server instead of directly to Railway from the browser.

---

## 🔧 What Was Fixed

### 1. **Removed Double `/api` Path Issue**
   - **Problem**: URLs like `/api/api/balances` (502 errors)
   - **Fix**: Changed `${API_URL}/api/balances` → `${API_URL}/balances`

### 2. **Removed `NEXT_PUBLIC_API_URL` References**
   - **Problem**: Production site trying to call `http://localhost:3000`
   - **Fix**: All components now use `/api/*` (same-origin BFF proxy)

### 3. **Files Updated**:
   - ✅ `src/lib/api-client.ts` - Fixed all API endpoints
   - ✅ `src/components/TickerBar.tsx` - Now uses BFF
   - ✅ `src/components/pages/HomePage.tsx` - Now uses BFF

---

## 📋 Deployment Steps

### Step 1: Push Code to GitHub

**EASIEST WAY - Use GitHub Desktop:**
1. Open GitHub Desktop
2. You'll see your changes ready to push
3. Click "Push origin"
4. Done! ✅

**OR Use VS Code:**
1. Open Source Control panel (left sidebar)
2. Click "..." → "Push"
3. Done! ✅

**OR Use GitHub CLI:**
```bash
gh auth login
git push -u origin main
```

**OR Use Git Command Line (requires token):**
```bash
# First time only: Create token at https://github.com/settings/tokens
git push https://YOUR_TOKEN@github.com/LegendaryTunzeverywhere/NimPay_AI_Agent.git main
```

---

### Step 2: Update Vercel Environment Variables

Go to your Vercel dashboard: https://vercel.com/

**REMOVE These Variables:**
- ❌ `NEXT_PUBLIC_API_URL` (THIS IS THE KEY ONE!)
- ❌ `NEXT_PUBLIC_API_SECRET` (if it exists)

**ADD/UPDATE These Variables:**
- ✅ `BACKEND_URL` = `https://nserver-production.up.railway.app`
- ✅ `API_SECRET` = `86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42`

**How to Update:**
1. Go to your project on Vercel
2. Click "Settings" tab
3. Click "Environment Variables" in left sidebar
4. Delete `NEXT_PUBLIC_API_URL`
5. Add `BACKEND_URL` and `API_SECRET`
6. Make sure they apply to "Production, Preview, Development"

---

### Step 3: Redeploy

**Option A: Auto-Deploy (Recommended)**
- Once you push to GitHub, Vercel will auto-deploy
- Wait 2-3 minutes for build to complete
- Check deployment status in Vercel dashboard

**Option B: Manual Deploy**
1. Go to "Deployments" tab in Vercel
2. Click "..." on latest deployment
3. Click "Redeploy"
4. Wait for build to complete

---

### Step 4: Verify Production is Working

Open your browser console on https://nimhub.vercel.app and check:

**✅ GOOD - You should see:**
```
[BFF] GET https://nserver-production.up.railway.app/nim-price?currency=usd
[BFF] GET https://nserver-production.up.railway.app/balances/NQ75...
```

**❌ BAD - If you still see:**
```
GET http://localhost:3000/api/nim-price  (ERR_CONNECTION_REFUSED)
GET /api/api/balances  (502 Bad Gateway)
```
→ Vercel didn't auto-deploy. Go to Step 3 Option B and manually redeploy.

---

### Step 5: Test Key Features

1. **Connect Wallet** → Should show balance
2. **Check Ticker** → Should show NIM price
3. **View History** → Should load transactions
4. **Try AI Chat** → Should respond

---

## 🔒 Security Status After Deployment

### BEFORE (Insecure ❌):
```
Browser → Railway (secret exposed in JS)
https://nimhub.vercel.app → https://nserver-production.up.railway.app
```

### AFTER (Secure ✅):
```
Browser → Vercel (Next.js) → Railway (secret on server)
https://nimhub.vercel.app → /api/nim-price → Railway
```

---

## 🐛 Troubleshooting

### Still seeing 502 errors?
- Check Vercel environment variables (Step 2)
- Make sure you removed `NEXT_PUBLIC_API_URL`
- Redeploy manually

### Still seeing localhost errors?
- Old code is deployed. Push to GitHub (Step 1)
- Wait for auto-deploy or manually redeploy (Step 3)

### Railway returns 401 Unauthorized?
- Check `API_SECRET` in Vercel matches Railway
- Check Railway logs to see what IP is calling

### BFF not working locally?
```bash
# Make sure these are in your .env.local:
BACKEND_URL=https://nserver-production.up.railway.app
API_SECRET=86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42
```

---

## 📊 Before & After Comparison

### Error Log BEFORE:
```
❌ /api/api/balances/NQ75... → 502 Bad Gateway
❌ localhost:3000/api/nim-price → ERR_CONNECTION_REFUSED
❌ API secret visible in browser source code
```

### Expected Log AFTER:
```
✅ /api/balances/NQ75... → 200 OK
✅ /api/nim-price → 200 OK
✅ API secret never leaves server
```

---

## 📞 Final Check

After deployment, run this test:

```bash
# Test 1: BFF should work (200 OK)
curl https://nimhub.vercel.app/api/nim-price?currency=usd

# Test 2: Direct Railway should fail (401 Unauthorized)
curl https://nserver-production.up.railway.app/api/nim-price?currency=usd
```

---

## ✅ Success Criteria

- [ ] Code pushed to GitHub
- [ ] `NEXT_PUBLIC_API_URL` removed from Vercel
- [ ] `BACKEND_URL` and `API_SECRET` added to Vercel
- [ ] Vercel deployed successfully
- [ ] No 502 errors in browser console
- [ ] No localhost errors in browser console
- [ ] Wallet balance loads correctly
- [ ] NIM price shows in ticker
- [ ] AI chat responds

---

🎉 **Once all checkboxes are complete, your security fix is live!**
