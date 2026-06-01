# 🚨 URGENT: Set Vercel Environment Variables

## The Problem:
Your BFF is deployed and working, but it's calling Railway **WITHOUT the API secret** because Vercel doesn't have the environment variables configured.

---

## 📋 STEP-BY-STEP INSTRUCTIONS:

### 1. Go to Vercel Dashboard
- Open: **https://vercel.com**
- Click on your project (NimPay_AI_Agent or similar)

### 2. Navigate to Settings
- Click **"Settings"** tab (top navigation)
- Click **"Environment Variables"** in left sidebar

### 3. Add These Variables

**Variable 1: BACKEND_URL**
```
Name: BACKEND_URL
Value: https://nserver-production.up.railway.app
Environments: ✓ Production  ✓ Preview  ✓ Development
```
Click "Save"

**Variable 2: API_SECRET**
```
Name: API_SECRET
Value: 86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42
Environments: ✓ Production  ✓ Preview  ✓ Development
```
Click "Save"

### 4. Delete Old Variables (if they exist)

Look for and DELETE these:
- ❌ `NEXT_PUBLIC_API_URL`
- ❌ `NEXT_PUBLIC_API_SECRET`

(They start with NEXT_PUBLIC_ which exposes them to the browser)

### 5. Redeploy

After adding variables:
- Go to **"Deployments"** tab
- Click on the latest deployment
- Click **"..."** (three dots menu)
- Click **"Redeploy"**
- Wait 2-3 minutes

---

## ✅ How to Verify It Worked:

After redeployment completes, run:

```bash
curl.exe https://nimhub.vercel.app/api/nim-price?currency=usd
```

**✅ SHOULD RETURN:**
```json
{"price":0.00051728,"currency":"usd"}
```

**❌ CURRENTLY RETURNS:**
```json
{"error":"Failed to fetch from backend","message":"Unexpected token '<'..."}
```

---

## 🎯 Why This Happens:

1. Vercel environment variables are **separate** from your local `.env.local`
2. When you deploy, Vercel doesn't automatically copy your local env vars
3. The BFF code uses `process.env.API_SECRET` which is empty on Vercel
4. Empty API key → Railway returns 401 → HTML error page → JSON parse error

---

## 📸 Screenshot Guide:

**Environment Variables page should look like:**

```
┌─────────────────┬──────────────────────────────────────────┬────────────────────────┐
│ NAME            │ VALUE                                    │ ENVIRONMENTS           │
├─────────────────┼──────────────────────────────────────────┼────────────────────────┤
│ BACKEND_URL     │ https://nserver-production.up.railway... │ Prod, Preview, Dev     │
│ API_SECRET      │ 86487ccafcc77a9375e71c19cc765bcd616f9... │ Prod, Preview, Dev     │
└─────────────────┴──────────────────────────────────────────┴────────────────────────┘
```

---

## 🆘 Troubleshooting:

### "I added the variables but still getting errors"
→ You MUST redeploy after adding env vars. Variables don't apply to existing deployments.

### "I don't see the Settings tab"
→ Make sure you're logged into the correct Vercel account
→ Make sure you're viewing the correct project

### "Where do I find the API_SECRET value?"
→ It's in your local `.env.local` file
→ Or use: `86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42`

### "Still getting 502 after setting env vars"
→ Clear browser cache (Ctrl+Shift+R)
→ Check Vercel logs: Deployments → Latest → Runtime Logs
→ Look for: `[BFF] API_SECRET not configured` warning

---

## 🎉 After Setup:

Once environment variables are set and redeployed:
- ✅ Wallet will connect
- ✅ Balance will load
- ✅ NIM price will display
- ✅ No more 502 errors
- ✅ Production is secure (API secret not exposed to browser)

---

**Do this NOW to fix the 502 errors!** 🚀
