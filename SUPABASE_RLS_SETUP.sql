-- ============================================
-- SUPABASE ROW LEVEL SECURITY (RLS) SETUP
-- ============================================
-- Comprehensive RLS setup for NimHub production
-- Based on actual schema from n_server/schema.sql
--
-- Run this in your Supabase SQL Editor:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Paste and run this script
--
-- IMPORTANT: This assumes you're using JWT authentication with wallet_address in claims
-- If using service_role key (recommended), RLS is bypassed automatically

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_history ENABLE ROW LEVEL SECURITY;

-- Enhanced security tables (if they exist)
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quote_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rate_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_entities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP EXISTING POLICIES (clean slate)
-- ============================================

-- Transactions policies
DROP POLICY IF EXISTS "Users see own transactions" ON transactions;
DROP POLICY IF EXISTS "Users insert own transactions" ON transactions;
DROP POLICY IF EXISTS "public read" ON transactions;
DROP POLICY IF EXISTS "public write" ON transactions;

-- Orders policies
DROP POLICY IF EXISTS "Users see own orders" ON orders;
DROP POLICY IF EXISTS "Users insert own orders" ON orders;
DROP POLICY IF EXISTS "Users update own orders" ON orders;
DROP POLICY IF EXISTS "public read" ON orders;
DROP POLICY IF EXISTS "public write" ON orders;

-- Chat history policies
DROP POLICY IF EXISTS "Users see own chat history" ON chat_history;
DROP POLICY IF EXISTS "Users insert own chat history" ON chat_history;
DROP POLICY IF EXISTS "Users delete own chat history" ON chat_history;
DROP POLICY IF EXISTS "public read" ON chat_history;
DROP POLICY IF EXISTS "public write" ON chat_history;

-- ============================================
-- 3. TRANSACTIONS TABLE POLICIES
-- ============================================

-- Users can see transactions where they are the sender OR receiver
CREATE POLICY "Users see own transactions"
ON transactions
FOR SELECT
USING (
  -- Normalize addresses (remove spaces) for comparison
  REPLACE(from_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
  OR
  REPLACE(to_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can insert transactions where they are the sender
CREATE POLICY "Users insert own transactions"
ON transactions
FOR INSERT
WITH CHECK (
  REPLACE(from_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- ============================================
-- 4. ORDERS TABLE POLICIES
-- ============================================

-- Users can see their own orders (gift cards, airtime, bills)
-- CRITICAL: This protects orders.fulfillment_data (gift card codes/PINs)
CREATE POLICY "Users see own orders"
ON orders
FOR SELECT
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can insert their own orders
CREATE POLICY "Users insert own orders"
ON orders
FOR INSERT
WITH CHECK (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can update their own orders (for status changes)
CREATE POLICY "Users update own orders"
ON orders
FOR UPDATE
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- ============================================
-- 5. CHAT_HISTORY TABLE POLICIES
-- ============================================

-- Users can see their own chat history
CREATE POLICY "Users see own chat history"
ON chat_history
FOR SELECT
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can insert their own chat messages
CREATE POLICY "Users insert own chat history"
ON chat_history
FOR INSERT
WITH CHECK (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can delete their own chat history (session cleanup)
CREATE POLICY "Users delete own chat history"
ON chat_history
FOR DELETE
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- ============================================
-- 6. VERIFY RLS IS ENABLED
-- ============================================

-- Run this to verify all tables have RLS enabled:
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('transactions', 'orders', 'chat_history', 'audit_log', 'quote_cache', 'rate_limit', 'blocked_entities');

-- Expected output: All should show rowsecurity = true

-- ============================================
-- 7. TEST RLS POLICIES
-- ============================================

-- Test with a sample wallet address:
-- SET request.jwt.claims TO '{"wallet_address": "NQ75UB042A5UPCUR7VNRF73JTP2CQ9UDYB16"}';
-- SELECT * FROM transactions;
-- SELECT * FROM orders;
-- SELECT * FROM chat_history;

-- You should only see rows for that wallet address.

-- ============================================
-- 8. PRODUCTION RECOMMENDATION
-- ============================================

-- For maximum security (recommended for production):
-- 1. Use service_role key in backend (bypasses RLS automatically)
-- 2. NEVER expose service_role key to frontend
-- 3. Keep RLS enabled with these policies as a safety net
--
-- In n_server/server/.env:
--   SUPABASE_KEY=<your_service_role_secret_key>
--
-- Get service_role key from:
-- Supabase Dashboard > Project Settings > API > service_role secret

-- Alternative: If using JWT authentication from frontend:
-- 1. These policies will enforce wallet_address matching
-- 2. Backend should set JWT claims with authenticated wallet_address
-- 3. Frontend uses anon/publishable key

-- ============================================
-- NOTES:
-- ============================================
-- 1. JWT claims method: Policies use wallet_address from JWT
-- 2. All addresses normalized (spaces removed) for comparison
-- 3. Transactions: Users see if they're sender OR receiver
-- 4. Orders: Critical for protecting fulfillment_data (gift codes)
-- 5. Chat history: Users see only their conversation
-- 6. Service role key bypasses ALL RLS (use for backend)
-- 7. Enhanced security tables protected but have no specific policies
--    (only service_role should access them)
