#!/usr/bin/env node

/**
 * Generate a secure random API key for NimAgent
 * 
 * Usage: node generate-api-key.js
 * 
 * This will generate a cryptographically secure random key
 * that you can use for API_SECRET in your environment variables.
 */

const crypto = require('crypto');

function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('\n🔐 NimAgent API Key Generator\n');
console.log('━'.repeat(60));
console.log('\nGenerated API Secret:');
console.log('\x1b[32m%s\x1b[0m', generateApiKey());
console.log('\n━'.repeat(60));
console.log('\n📋 Setup Instructions:\n');
console.log('1. Next.js server env (.env.local or Vercel project env):');
console.log('   API_SECRET=<paste_the_key_above>');
console.log('\n2. Backend (server/.env or Railway project env):');
console.log('   API_SECRET=<paste_the_same_key>');
console.log('\n⚠️  IMPORTANT: Keep this server-side only. Do NOT use NEXT_PUBLIC_API_SECRET.');
console.log('\n💡 TIP: For production, set these in:');
console.log('   - Vercel: Project Settings → Environment Variables');
console.log('   - Railway: Project → Variables');
console.log('\n');
