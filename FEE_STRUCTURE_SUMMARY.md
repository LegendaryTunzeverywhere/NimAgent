# Fee Structure - Complete Summary

## ✅ Changes Completed

### 1. **Crypto Swap Fees: REMOVED** (Now 0%)

**File**: `n_server/server/crypto-swap.js`

**Before**:
```javascript
const fee = btcAmount * 0.01; // 1% fee
const fee = nimAmount * 0.01; // 1% fee
```

**After**:
```javascript
const fee = 0; // No fee for crypto swaps
feePercent: 0
```

**Impact**:
- NIM ↔ BTC swaps are now **feeless**
- Users get exact exchange rate amount
- More competitive vs other exchanges
- UI will show "Network Fee: 0 BTC (0%)"

---

### 2. **Bills/Airtime/Gift Cards: 1% Fee** (Confirmed)

**Files**: Reloadly integration (`n_server/server/reloadly.js`)

**How it works**:
1. User pays: `productAmount + (productAmount * 0.01)`
2. Sent to Reloadly: `productAmount` only
3. Fee kept: `productAmount * 0.01` (1%)

**Example**:
- Gift card costs: $25
- User pays: $25 + $0.25 = **$25.25 worth of NIM**
- Sent to Reloadly: **$25** (to purchase gift card)
- Platform fee: **$0.25** (1%)

**Verification**:
The Reloadly functions (`orderGiftCard`, `sendTopup`, `payBill`) receive:
- `unitPrice` / `amount` = **product amount only**
- Fee is calculated separately in backend
- Reloadly API never sees the fee

---

### 3. **Supabase Row Level Security (RLS)**

**File**: `SUPABASE_RLS_SETUP.sql`

**What it does**:
- Enables RLS on all tables (transactions, orders, chat_messages, chat_sessions)
- Creates policies so users only see their own data
- Normalizes wallet addresses (removes spaces) for comparison
- Protects against data leaks even if frontend has bugs

**How to apply**:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Paste and run `SUPABASE_RLS_SETUP.sql`
5. Verify with the included test queries

**Policies created**:
```sql
-- Transactions: Users see if they're sender OR receiver
CREATE POLICY "Users see own transactions" ON transactions FOR SELECT
USING (
  REPLACE(from_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
  OR
  REPLACE(to_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Orders: Users see only their orders
CREATE POLICY "Users see own orders" ON orders FOR SELECT
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Similar policies for chat_messages and chat_sessions
```

---

## 📊 Fee Structure Summary

| Service | Fee | Notes |
|---------|-----|-------|
| **Crypto Swaps** (NIM ↔ BTC) | **0%** | Feeless exchange |
| **Gift Cards** | **1%** | Platform fee, product amount to Reloadly |
| **Airtime Top-up** | **1%** | Platform fee, product amount to Reloadly |
| **Bill Payments** | **1%** | Platform fee, product amount to Reloadly |
| **NIM Transfers** | **0 Luna** | Always feeless (Nimiq native feature) |

---

## 🔒 Security Implementation

### Current State:
✅ Backend URLs concealed  
✅ API secrets never exposed  
✅ Multi-tier price API fallbacks  
✅ AI chat rate limiting (2s)  
✅ Fee structure correct (0% swaps, 1% commerce)  

### To Be Implemented:
⚠️ **Supabase RLS** - Run `SUPABASE_RLS_SETUP.sql` in your Supabase SQL Editor

---

## 🎯 How Fees Work in Practice

### **Scenario 1: User buys $25 Amazon gift card**

1. **Frontend** calculates:
   - Product: $25
   - Fee (1%): $0.25
   - Total: $25.25
   - Converts to NIM at current rate

2. **User pays**: ~50.5 NIM (if 1 NIM = $0.50)

3. **Backend**:
   - Receives: 50.5 NIM
   - Sends to Reloadly: **$25 worth** (50 NIM)
   - Keeps as fee: **$0.25 worth** (0.5 NIM)

4. **Reloadly**:
   - Receives: $25
   - Issues: $25 Amazon gift card
   - Returns: Gift card code/PIN

5. **User receives**: $25 Amazon gift card code

---

### **Scenario 2: User swaps 100 NIM for BTC**

1. **Frontend** calculates:
   - Rate: 1 NIM = 0.00000002 BTC
   - Expected BTC: 0.000002 BTC
   - Fee: **0 BTC** (0%)

2. **User gets**: Exactly 0.000002 BTC

3. **No platform fee taken**

---

## 📝 Files Modified

1. `n_server/server/crypto-swap.js` - Removed swap fees
2. `SUPABASE_RLS_SETUP.sql` - Created RLS policies

**Commit**: `2e0f40c` - "Remove fees from crypto swaps (now 0%), keep 1% fee for bills/airtime/gift-cards, add Supabase RLS SQL"

---

## 🚀 Deployment Status

- ✅ Changes pushed to GitHub
- ✅ Auto-deploying to Vercel (frontend) and Railway (backend)
- ⚠️ **Manual action needed**: Run `SUPABASE_RLS_SETUP.sql` in Supabase

---

## ✅ Verification Checklist

After deployment:
- [ ] Test crypto swap shows 0% fee
- [ ] Test gift card purchase shows 1% fee
- [ ] Verify only product amount goes to Reloadly
- [ ] Run `SUPABASE_RLS_SETUP.sql` in Supabase
- [ ] Test users can only see their own transactions
- [ ] Test received transactions appear in history

---

**All fee structure fixes complete!** 🎉
