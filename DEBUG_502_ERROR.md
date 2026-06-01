# 🔍 DEBUG: 502 Bad Gateway Error

## What's Happening

Your BFF proxy is running ✅, but it's getting an error when calling Railway.

**Error from Vercel:**
```json
{"error":"Failed to fetch from backend","message":"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"}
```

This means:
- ✅ Your new code IS deployed to Vercel
- ✅ The BFF route exists at `/api/[...path]`
- ❌ But Railway is returning HTML (error page) instead of JSON
- ❌ Most likely cause: **Missing or incorrect environment variables in Vercel**

---

## 🎯 THE FIX

### Step 1: Did you push your code to GitHub?

Check your GitHub repo: https://github.com/LegendaryTunzeverywhere/NimPay_AI_Agent

**Look for these commits:**
- "Fix BFF double /api path issue and remove NEXT_PUBLIC_API_URL dependencies"
- "Add deployment checklist for security fix"

**If NOT there:**
```bash
# Push now:
git push -u origin main
# Or use GitHub Desktop
```

### Step 2: Check Vercel Environment Variables

Go to: **https://vercel.com** → Your Project → **Settings** → **Environment Variables**

**MUST HAVE (exactly as shown):**

```
BACKEND_URL = https://nserver-production.up.railway.app
```
*(No trailing slash!)*

```
API_SECRET = 86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42
```

**MUST DELETE (if exists):**
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_SECRET`

### Step 3: Check These Settings

When you add the variables, make sure:
- ✅ "Production" is checked
- ✅ "Preview" is checked  
- ✅ "Development" is checked

### Step 4: Redeploy

After adding/fixing variables:
1. Go to **Deployments** tab
2. Click latest deployment
3. Click **"..."** menu → **"Redeploy"**
4. Wait 2-3 minutes

---

## 🧪 How to Test If It's Fixed

### Test 1: Check the BFF endpoint
```bash
curl.exe https://nimhub.vercel.app/api/nim-price?currency=usd
```

**✅ GOOD (Should return):**
```json
{"price":0.0621,"change24h":3.14}
```

**❌ BAD (Still broken):**
```json
{"error":"Failed to fetch from backend"...}
```

### Test 2: Check Vercel logs

1. Go to Vercel dashboard
2. Click on your deployment
3. Click "Runtime Logs" tab
4. Look for errors like:
   - `[BFF] GET https://nserver-production.up.railway.app/nim-price`
   - `Error: getaddrinfo ENOTFOUND` (means BACKEND_URL not set)
   - `401 Unauthorized` (means API_SECRET not set)

---

## 🔧 Common Issues

### Issue: "Still getting 502 after setting env vars"
**Solution:** You need to redeploy after changing environment variables. They don't apply to existing deployments.

### Issue: "I set BACKEND_URL but still getting errors"
**Solution:** Make sure there's NO trailing slash. Use:
- ✅ `https://nserver-production.up.railway.app`
- ❌ `https://nserver-production.up.railway.app/`

### Issue: "Vercel logs show 'BACKEND_URL is undefined'"
**Solution:** 
1. Make sure you're adding it as a server-side variable (NOT `NEXT_PUBLIC_*`)
2. Redeploy after adding
3. Check if you're looking at the right project

### Issue: "I see old code deployed"
**Solution:**
1. Check GitHub - are your commits there?
2. Check Vercel - does it show "Failed" deployment?
3. Manually trigger redeploy

---

## 📋 Checklist Before Asking for Help

- [ ] I pushed my code to GitHub (`git push -u origin main`)
- [ ] I can see my commits on GitHub.com
- [ ] I added `BACKEND_URL` to Vercel (no trailing slash)
- [ ] I added `API_SECRET` to Vercel
- [ ] I deleted `NEXT_PUBLIC_API_URL` from Vercel (if it existed)
- [ ] I redeployed after changing env vars
- [ ] I waited 3-5 minutes for deployment to complete
- [ ] I cleared browser cache (Ctrl+Shift+R)

---

## 📸 Send Me Screenshots Of:

If still broken, send screenshots of:

1. **Vercel Environment Variables page** (Settings → Environment Variables)
2. **Vercel deployment logs** (Latest deployment → Runtime Logs)
3. **Browser console error** (F12 → Console tab → the 502 error)
4. **GitHub commits page** (to verify code was pushed)

This will help me see exactly what's wrong!
