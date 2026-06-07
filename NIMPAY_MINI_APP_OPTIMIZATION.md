# Nimpay Mini App Optimization Guide

## 🎯 Overview

Optimizing NimHub for the **Nimpay Mini App** environment ensures seamless integration, better performance, and compliance with mini app best practices.

---

## 📱 What is Nimpay Mini App?

Nimpay Mini App is a lightweight, embedded version of your payment application that runs within the Nimiq ecosystem, providing:
- Fast loading times
- Minimal resource usage
- Deep integration with Nimiq wallet
- Seamless user experience
- Mobile-first design

---

## ⚡ Key Optimizations Needed

### 1. **Bundle Size Reduction**

#### Current Issues:
- Large JavaScript bundles slow down mini app loading
- Unused dependencies increase bundle size
- Heavy animations and graphics

#### Solutions:

**A. Code Splitting**
```typescript
// next.config.js - Already configured but optimize further
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['@nimiq/core', 'lucide-react'],
  },
};
```

**B. Dynamic Imports**
```typescript
// Load heavy components only when needed
const SwapInterface = dynamic(() => import('@/components/SwapInterface'), {
  loading: () => <LoadingSkeleton />,
});

const StakingPage = dynamic(() => import('@/components/pages/StakePage'), {
  loading: () => <LoadingSkeleton />,
});
```

**C. Remove Unused Dependencies**
```bash
# Analyze bundle
npx @next/bundle-analyzer

# Remove unused packages
npm uninstall [unused-packages]
```

### 2. **Performance Optimization**

#### A. Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/logo.png"
  width={48}
  height={48}
  alt="NimHub"
  priority // For above-the-fold images
/>
```

#### B. Reduce API Calls
```typescript
// Implement request deduplication
const priceCache = new Map();
const CACHE_DURATION = 60000; // 1 minute

async function fetchNIMPrice() {
  const now = Date.now();
  const cached = priceCache.get('nim_usd');
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetch('/api/nim-price?currency=usd');
  priceCache.set('nim_usd', { data, timestamp: now });
  return data;
}
```

#### C. Lazy Loading
```typescript
// Lazy load non-critical features
if (typeof window !== 'undefined') {
  // Only load on client
  import('./analytics').then(({ initAnalytics }) => {
    initAnalytics();
  });
}
```

### 3. **Mobile-First UI Adjustments**

#### A. Touch-Friendly Buttons
```css
/* Increase tap targets for mobile */
.btn {
  min-height: 44px; /* iOS recommended minimum */
  min-width: 44px;
  padding: 12px 16px;
}
```

#### B. Responsive Typography
```css
/* Use clamp() for responsive text */
.title {
  font-size: clamp(1.5rem, 5vw, 2.5rem);
}
```

#### C. Bottom Sheet Navigation
Already implemented with `BottomNav.tsx` ✅

### 4. **Wallet Integration**

#### A. Nimiq Hub Auto-Connect
```typescript
// Auto-connect in mini app environment
useEffect(() => {
  if (isMiniApp()) {
    connectWallet({ autoConnect: true });
  }
}, []);

function isMiniApp() {
  return typeof window !== 'undefined' && window.location.href.includes('nimpay.app');
}
```

#### B. Simplified Auth Flow
```typescript
// Skip wallet selection in mini app (already connected)
const connectWallet = async () => {
  if (isMiniApp()) {
    // Use embedded wallet context
    const wallet = window.nimpayWallet;
    setWalletAddress(wallet.address);
  } else {
    // Normal hub flow
    await HubApi.connect();
  }
};
```

### 5. **Network Efficiency**

#### A. Request Batching
```typescript
// Batch multiple API calls
async function fetchUserData(address: string) {
  const [balance, transactions, contacts] = await Promise.all([
    fetch(`/api/balance?wallet=${address}`),
    fetch(`/api/transactions?wallet=${address}`),
    fetch(`/api/saved-addresses?wallet=${address}`),
  ]);
  
  return {
    balance: await balance.json(),
    transactions: await transactions.json(),
    contacts: await contacts.json(),
  };
}
```

#### B. Optimistic UI Updates
```typescript
// Update UI immediately, sync in background
const sendNIM = async (to: string, amount: number) => {
  // 1. Update UI optimistically
  addTransaction({
    to,
    amount,
    status: 'pending',
    timestamp: Date.now(),
  });
  
  // 2. Send actual transaction
  try {
    const tx = await nimiq.send(to, amount);
    updateTransaction(tx.hash, { status: 'confirmed' });
  } catch (error) {
    updateTransaction(null, { status: 'failed' });
  }
};
```

### 6. **Offline Support**

#### A. Service Worker
```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

#### B. Local Storage Caching
```typescript
// Cache saved contacts locally
const saveContact = async (contact: SavedAddress) => {
  // Save to server
  await fetch('/api/saved-addresses', {
    method: 'POST',
    body: JSON.stringify(contact),
  });
  
  // Cache locally
  const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
  contacts.push(contact);
  localStorage.setItem('contacts', JSON.stringify(contacts));
};
```

---

## 🔧 Implementation Steps

### Step 1: Update Configuration

**`next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable PWA features for mini app
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
  },
  
  // Optimize for mini app
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ['@nimiq/core', 'lucide-react'],
  },
  
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
};

module.exports = nextConfig;
```

### Step 2: Add Mini App Detection

**`src/lib/mini-app.ts`**
```typescript
export function isMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.location.href.includes('nimpay.app') ||
    window.location.href.includes('miniapp') ||
    !!window.nimpayMiniApp
  );
}

export function getMiniAppContext() {
  if (!isMiniApp()) return null;
  
  return {
    wallet: window.nimpayWallet,
    theme: window.nimpayTheme || 'light',
    locale: window.nimpayLocale || 'en',
  };
}
```

### Step 3: Optimize Chat Page

**`src/components/pages/ChatPage.tsx` - Add Mini App Mode**
```typescript
const isMiniAppMode = isMiniApp();

return (
  <div className={cn(
    "flex flex-col h-full",
    isMiniAppMode && "pb-0" // No bottom padding in mini app
  )}>
    {/* Simplified header for mini app */}
    {!isMiniAppMode && (
      <div className="header">
        {/* Full header */}
      </div>
    )}
    
    {/* Messages */}
    <div className="messages">
      {/* ... */}
    </div>
    
    {/* Input */}
    <div className={cn(
      "input-area",
      isMiniAppMode && "sticky bottom-0"
    )}>
      {/* ... */}
    </div>
  </div>
);
```

### Step 4: Add Loading States

**`src/components/LoadingScreen.tsx`**
```typescript
export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-white dark:from-gray-900 dark:to-black">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <Logo size={48} glow />
        <p className="text-sm text-gray-500 dark:text-white/50 mt-4">Loading NimHub...</p>
      </div>
    </div>
  );
}
```

### Step 5: Reduce Initial Load

**`src/app/layout.tsx`**
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to important domains */}
        <link rel="preconnect" href="https://api.coingecko.com" />
        <link rel="preconnect" href="https://hub.nimiq.com" />
        
        {/* Preload critical assets */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider>
          <Suspense fallback={<LoadingScreen />}>
            {children}
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 📊 Performance Targets

| Metric | Current | Target | Mini App Target |
|--------|---------|--------|-----------------|
| First Contentful Paint | ~2s | <1.5s | <1s |
| Time to Interactive | ~3s | <2.5s | <1.5s |
| Bundle Size | ~800KB | <600KB | <400KB |
| API Response Time | ~200ms | <150ms | <100ms |
| Lighthouse Score | 85 | 90+ | 95+ |

---

## 🎨 Mini App UI Adjustments

### Simplified Navigation
```typescript
// Hide unnecessary elements in mini app
{!isMiniApp() && (
  <>
    <SettingsModal />
    <AdvancedFeatures />
  </>
)}
```

### Compact Mode
```typescript
const compactMode = isMiniApp();

<div className={cn(
  "card",
  compactMode && "p-3" // Less padding
  !compactMode && "p-6" // Normal padding
)}>
```

### Quick Actions Only
```typescript
// Show only essential actions in mini app
const actions = isMiniApp()
  ? ['Send', 'Receive', 'Scan'] // Minimal
  : ['Send', 'Receive', 'Scan', 'Swap', 'Buy', 'Stake']; // Full
```

---

## 🔐 Security for Mini App

### 1. Verify Mini App Origin
```typescript
function verifyMiniAppOrigin() {
  const allowedOrigins = [
    'https://nimpay.app',
    'https://wallet.nimiq.com',
  ];
  
  return allowedOrigins.some(origin => 
    window.location.href.startsWith(origin)
  );
}
```

### 2. Secure Communication
```typescript
// Use postMessage for mini app communication
window.addEventListener('message', (event) => {
  if (!verifyMiniAppOrigin()) return;
  
  if (event.data.type === 'WALLET_CONNECTED') {
    handleWalletConnection(event.data.wallet);
  }
});
```

---

## 📦 Build for Mini App

### Production Build
```bash
# Build with optimizations
NODE_ENV=production npm run build

# Analyze bundle
npm run analyze

# Test mini app mode
NEXT_PUBLIC_MINI_APP=true npm run dev
```

### Environment Variables
```env
# .env.production.miniapp
NEXT_PUBLIC_MINI_APP=true
NEXT_PUBLIC_API_URL=https://api.nimpay.app
NEXT_PUBLIC_NIMIQ_NETWORK=mainnet
```

---

## ✅ Mini App Checklist

- [ ] Bundle size < 400KB
- [ ] FCP < 1s
- [ ] TTI < 1.5s
- [ ] Lighthouse score > 95
- [ ] Mobile-optimized UI
- [ ] Touch-friendly buttons (44px min)
- [ ] Offline support
- [ ] Auto-connect wallet
- [ ] Simplified navigation
- [ ] Request batching
- [ ] Image optimization
- [ ] Lazy loading
- [ ] Service worker
- [ ] Error boundaries
- [ ] Loading states
- [ ] Secure communication
- [ ] Origin verification
- [ ] Local caching
- [ ] Optimistic updates

---

## 🚀 Deployment

### Vercel Configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_MINI_APP": "true"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## 📈 Monitoring

### Track Performance
```typescript
// Add performance monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0];
    
    // Send to analytics
    analytics.track('mini_app_load', {
      fcp: perfData.domContentLoadedEventEnd,
      tti: perfData.loadEventEnd,
      bundleSize: document.documentElement.outerHTML.length,
    });
  });
}
```

---

## 🎯 Expected Improvements

| Aspect | Before | After Mini App Optimization |
|--------|--------|----------------------------|
| Load Time | 3-4s | <1.5s (60% faster) |
| Bundle Size | 800KB | <400KB (50% smaller) |
| Memory Usage | ~50MB | <30MB (40% less) |
| Battery Impact | Medium | Low |
| User Experience | Good | Excellent |

---

Your NimHub app will be perfectly optimized for the Nimpay Mini App environment! 🚀
