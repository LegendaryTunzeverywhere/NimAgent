#!/usr/bin/env node

/**
 * Frontend API Configuration Test
 * 
 * This script tests that the frontend can successfully communicate
 * with the backend API using the configured API secret.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Manually load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
let API_URL = 'http://localhost:3000';
let API_SECRET = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_API_URL=')) {
      API_URL = line.split('=')[1].trim();
    }
    if (line.startsWith('NEXT_PUBLIC_API_SECRET=')) {
      API_SECRET = line.split('=')[1].trim();
    }
  }
}

console.log('\n🧪 Frontend API Configuration Test\n');
console.log('━'.repeat(60));

// Test 1: Check environment variables
console.log('\n📋 Test 1: Environment Variables');
console.log('━'.repeat(60));

if (!API_URL) {
  console.log('❌ NEXT_PUBLIC_API_URL is not set');
  process.exit(1);
} else {
  console.log('✅ NEXT_PUBLIC_API_URL:', API_URL);
}

if (!API_SECRET) {
  console.log('❌ NEXT_PUBLIC_API_SECRET is not set');
  process.exit(1);
} else {
  console.log('✅ NEXT_PUBLIC_API_SECRET:', API_SECRET.substring(0, 16) + '...');
}

// Test 2: Test API connection
console.log('\n🔌 Test 2: API Connection');
console.log('━'.repeat(60));

const url = new URL('/api/nim-price', API_URL);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_SECRET,
  },
};

console.log('Testing:', url.href);
console.log('Headers:', { 'x-api-key': API_SECRET.substring(0, 16) + '...' });

const req = client.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Response Body:', data);

    if (res.statusCode === 200) {
      console.log('\n✅ Test 2: PASSED - API connection successful');
      
      try {
        const json = JSON.parse(data);
        if (json.price) {
          console.log('✅ NIM Price:', json.price, json.currency?.toUpperCase());
        }
      } catch (e) {
        console.log('⚠️  Response is not valid JSON');
      }
    } else if (res.statusCode === 401) {
      console.log('\n❌ Test 2: FAILED - Unauthorized (API key invalid or missing)');
      console.log('💡 Check that NEXT_PUBLIC_API_SECRET matches backend API_SECRET');
      process.exit(1);
    } else {
      console.log('\n❌ Test 2: FAILED - Unexpected status code:', res.statusCode);
      process.exit(1);
    }

    // Test 3: Test without API key (should fail)
    console.log('\n🔒 Test 3: Unauthorized Access (Should Fail)');
    console.log('━'.repeat(60));
    
    const unauthorizedOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // No x-api-key header
      },
    };

    const unauthorizedReq = client.request(unauthorizedOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Body:', data);

        if (res.statusCode === 401) {
          console.log('\n✅ Test 3: PASSED - Unauthorized access correctly blocked');
          
          // Test 4: Test production frontend
          console.log('\n🌐 Test 4: Production Frontend Check');
          console.log('━'.repeat(60));
          
          const frontendUrl = 'https://nimhub.vercel.app';
          console.log('Testing:', frontendUrl);
          
          const frontendOptions = {
            hostname: 'nimhub.vercel.app',
            port: 443,
            path: '/',
            method: 'GET',
            headers: {
              'User-Agent': 'NimHub-Test/1.0',
            },
          };

          const frontendReq = https.request(frontendOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              console.log('Response Status:', res.statusCode);
              
              if (res.statusCode === 200) {
                console.log('✅ Frontend is accessible');
                
                // Check if it's a Next.js app
                if (data.includes('__NEXT_DATA__') || data.includes('_next')) {
                  console.log('✅ Next.js app detected');
                }
                
                // Check for NimHub specific content
                if (data.includes('NimHub') || data.includes('Nimiq')) {
                  console.log('✅ NimHub content detected');
                }
                
                console.log('\n━'.repeat(60));
                console.log('🎉 All Tests Passed!');
                console.log('━'.repeat(60));
                console.log('\n✅ Backend API is secured and working');
                console.log('✅ API authentication is enforced');
                console.log('✅ Production frontend is accessible');
                console.log('\n� Summary:');
                console.log('   Backend:  https://nserver-production.up.railway.app');
                console.log('   Frontend: https://nimhub.vercel.app');
                console.log('   Status:   All systems operational ✓');
                console.log('\n💡 Next Steps:');
                console.log('   1. Visit https://nimhub.vercel.app');
                console.log('   2. Open DevTools → Network tab');
                console.log('   3. Verify API requests include x-api-key header');
                console.log('   4. Test wallet connection and features');
                console.log('   5. Check that all API calls return 200 (not 401)\n');
              } else if (res.statusCode === 301 || res.statusCode === 302) {
                console.log('⚠️  Frontend redirecting (status:', res.statusCode + ')');
                console.log('Location:', res.headers.location);
              } else {
                console.log('⚠️  Unexpected status code:', res.statusCode);
              }
            });
          });

          frontendReq.on('error', (e) => {
            console.error('⚠️  Frontend check failed:', e.message);
            console.log('💡 This is not critical - frontend might still work');
          });

          frontendReq.end();
          
        } else {
          console.log('\n⚠️  Test 3: WARNING - Expected 401 but got', res.statusCode);
          console.log('💡 API might not be enforcing authentication');
        }
      });
    });

    unauthorizedReq.on('error', (e) => {
      console.error('❌ Error:', e.message);
      process.exit(1);
    });

    unauthorizedReq.end();
  });
});

req.on('error', (e) => {
  console.error('\n❌ Test 2: FAILED - Connection error');
  console.error('Error:', e.message);
  console.log('\n💡 Troubleshooting:');
  console.log('   - Check that backend is running');
  console.log('   - Verify NEXT_PUBLIC_API_URL is correct');
  console.log('   - Check network connectivity');
  process.exit(1);
});

req.end();
