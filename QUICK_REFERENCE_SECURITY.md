# Security Features - Quick Reference Card

## 🚀 Deployment (3 Steps)

```bash
# 1. Database (Supabase SQL Editor)
Run: n_server/ENHANCED_SECURITY_SCHEMA.sql

# 2. Backend
cd n_server/server && node index.js

# 3. Frontend
npm run build && npm start
```

## 🔍 Quick Checks

### Is it working?
```bash
# Check server logs
[SECURITY] Enhanced security features enabled ✓

# Check database
SELECT COUNT(*) FROM audit_log;  # Should have entries
SELECT COUNT(*) FROM quote_cache;  # Should have quotes
```

### Test rate limiting
```bash
# Make 21 requests in 1 minute
# 21st should return: "Rate limit exceeded"
```

### Test quote expiry
```bash
# 1. Create quote
# 2. Wait 61 seconds
# 3. Try to use it
# Expected: "Quote has expired"
```

## 📊 Monitoring Queries

```sql
-- Security incidents (last 24h)
SELECT * FROM recent_security_incidents;

-- Top offenders
SELECT * FROM top_offenders;

-- Rate limit status
SELECT * FROM rate_limit_status;

-- Active quotes
SELECT COUNT(*) FROM quote_cache 
WHERE expires_at > now() AND NOT used;
```

## 🛠️ Common Operations

### Block a wallet
```sql
INSERT INTO blocked_entities (identifier, identifier_type, reason, blocked_by)
VALUES ('NQ...', 'wallet', 'Reason', 'admin');
```

### Unblock a wallet
```sql
DELETE FROM blocked_entities WHERE identifier = 'NQ...';
```

### Clear rate limits (emergency)
```sql
DELETE FROM rate_limit WHERE identifier = 'NQ...';
```

### Manual cleanup
```sql
SELECT cleanup_expired_quotes();
SELECT cleanup_old_rate_limits();
SELECT cleanup_old_audit_logs();
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Table audit_log does not exist" | Run ENHANCED_SECURITY_SCHEMA.sql |
| Rate limiting not working | Check if walletAddress is passed |
| Quotes not expiring | Check periodic cleanup is running |
| UI amount not locked | Verify isOrder is true |

## 📈 Performance Targets

- Validation: <150ms
- Order creation: <300ms
- Security queries: <10ms
- Cleanup: <1s per hour

## 🔐 Security Layers (13 Total)

1. ✅ Server-side pricing
2. ✅ 10% volatility buffer
3. ✅ On-chain verification
4. ✅ Replay protection
5. ✅ Recipient verification
6. ✅ Amount verification
7. ✅ UI lock (immediate)
8. ✅ AI anti-manipulation
9. ✅ Rate limiting
10. ✅ Quote expiry
11. ✅ Audit logging
12. ✅ Entity blocking
13. ✅ Periodic cleanup

## 📞 Emergency Contacts

- Database issues → Supabase support
- Server issues → Check logs
- Security incidents → Check audit_log

## 🎯 Success Metrics

- ✅ Build: No errors
- ✅ Tests: All passing
- ✅ Logs: Security events tracked
- ✅ Performance: <300ms total
- ✅ Uptime: 99.9%+

---

**Status**: PRODUCTION READY ✓  
**Last Updated**: 2026-06-01
