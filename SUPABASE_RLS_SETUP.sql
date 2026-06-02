-- ============================================
-- SUPABASE ROW LEVEL SECURITY (RLS) SETUP
-- ============================================
-- This SQL script enables Row Level Security on all NimHub tables
-- and creates policies to ensure users can only access their own data.
--
-- Run this in your Supabase SQL Editor:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Paste and run this script

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

-- Transactions table (NIM sends/receives)
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

-- Orders table (gift cards, airtime, bills)
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

-- Chat messages table
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat sessions table
ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP EXISTING POLICIES (if any)
-- ============================================

DROP POLICY IF EXISTS "Users see own transactions" ON transactions;
DROP POLICY IF EXISTS "Users insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users see own orders" ON orders;
DROP POLICY IF EXISTS "Users insert own orders" ON orders;
DROP POLICY IF EXISTS "Users update own orders" ON orders;
DROP POLICY IF EXISTS "Users see own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users insert own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users see own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users insert own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users delete own chat sessions" ON chat_sessions;

-- ============================================
-- 3. TRANSACTIONS TABLE POLICIES
-- ============================================

-- Users can see transactions where they are the sender OR receiver
CREATE POLICY "Users see own transactions"
ON transactions
FOR SELECT
USING (
  -- Remove spaces from addresses for comparison
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
-- 5. CHAT MESSAGES TABLE POLICIES
-- ============================================

-- Users can see their own chat messages
CREATE POLICY "Users see own chat messages"
ON chat_messages
FOR SELECT
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can insert their own chat messages
CREATE POLICY "Users insert own chat messages"
ON chat_messages
FOR INSERT
WITH CHECK (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- ============================================
-- 6. CHAT SESSIONS TABLE POLICIES
-- ============================================

-- Users can see their own chat sessions
CREATE POLICY "Users see own chat sessions"
ON chat_sessions
FOR SELECT
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can insert their own chat sessions
CREATE POLICY "Users insert own chat sessions"
ON chat_sessions
FOR INSERT
WITH CHECK (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- Users can delete their own chat sessions
CREATE POLICY "Users delete own chat sessions"
ON chat_sessions
FOR DELETE
USING (
  REPLACE(wallet_address, ' ', '') = REPLACE(current_setting('request.jwt.claims', true)::json->>'wallet_address', ' ', '')
);

-- ============================================
-- 7. VERIFY RLS IS ENABLED
-- ============================================

-- Run this to verify all tables have RLS enabled:
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('transactions', 'orders', 'chat_messages', 'chat_sessions');

-- Expected output: All should show rowsecurity = true

-- ============================================
-- 8. TEST RLS POLICIES
-- ============================================

-- Test with a sample wallet address:
-- SET request.jwt.claims TO '{"wallet_address": "NQ75UB042A5UPCUR7VNRF73JTP2CQ9UDYB16"}';
-- SELECT * FROM transactions;
-- SELECT * FROM orders;
-- SELECT * FROM chat_messages;
-- SELECT * FROM chat_sessions;

-- You should only see rows for that wallet address.

-- ============================================
-- NOTES:
-- ============================================
-- 1. This uses JWT claims to identify users by wallet_address
-- 2. All addresses are normalized (spaces removed) for comparison
-- 3. Transactions show if user is sender OR receiver
-- 4. All other tables filter by wallet_address ownership
-- 5. RLS policies are enforced at the database level - even if your app
--    has a bug, users cannot access other users' data
-- 6. For API key auth (server-side), you may need to set the JWT claim
--    in your backend before querying
