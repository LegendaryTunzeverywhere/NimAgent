# NimHub - AI-Powered Nimiq Payment Platform

> Your intelligent payment assistant for Nimiq cryptocurrency. Send NIM, buy gift cards, top up airtime, pay bills — all powered by AI.

![Status](https://img.shields.io/badge/status-production--ready-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for database)
- Gemini API key (for AI agent)
- Reloadly account (for gift cards/airtime/bills)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd nimpay-next

# Install dependencies
npm install
cd nimsplit/server && npm install && cd ../..

# Set up environment variables
cp .env.example .env.local
cp nimsplit/server/.env.example nimsplit/server/.env

# Edit .env files with your API keys
```

### Start Development Servers

```bash
# Terminal 1: Backend (Port 3000)
cd nimsplit/server
npm start

# Terminal 2: Frontend (Port 3001)
npm run dev
```

**Access the app**: http://localhost:3001

---

## 📁 Project Structure

```
nimpay-next/
├── src/
│   ├── app/                    # Next.js app directory
│   ├── components/             # React components
│   │   ├── pages/             # Page components
│   │   ├── ActionCard.tsx     # Payment action handler
│   │   ├── QRCodeDisplay.tsx  # QR code generator
│   │   ├── BalanceDisplay.tsx # Balance viewer
│   │   └── ...
│   ├── lib/                   # Utilities
│   │   ├── api-client.ts      # Backend API client
│   │   ├── nimiq-hub.ts       # Wallet integration
│   │   └── currency.ts        # Currency utilities
│   ├── store/                 # State management
│   └── types/                 # TypeScript types
├── nimsplit/
│   ├── server/                # Backend API
│   │   ├── index.js          # Express server
│   │   ├── agent.js          # AI agent (Gemini)
│   │   ├── reloadly.js       # Services API
│   │   └── supabase.js       # Database client
│   └── schema.sql            # Database schema
└── Documentation files
```

---

## ✨ Features

### Core Functionality
- ✅ **Wallet Integration** - Connect via Nimiq Hub
- ✅ **Send NIM** - Peer-to-peer transfers
- ✅ **Balance Checking** - Real-time NIM & USDT balances
- ✅ **Transaction History** - View all past transactions
- ✅ **QR Code Generation** - Share wallet address

### AI-Powered Services
- ✅ **AI Chat Agent** - Natural language payment commands
- ✅ **Voice Input** - Speak your payment requests
- ✅ **Gift Cards** - Amazon, Steam, iTunes, Netflix, etc.
- ✅ **Airtime Top-ups** - 150+ countries supported
- ✅ **Bill Payments** - Electricity, internet, TV, water

### Technical Features
- ✅ **Real-time Price** - Live NIM price from CoinGecko
- ✅ **Order Validation** - Pre-payment verification
- ✅ **Transaction Recording** - All data in Supabase
- ✅ **Error Handling** - User-friendly error messages
- ✅ **Responsive Design** - Works on all devices

---

## 🔧 Configuration

### Frontend Environment (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_NIMIQ_NETWORK=testnet
NEXT_PUBLIC_NIMIQ_HUB_URL=https://hub.nimiq-testnet.com
NEXT_PUBLIC_SERVICE_ADDRESS=NQ07 0000 0000 0000 0000 0000 0000 0000 0000
```

### Backend Environment (nimsplit/server/.env)
```env
PORT=3000
NODE_ENV=development

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# AI Agent
GEMINI_API_KEY=your_gemini_api_key

# Services
RELOADLY_CLIENT_ID=your_client_id
RELOADLY_CLIENT_SECRET=your_client_secret
RELOADLY_SANDBOX=true

# Service Wallet
SERVICE_WALLET_ADDRESS=NQ07 0000 0000 0000 0000 0000 0000 0000 0000
```

---

## 🗄️ Database Setup

1. Create a Supabase project
2. Run the schema in SQL editor:

```sql
-- Copy contents from nimsplit/schema.sql
```

This creates:
- **transactions** table - All NIM transfers
- **orders** table - Gift cards, airtime, bills

---

## 🎯 Usage Examples

### Connect Wallet
1. Click "Connect Wallet" on home page
2. Nimiq Hub opens
3. Select/create account
4. Wallet connected!

### Send NIM via AI Chat
1. Navigate to "Chat" tab
2. Type: "Send 100 NIM to NQ..."
3. AI creates action card
4. Confirm amount and pay

### Voice Input
1. Click microphone button (🎤)
2. Speak: "Check my balance"
3. Text appears in input
4. Send message

### Buy Gift Card
1. Chat: "Buy $25 Amazon gift card"
2. AI validates product
3. Enter email (optional)
4. Confirm and pay
5. Receive gift card code

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Wallet connect/disconnect
- [ ] Balance display
- [ ] Send NIM transaction
- [ ] AI chat responses
- [ ] Voice input (Chrome/Edge/Safari)
- [ ] Gift card purchase (sandbox)
- [ ] Airtime top-up (sandbox)
- [ ] Bill payment (sandbox)
- [ ] QR code generation
- [ ] Transaction history

### Browser Compatibility
- ✅ Chrome (recommended)
- ✅ Edge
- ✅ Safari
- ⚠️ Firefox (no voice input)

---

## 📚 Documentation

- **QUICK_REFERENCE.md** - Quick commands and troubleshooting
- **NIMHUB_GUIDE.md** - Complete development guide
- **AI_AGENT_INTEGRATION.md** - AI agent implementation details
- **DEPLOYMENT_CHECKLIST.md** - Production deployment guide
- **ISSUES_FIXED.md** - Recent bug fixes and improvements
- **FINAL_STATUS.md** - Complete feature status
- **SECURITY_SUMMARY.md** - Security implementation overview
- **SECURITY_ARCHITECTURE.md** - Detailed security architecture
- **SECURITY_CHECKLIST.md** - Security operations guide
- **SECURITY_FLOW.txt** - Visual security flow diagram

---

## 🔒 Security

NimHub implements **cryptographically secure** payment verification with multiple layers of defense:

### Security Features
✅ **On-Chain Verification** - All payments verified on Nimiq blockchain  
✅ **Server-Side Pricing** - Client cannot manipulate amounts  
✅ **10% Volatility Buffer** - Protects against price fluctuations  
✅ **Replay Protection** - Each transaction can only be used once  
✅ **UI Amount Lock** - Payment amounts locked after validation  
✅ **AI Anti-Manipulation** - AI cannot be tricked into lowering prices  
✅ **Multi-Currency Support** - Secure conversion for 14 currencies  
✅ **Row Level Security** - Database access control enabled  

### Attack Vectors Blocked
❌ Client-side amount manipulation  
❌ Network request tampering  
❌ Fake transaction hashes  
❌ Underpaid transactions  
❌ Transaction replay attacks  
❌ Wrong recipient attacks  
❌ AI price manipulation  
❌ Race conditions  

### Security Documentation
For detailed security information, see:
- **SECURITY_SUMMARY.md** - Executive summary of security implementation
- **SECURITY_ARCHITECTURE.md** - System architecture and trust boundaries
- **SECURITY_FLOW.txt** - Step-by-step secure payment flow
- **SECURITY_CHECKLIST.md** - Pre-deployment security checklist

**Security Level**: PRODUCTION-READY ✓  
**Last Security Audit**: 2026-06-01 (self-audited)

---

## 🚀 Deployment

### Testnet Deployment

1. **Frontend** (Vercel recommended)
```bash
npm run build
vercel --prod
```

2. **Backend** (Railway/Render/Heroku)
```bash
cd nimsplit/server
# Deploy via platform CLI or GitHub integration
```

3. **Environment Variables**
- Set all production API keys
- Update `NEXT_PUBLIC_API_URL` to backend URL
- Change `NEXT_PUBLIC_NIMIQ_NETWORK` to `mainnet` for production

### Mainnet Deployment
- Switch to mainnet Nimiq Hub URL
- Use production Reloadly credentials
- Set `RELOADLY_SANDBOX=false`
- Update service wallet address

---

## 🛠️ Development

### Available Scripts

```bash
# Frontend
npm run dev          # Start dev server (port 3001)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript

# Backend
cd nimsplit/server
npm start            # Start backend (port 3000)
```

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting (recommended)
- Tailwind CSS for styling

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 🐛 Troubleshooting

### Backend Not Running
```bash
# Kill process on port 3000
npx kill-port 3000

# Restart backend
cd nimsplit/server
npm start
```

### Balance Not Loading
- Verify backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` in .env.local
- Ensure wallet address is valid

### Voice Input Not Working
- Use Chrome, Edge, or Safari
- Check browser permissions for microphone
- Firefox doesn't support Web Speech API

### Chat Agent Errors
- Verify `GEMINI_API_KEY` is set
- Check API rate limits
- Ensure backend is running

---

## 📊 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Animations**: Framer Motion
- **QR Codes**: qrcode library

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **AI**: Google Gemini
- **Database**: Supabase (PostgreSQL)
- **Services**: Reloadly API
- **Price Data**: CoinGecko API

### Blockchain
- **Network**: Nimiq
- **Wallet**: Nimiq Hub API
- **Explorer**: Nimiq Watch

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **Nimiq Team** - For the amazing blockchain and Hub API
- **Google** - For Gemini AI
- **Reloadly** - For gift cards, airtime, and bill payment services
- **Supabase** - For the database platform
- **CoinGecko** - For cryptocurrency price data

---

## 📞 Support

- **Issues**: GitHub Issues
- **Community**: Nimiq Discord
- **Documentation**: See docs folder

---

## 🎯 Roadmap

### Completed ✅
- [x] Wallet integration
- [x] AI chat agent
- [x] Voice input
- [x] Gift cards
- [x] Airtime top-ups
- [x] Bill payments
- [x] Transaction history
- [x] QR code generation

### In Progress 🚧
- [ ] Crypto swap interface
- [ ] Transaction notifications
- [ ] Spending analytics

### Planned 📋
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Bill splitting feature
- [ ] Recurring payments
- [ ] Budget tracking

---

**Built with ❤️ for the Nimiq community**

**Status**: Production Ready for Testnet 🚀
