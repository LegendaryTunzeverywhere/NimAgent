# 🔍 Check if Vercel Has Environment Variables

## Wait 2-3 minutes for deployment, then run:

```bash
curl.exe https://nimhub.vercel.app/api/health
```

---

## ✅ GOOD Response (Variables ARE set):

```json
{
  "status": "ok",
  "timestamp": "2026-06-01T23:45:00.000Z",
  "env": {
    "BACKEND_URL": "configured",
    "API_SECRET": "configured",
    "API_SECRET_preview": "86487cca...",
    "BACKEND_URL_value": "https://nserver-production.up.railway.app"
  }
}
```

**If you see this:** Environment variables are set correctly! The 502 errors should be gone.

---

## ❌ BAD Response (Variables are NOT set):

```json
{
  "status": "ok",
  "timestamp": "2026-06-01T23:45:00.000Z",
  "env": {
    "BACKEND_URL": "MISSING",
    "API_SECRET": "MISSING",
    "API_SECRET_preview": "MISSING",
    "BACKEND_URL_value": "MISSING"
  }
}
```

**If you see this:** You need to add environment variables to Vercel NOW!

---

## 🚨 IF VARIABLES ARE MISSING - DO THIS:

### 1. Go to Vercel
- Open: https://vercel.com
- Click your project
- Click **Settings** → **Environment Variables**

### 2. Add These 2 Variables:

**BACKEND_URL:**
```
Name: BACKEND_URL
Value: https://nserver-production.up.railway.app
Environments: ✓ Production ✓ Preview ✓ Development
```

**API_SECRET:**
```
Name: API_SECRET  
Value: 86487ccafcc77a9375e71c19cc765bcd616f9dcfbe077ccdea0535f158a18e42
Environments: ✓ Production ✓ Preview ✓ Development
```

### 3. Redeploy
- Go to **Deployments** tab
- Click latest deployment → "..." → **Redeploy**
- Wait 2-3 minutes

### 4. Test Again
```bash
curl.exe https://nimhub.vercel.app/api/health
curl.exe https://nimhub.vercel.app/api/nim-price?currency=usd
```

---

## 📊 Current Status:

- ✅ Code is deployed
- ✅ BFF is working
- ❓ **Environment variables** - CHECK WITH HEALTH ENDPOINT
- ❓ **502 errors** - Will be fixed once env vars are set

---

## 🎯 Summary:

The health endpoint will tell you **exactly** if Vercel has the environment variables or not.

**Run this in 2-3 minutes:**
```bash
curl.exe https://nimhub.vercel.app/api/health
```

Then we'll know what to do next! 🚀
