# Deployment Checklist - Critical Fixes

## Date: 2026-07-22

## ✅ All Fixes Completed

### 1. Transaction Verification & Recording
- [x] Extended BFF timeout to 120s
- [x] Added progressive status updates during verification
- [x] Improved timeout error handling with transaction hash
- [x] Better error messages for network issues

### 2. Session Cookie Issues
- [x] Added diagnostic logging for cookie forwarding
- [x] Created debug endpoint `/api/debug/session`
- [x] Improved auth failure logging
- [x] Created troubleshooting documentation

### 3. Missing QuoteId (CRITICAL)
- [x] Frontend now passes quoteId to createOrder
- [x] Added logging for quote submission
- [x] Prevents price mismatch issues

### 4. Malformed RPC Requests
- [x] All RPC calls now include `jsonrpc: "2.0"` and `id`
- [x] Added `getTransactionsByAddress` to allowed methods
- [x] Better error messages for invalid requests

### 5. Reloadly Balance Check (CRITICAL!)
- [x] Balance check is now advisory only
- [x] Orders are ALWAYS recorded, even if balance is insufficient
- [x] Failed orders are marked as `failed_needs_refund`
- [x] Refund process is automatically triggered

---

## 🚨 CRITICAL: Pre-Deployment Actions

### **BEFORE** Deploying:

1. **Top Up Reloadly Account** (HIGHEST PRIORITY!)
   - Current balance: $0
   - Minimum required: $100
   - Recommended: $500+
   - URL: https://www.reloadly.com/
   - **WHY**: Without balance, all orders will be marked for refund

2. **Review Recent Failed Orders**
   ```sql
   SELECT 
     id, type, tx_hash, amount_luna, 
     wallet_address, created_at,
     fulfillment_data->>'error' as error
   FROM orders 
   WHERE status = 'failed_needs_refund'
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

3. **Check for Orphaned Transactions**
   - Users who paid but got 503 error
   - Transaction succeeded on-chain but no order record
   - These need manual refund orders created

---

## 📦 Deployment Steps

### 1. Test Locally (if possible)
```bash
# Frontend
npm run build
npm start

# Backend
npm start
```

### 2. Commit and Push
```bash
git add .
git commit -m "CRITICAL: Fix lost NIM + missing quoteId + RPC errors + session issues

- Fix Reloadly balance check to record orders even when insufficient
- Add quoteId to order creation to prevent price mismatch
- Fix RPC requests to include jsonrpc and id fields
- Add session cookie diagnostic logging
- Improve timeout error handling
- All orders now recorded and refunded if unfulfillable"

git push origin main
```

### 3. Deploy to Production
- **Vercel** (Frontend): Auto-deploys from GitHub
- **Railway** (Backend): Auto-deploys from GitHub
- Wait for both deployments to complete

### 4. Verify Deployment
```bash
# Check frontend
curl https://www.nimagent.online/api/debug/session

# Check backend
curl https://your-backend.railway.app/health
```

---

## 🔍 Post-Deployment Testing

### Test 1: Session Persistence
1. Open NimAgent in Nimiq Pay
2. Connect wallet
3. Run in browser console: `document.cookie`
4. Should see: `nimagent_session=...`
5. Reload page
6. Should still be connected ✅

### Test 2: RPC Calls
1. Connect wallet
2. Check balance loads without 400 errors
3. Backend logs should show:
   ```
   POST 200 /api/nimiq-rpc
   ```

### Test 3: Order with Insufficient Balance
1. **Setup**: Ensure Reloadly balance = $0 (or skip this test if already topped up)
2. Create a small order (₦100 airtime)
3. Complete payment
4. **Expected Result**:
   ```
   ✅ Order created (status: failed_needs_refund)
   ✅ Transaction recorded
   ✅ User sees: "Refund will be processed within 24 hours"
   ✅ Order appears in database
   ```
5. **Verify in database**:
   ```sql
   SELECT * FROM orders 
   WHERE tx_hash = '<transaction_hash>'
   AND status = 'failed_needs_refund';
   ```

### Test 4: Order with Sufficient Balance
1. **Setup**: Top up Reloadly to at least $100
2. Create a test order (₦100 airtime)
3. Complete payment
4. **Expected Result**:
   ```
   ✅ Payment confirmed
   ✅ Order fulfilled
   ✅ Status: completed
   ✅ User receives airtime/code
   ```

### Test 5: QuoteId Verification
1. Create any order (airtime/gift card)
2. Check backend logs:
   ```
   [Order Submission] Sending order with quoteId: <actual_quote_id>
   [Order Creation] Incoming request: { quoteId: '<actual_quote_id>' }
   ```
3. Should NOT see: `quoteId: 'MISSING'` ❌

---

## 📊 Monitoring

### Backend Logs to Watch

**Good Signs** (Everything working):
```
[BFF] Forwarding session cookie to backend
[Order Submission] Sending order with quoteId: <quote_id>
[Order Creation] Incoming request: { quoteId: '<quote_id>' }
[Reloadly Balance] Sufficient: 500 > 0.49
[Order] Payment confirmed!
POST 200 /api/nimiq-rpc
```

**Warning Signs** (Issues detected):
```
[BFF] No session cookie found in request
[Order Creation] Incoming request: { quoteId: 'MISSING' }
[Reloadly Balance] Insufficient: 0 < 10.07
[RPC Proxy] Invalid request structure
```

**Critical Signs** (Manual intervention needed):
```
[Order] Cannot fulfill - Reloadly balance insufficient
[Order XXX] Updated to status: failed_needs_refund
[Auth] No session cookie found
```

### Metrics to Track

1. **Order Success Rate**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
   FROM orders
   WHERE created_at > NOW() - INTERVAL '1 day'
   GROUP BY status;
   ```

2. **Failed Orders Needing Refunds**
   ```sql
   SELECT COUNT(*) as pending_refunds
   FROM orders
   WHERE status = 'failed_needs_refund'
     AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Average Order Completion Time**
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
   FROM orders
   WHERE status = 'completed'
     AND completed_at > NOW() - INTERVAL '1 day';
   ```

---

## 🚑 Rollback Plan (If Needed)

If critical issues occur after deployment:

### Quick Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or rollback specific commit
git revert <commit_hash>
git push origin main
```

### Issues That Warrant Rollback
- Orders not being recorded at all
- Users losing NIM without any record
- Complete session failure (nobody can login)
- Backend crashes on order creation

### Issues That DON'T Warrant Rollback
- Reloadly balance insufficient (just top up)
- Some RPC calls failing (users can retry)
- Session cookies not persisting for some users (investigate, don't rollback)

---

## 📞 Support Response Template

For users affected by the old bugs (lost NIM):

```
Hi [User],

We've identified that your payment was affected by a system issue that has now been fixed. Here's the status:

**Your Transaction:**
- Amount: [X] NIM
- TX Hash: [hash]
- Date: [date]
- View: https://nimiq.watch/#[hash]

**What Happened:**
Your payment was successful on the blockchain, but our system failed to record the order due to a service balance issue. This has been fixed.

**Refund Process:**
Your refund is being processed and will be sent to your wallet within 24 hours.

**Order ID:** [if created]
**Estimated Refund:** [X] NIM to [wallet_address]

We apologize for the inconvenience. Your funds are safe and the refund is being prioritized.

Thank you for your patience.
- NimAgent Team
```

---

## 📝 Documentation Updates

After successful deployment, update:

1. **README.md** - Mention new debug endpoint
2. **API_DOCS.md** - Document `/api/debug/session`
3. **ARCHITECTURE.md** - Update with refund flow
4. **TROUBLESHOOTING.md** - Add session debugging steps

---

## ✅ Final Checklist

Before marking this as complete:

- [ ] All code changes committed and pushed
- [ ] Reloadly account topped up (minimum $100)
- [ ] Both frontend and backend deployed
- [ ] Test order completed successfully
- [ ] Session persistence verified
- [ ] RPC calls working (no 400 errors)
- [ ] QuoteId being sent (check logs)
- [ ] Orders being recorded (even with low balance)
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Affected users identified and contacted

---

## 🎉 Success Criteria

Deployment is successful when:

1. ✅ Users can complete orders without errors
2. ✅ All payments are recorded, even if unfulfillable
3. ✅ Failed orders trigger refund process
4. ✅ Session persists across page reloads
5. ✅ RPC calls don't return 400 errors
6. ✅ Backend logs show quoteId (not MISSING)
7. ✅ No NIM is lost due to system errors

---

## 📊 Expected Improvements

After deployment, you should see:

- **0 orphaned transactions** (all payments recorded)
- **Reduced 503 errors** (balance topped up)
- **No 400 RPC errors** (JSON-RPC compliant)
- **No 401 session errors** (cookies forwarded)
- **100% payment recording** (even failed orders)

---

## 🔗 Useful Links

- Frontend: https://www.nimagent.online
- Backend: https://your-backend.railway.app
- Reloadly: https://www.reloadly.com
- Nimiq Explorer: https://nimiq.watch
- Debug Endpoint: https://www.nimagent.online/api/debug/session

---

## Questions?

If anything is unclear or you encounter issues:

1. Check `SESSION_TROUBLESHOOTING.md`
2. Check `REFUND_FIX.md`
3. Check `CRITICAL_FIXES.md`
4. Review backend logs for specific error messages
5. Test in staging environment if available

---

**Remember**: The most critical action is topping up Reloadly. Without balance, all orders will be marked for refund (which is better than losing NIM, but not ideal for users).

Good luck with the deployment! 🚀
