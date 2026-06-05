# Coinify Cash Out Integration Guide

## Overview
This guide covers integrating Coinify's Payment Service SDK to allow NimHub users to cash out NIM to local currency.

## Integration Flow

```
User clicks "Cash Out" → Opens Coinify Widget → User sells NIM → Receives local currency
```

## Prerequisites

### 1. Get Coinify Credentials
You need to sign up as a Coinify partner and get:
- ✅ Partner ID
- ✅ API Key  
- ✅ API Secret
- ✅ Webhook Secret (for payment callbacks)

**Sign up:** https://coinify.com/partners

### 2. Choose Environment
- **Sandbox** (for testing): https://trade-ui.sandbox.coinify.com
- **Production**: https://trade-ui.coinify.com

---

## Implementation Steps

### Step 1: Environment Variables

Add to `.env.example`:
```env
# Coinify Configuration
COINIFY_PARTNER_ID=your_partner_id_here
COINIFY_API_KEY=your_api_key_here
COINIFY_API_SECRET=your_api_secret_here
COINIFY_WEBHOOK_SECRET=your_webhook_secret_here
COINIFY_ENVIRONMENT=sandbox # or production
```

Add to `.env.local`:
```env
COINIFY_PARTNER_ID=actual_partner_id
COINIFY_API_KEY=actual_api_key
COINIFY_API_SECRET=actual_api_secret
COINIFY_WEBHOOK_SECRET=actual_webhook_secret
COINIFY_ENVIRONMENT=sandbox
```

### Step 2: Create Coinify Widget Component

Create `src/components/CoinifyWidget.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Icon from './Icon';

interface CoinifyWidgetProps {
  walletAddress?: string;
  initialAmount?: number;
}

export default function CoinifyWidget({ walletAddress, initialAmount }: CoinifyWidgetProps) {
  const { wallet, addMessage } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);

  useEffect(() => {
    initializeCoinify();
  }, [walletAddress]);

  const initializeCoinify = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get Coinify session token from backend
      const response = await fetch('/api/coinify/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletAddress || wallet.address,
          returnUrl: `${window.location.origin}/cash-out-success`,
          cancelUrl: `${window.location.origin}/cash-out-cancel`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize Coinify session');
      }

      const data = await response.json();
      
      if (data.widgetUrl) {
        // Load Coinify widget
        loadCoinifyWidget(data.widgetUrl, data.tradeId);
        setTradeId(data.tradeId);
      }

    } catch (err) {
      console.error('Coinify initialization error:', err);
      setError('Failed to load cash out service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCoinifyWidget = (widgetUrl: string, tradeId: string) => {
    // Create iframe for Coinify widget
    const container = document.getElementById('coinify-container');
    if (!container) return;

    const iframe = document.createElement('iframe');
    iframe.src = widgetUrl;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '16px';
    iframe.allow = 'camera'; // For KYC document scanning
    
    container.innerHTML = '';
    container.appendChild(iframe);

    // Listen for Coinify events
    window.addEventListener('message', (event) => {
      if (event.origin.includes('coinify.com')) {
        handleCoinifyEvent(event.data, tradeId);
      }
    });
  };

  const handleCoinifyEvent = (eventData: any, tradeId: string) => {
    console.log('[Coinify Event]', eventData);

    switch (eventData.type) {
      case 'trade.complete':
        addMessage({
          role: 'ai',
          content: `✅ Cash out successful! Your ${eventData.currency} should arrive within 1-3 business days.\n\nTrade ID: ${tradeId}`,
        });
        break;

      case 'trade.cancelled':
        addMessage({
          role: 'ai',
          content: '❌ Cash out cancelled. Your NIM remains in your wallet.',
        });
        break;

      case 'kyc.required':
        addMessage({
          role: 'ai',
          content: '🔐 KYC verification required. Please complete identity verification to continue.',
        });
        break;

      case 'error':
        setError(eventData.message || 'An error occurred');
        break;
    }
  };

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 text-center max-w-md mx-auto">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-white mb-2">Cash Out Unavailable</h3>
        <p className="text-sm text-white/60 mb-4">{error}</p>
        <button
          onClick={initializeCoinify}
          className="btn-gold px-6 py-2 rounded-xl text-sm font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-3">
          <Icon name="wallet" size={24} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Cash Out</h2>
        <p className="text-sm text-white/60">Convert your NIM to local currency</p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-4" />
          <p className="text-white/60">Loading cash out service...</p>
        </div>
      )}

      {/* Coinify Widget Container */}
      <div id="coinify-container" className={loading ? 'hidden' : ''} />

      {/* Info Box */}
      {!loading && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-white/60 space-y-2">
          <p className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">ℹ️</span>
            <span>KYC verification may be required for first-time users.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">⏱️</span>
            <span>Bank transfers typically take 1-3 business days.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">💰</span>
            <span>Fees vary by payment method and location.</span>
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Backend API Routes

Add to `n_server/server/index.js`:

```javascript
// Coinify Integration
import crypto from 'crypto';

/**
 * Create Coinify session and return widget URL
 */
app.post('/api/coinify/session', async (req, res) => {
  const { walletAddress, returnUrl, cancelUrl } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const partnerId = process.env.COINIFY_PARTNER_ID;
    const apiKey = process.env.COINIFY_API_KEY;
    const apiSecret = process.env.COINIFY_API_SECRET;
    const environment = process.env.COINIFY_ENVIRONMENT || 'sandbox';

    if (!partnerId || !apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: 'Coinify not configured. Please add credentials to .env.local' 
      });
    }

    const baseUrl = environment === 'production'
      ? 'https://trade.coinify.com'
      : 'https://trade.sandbox.coinify.com';

    // Generate unique trade ID
    const tradeId = `nim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create signature for API authentication
    const timestamp = Date.now();
    const message = `${timestamp}POST/api/trades${JSON.stringify({
      partnerId,
      tradeId,
      cryptoCurrency: 'NIM',
      transferIn: {
        currency: 'NIM',
      },
      transferOut: {
        medium: 'bank',
      },
    })}`;

    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');

    // Create trade session
    const response = await fetch(`${baseUrl}/api/v3/trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Coinify-Partner-Id': partnerId,
        'X-Coinify-Api-Key': apiKey,
        'X-Coinify-Signature': signature,
        'X-Coinify-Timestamp': timestamp.toString(),
      },
      body: JSON.stringify({
        partnerId,
        tradeId,
        cryptoCurrency: 'NIM',
        transferIn: {
          currency: 'NIM',
          address: walletAddress,
        },
        transferOut: {
          medium: 'bank',
        },
        returnUrl,
        cancelUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[Coinify] Session creation failed:', errorData);
      throw new Error('Failed to create Coinify session');
    }

    const data = await response.json();

    // Store trade in database for tracking
    await supabase.from('coinify_trades').insert({
      trade_id: tradeId,
      wallet_address: walletAddress.replace(/\s/g, ''),
      status: 'pending',
      coinify_data: data,
    });

    res.json({
      tradeId: data.id,
      widgetUrl: data.redirectUrl || `${baseUrl}/trade/${data.id}`,
    });

  } catch (error) {
    console.error('[Coinify] Session error:', error);
    res.status(500).json({ error: 'Failed to initialize cash out' });
  }
});

/**
 * Coinify webhook handler - receives payment status updates
 */
app.post('/api/coinify/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-coinify-signature'];
  const webhookSecret = process.env.COINIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Coinify Webhook] Webhook secret not configured');
    return res.status(500).send('Webhook not configured');
  }

  // Verify webhook signature
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  if (signature !== computedSignature) {
    console.error('[Coinify Webhook] Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  try {
    const event = JSON.parse(req.body.toString());
    console.log('[Coinify Webhook]', event);

    // Update trade status in database
    await supabase
      .from('coinify_trades')
      .update({
        status: event.state,
        updated_at: new Date().toISOString(),
        coinify_data: event,
      })
      .eq('trade_id', event.id);

    // Handle different event types
    switch (event.state) {
      case 'completed':
        console.log(`[Coinify] Trade ${event.id} completed`);
        // Send confirmation email, update user balance, etc.
        break;

      case 'cancelled':
        console.log(`[Coinify] Trade ${event.id} cancelled`);
        break;

      case 'expired':
        console.log(`[Coinify] Trade ${event.id} expired`);
        break;

      default:
        console.log(`[Coinify] Trade ${event.id} state: ${event.state}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Coinify Webhook] Error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

/**
 * Get Coinify trade status
 */
app.get('/api/coinify/trade/:tradeId', async (req, res) => {
  const { tradeId } = req.params;

  try {
    const { data, error } = await supabase
      .from('coinify_trades')
      .select('*')
      .eq('trade_id', tradeId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('[Coinify] Trade status error:', error);
    res.status(500).json({ error: 'Failed to get trade status' });
  }
});
```

### Step 4: Database Table

Add Supabase migration to track Coinify trades:

```sql
-- Create coinify_trades table
CREATE TABLE IF NOT EXISTS coinify_trades (
  id SERIAL PRIMARY KEY,
  trade_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(60) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  coinify_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_coinify_trades_wallet ON coinify_trades(wallet_address);
CREATE INDEX idx_coinify_trades_status ON coinify_trades(status);
CREATE INDEX idx_coinify_trades_created ON coinify_trades(created_at DESC);
```

### Step 5: Update HomePage Cash Out Handler

Modify `src/components/pages/HomePage.tsx`:

```tsx
// Change Cash Out handler
if (actionType === 'Cash Out') {
  addMessage({
    role: 'ai',
    content: 'Ready to cash out your NIM! 💰\n\nConnect with Coinify to convert your NIM to local currency. The process is secure and supports multiple payment methods.',
    action: {
      type: 'cash-out', // New action type
    }
  });
  return;
}
```

### Step 6: Update ChatPage to Handle cash-out Action

Add to `src/components/pages/ChatPage.tsx`:

```tsx
import CoinifyWidget from '@/components/CoinifyWidget';

// In the action rendering section:
{message.action?.type === 'cash-out' && (
  <CoinifyWidget 
    walletAddress={wallet.address} 
    initialAmount={message.action.amount}
  />
)}
```

### Step 7: Update AI Agent Knowledge

Add to `n_server/server/agent.js`:

```javascript
// Add to system prompt:
`
**CASH OUT / SELL NIM:**
- Users can cash out (sell) NIM for local currency via Coinify integration
- Supported currencies: USD, EUR, GBP, and many more
- KYC verification may be required for first-time users
- Bank transfers take 1-3 business days
- When user wants to "cash out", "sell NIM", or "convert to fiat", create action type: "cash-out"
`
```

---

## Testing

### 1. Sandbox Testing
1. Set `COINIFY_ENVIRONMENT=sandbox` in `.env.local`
2. Use Coinify test credentials
3. Test the full flow without real money

### 2. Test Cases
- ✅ Widget loads correctly
- ✅ KYC flow works
- ✅ Payment confirmation received
- ✅ Webhook updates database
- ✅ Trade status can be checked

---

## Production Checklist

Before going live:
- [ ] Get production Coinify credentials
- [ ] Set `COINIFY_ENVIRONMENT=production`
- [ ] Configure webhook URL in Coinify dashboard
- [ ] Test with small amounts first
- [ ] Set up monitoring for failed trades
- [ ] Add email notifications for trade completion
- [ ] Add refund handling for failed trades
- [ ] Ensure HTTPS for webhook endpoint
- [ ] Add rate limiting on Coinify endpoints
- [ ] Set up error tracking (Sentry)

---

## Security Considerations

1. **API Keys**: Never expose API keys/secrets in frontend
2. **Webhook Verification**: Always verify webhook signatures
3. **HTTPS Only**: Coinify requires HTTPS for production
4. **Input Validation**: Validate all user inputs before API calls
5. **Rate Limiting**: Limit API calls to prevent abuse

---

## Alternative: Simpler Redirect Flow

If Payment Service SDK is too complex, you can use a simpler redirect:

```tsx
const cashOutUrl = `https://trade.coinify.com/sell?partnerId=${partnerId}&cryptoCurrency=NIM&address=${walletAddress}`;
window.open(cashOutUrl, '_blank');
```

This sends the user to Coinify's website instead of embedding the widget.

---

## Next Steps

1. **Get Coinify Credentials** - Sign up at https://coinify.com/partners
2. **Add Environment Variables** - Add credentials to `.env.local`
3. **Create Database Table** - Run the SQL migration
4. **Test in Sandbox** - Verify everything works with test credentials
5. **Go Live** - Switch to production when ready

---

## Support Resources

- Coinify API Docs: https://developer.coinify.com/apidoc/trade/
- Coinify Getting Started: https://coinify.readme.io/docs/getting-started
- Coinify Environments: https://coinify.readme.io/docs/environments
- Payment Service SDK: https://coinify.readme.io/page/payment-service-sdk

---

## Questions?

Let me know if you need:
- Help with any specific integration step
- Alternative approaches
- Error handling strategies
- Testing guidance
