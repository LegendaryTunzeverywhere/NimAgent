# NimAgent - AI-Powered Nimiq Payment Platform

> Your intelligent payment assistant for Nimiq cryptocurrency. Send NIM, buy gift cards, top up airtime, pay bills — all powered by AI.

![Status](https://img.shields.io/badge/status-production--ready-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 💰 Pricing & Fees

### Markup Notice
We charge a small **0.5% markup** on all paid services (gift cards, airtime, bills) to cover operational costs. This markup is included in the final amount you see before confirming your payment.

---

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
cd server && npm install && cd ..

# Set up environment variables
cp .env.example .env.local
cp server/.env.example server/.env

# Edit .env files with your API keys
```

### Start Development Servers

```bash
# Terminal 1: Backend (Port 3000)
cd server
npm start

# Terminal 2: Frontend (Port 3001)
npm run dev
```

**Access the app**: http://localhost:3001

---

## 📁 Project Structure

```
nimagent-next/
├── src/
│   ├── app/                    # Next.js app directory
│   ├── components/             # React components
│   │   ├── pages/             # Page components (HomePage, ChatPage, HistoryPage)
│   │   ├── ActionCard.tsx     # Payment action handler
│   │   ├── QRCodeDisplay.tsx  # QR code generator
│   │   ├── QRScanner.tsx      # QR code scanner
│   │   ├── BottomNav.tsx      # Bottom navigation
│   │   ├── Icon.tsx           # Icon component
│   │   ├── Logo.tsx           # Logo component
│   │   └── ...
│   ├── lib/                   # Utilities
│   │   ├── api-client.ts      # Backend API client
│   │   ├── nimiq-hub.ts       # Wallet integration
│   │   ├── currency.ts        # Currency utilities
│   │   └── wallet/            # Wallet adapters (Hub, Mini App)
│   ├── store/                 # State management (Zustand)
│   │   └── useAppStore.ts
│   └── types/                 # TypeScript types
├── server/                    # Backend API
│   ├── index.js              # Express server entry
│   ├── agent.js              # AI agent (Gemini)
│   ├── reloadly.js           # Services API integration
│   ├── supabase.js           # Database client
│   ├── saved-addresses.js    # Saved addresses management
│   ├── crypto-swap.js        # Crypto swap functionality
│   └── ...
├── public/                   # Static assets
├── generate-api-key.js       # API secret key generator
├── middleware.ts             # Next.js middleware
├── tailwind.config.ts        # Tailwind CSS config
└── tsconfig.json             # TypeScript config
```

---

## ✨ Features

### Core Functionality
- ✅ **Wallet Integration** - Connect via Nimiq Hub or Nimiq Mini App
- ✅ **Send NIM** - Peer-to-peer transfers with QR scanning
- ✅ **Balance Checking** - Real-time NIM balances
- ✅ **Transaction History** - View all past transactions and orders
- ✅ **QR Code Generation** - Share wallet address
- ✅ **Saved Contacts** - Save frequently used addresses with nicknames
- ✅ **Quick Actions** - One-tap access to common tasks on homepage

### AI-Powered Services
- ✅ **AI Chat Agent** - Natural language payment commands
- ✅ **Voice Input** - Speak your payment requests
- ✅ **Gift Cards** - Amazon, Steam, iTunes, Netflix, etc. (150+ countries)
- ✅ **Airtime Top-ups** - Global mobile top-up service
- ✅ **Bill Payments** - Electricity, internet, TV, water, and more

### Technical Features
- ✅ **Real-time Price** - Live NIM price from CoinGecko
- ✅ **Order Validation** - Pre-payment verification
- ✅ **Transaction Recording** - All data stored in Supabase
- ✅ **Error Handling** - User-friendly error messages
- ✅ **Responsive Design** - Works on all devices (mobile-first)
- ✅ **Dark/Light Theme** - Toggle between themes
- ✅ **Mini App Support** - Works inside Nimiq Wallet app

---

## 🔧 Configuration

### Quick Setup

1. **Generate API Secret**:
```bash
node generate-api-key.js
```

2. **Frontend Environment (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_NIMIQ_NETWORK=mainnet
NEXT_PUBLIC_NIMIQ_HUB_URL=https://hub.nimiq.com
NEXT_PUBLIC_SERVICE_ADDRESS=NQ07...
```

3. **Backend Environment (server/.env)**:
```env
PORT=3000
NODE_ENV=development
API_SECRET=<paste_generated_key>  # server-side only, shared with the Next.js BFF

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# AI Agent
GEMINI_API_KEYS=your_gemini_api_key

# Services
RELOADLY_CLIENT_ID=your_client_id
RELOADLY_CLIENT_SECRET=your_client_secret
RELOADLY_SANDBOX=true

# Service Wallet
SERVICE_WALLET_ADDRESS=NQ07...
NEXT_PUBLIC_NIMIQ_NETWORK=mainnet
NEXT_PUBLIC_NIMIQ_HUB_URL=https://hub.nimiq.com
FRONTEND_URL=http://localhost:3001
```

⚠️ **Security Note**: Never commit `.env.local` or `.env` files to Git!

---

## 🗄️ Database Setup

1. Create a Supabase project
2. Create the necessary tables (check server code for schema)

This creates:
- **transactions** table - All NIM transfers
- **orders** table - Gift cards, airtime, bills
- **saved_addresses** table - Saved wallet addresses
- **chat_sessions** table - Chat history sessions
- **chat_messages** table - Individual chat messages

---

## 🎯 Usage Examples

### Connect Wallet
1. Click "Connect Wallet" on home page
2. Nimiq Hub opens or Mini App connects automatically
3. Select/create account
4. Wallet connected!

### Quick Actions from Homepage
1. Click any quick action button (Send NIM, Gift Cards, Airtime, etc.)
2. App navigates to chat tab and sends pre-filled message
3. AI responds with action card
4. Complete the payment

### Send NIM via AI Chat
1. Navigate to "Chat" tab
2. Type: "Send 100 NIM to NQ..." or "Send to Mom"
3. AI creates action card
4. Confirm amount and pay

### Voice Input
1. Click microphone button (🎤)
2. Speak: "Check my balance" or "Buy a $25 Amazon gift card"
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
- [ ] QR code generation and scanning
- [ ] Transaction history
- [ ] Saved contacts management
- [ ] Quick actions from homepage
- [ ] Theme toggle
- [ ] AI typing indicator

### Browser Compatibility
- ✅ Nimiq Wallet Mini App

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
cd server
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
npm run type-check   # Check TypeScript types

# Backend
cd server
npm start            # Start backend (port 3000)
npm run dev          # Start backend with auto-reload
```

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting (recommended)
- Tailwind CSS for styling
- Zustand for state management

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
cd server
npm start
```

### Balance Not Loading
- Verify backend is running on port 3000
- Check `NEXT_PUBLIC_API_URL` in .env.local
- Ensure wallet address is valid

### Voice Input Not Working
- Use Chrome, Edge, Safari, or Nimiq Wallet Mini App
- Check browser permissions for microphone
- Firefox doesn't support Web Speech API

### Chat Agent Errors
- Verify `GEMINI_API_KEY` is set in server/.env
- Check API rate limits
- Ensure backend is running
- Check `API_SECRET` matches between the Next.js server env and the backend env

### AI Typing Indicator Not Showing
- Fixed! The loading state is now managed globally in the store

---

## 📊 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Animations**: Framer Motion
- **QR Codes**: qrcode, jsqr
- **Wallet**: @nimiq/hub-api, @nimiq/mini-app-sdk

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express
- **AI**: Google Gemini (@google/generative-ai)
- **Database**: Supabase (PostgreSQL)
- **Services**: Reloadly API
- **Price Data**: CoinGecko API
- **Security**: helmet, express-rate-limit, cors

### Blockchain
- **Network**: Nimiq
- **Wallet**: Nimiq Hub API & Mini App SDK
- **Explorer**: Nimiq Watch

---

## 📝 License

This project is open source and available under the **MIT License** - see the [LICENSE](LICENSE) file for full details.

### Quick License Summary (TL;DR)
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ⚠️ License and copyright notice must be included

### Full License
```text
MIT License

Copyright (c) 2026 NimAgent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Nimiq Team** - For the amazing blockchain, Hub API, and Mini App SDK
- **Google** - For Gemini AI
- **Reloadly** - For gift cards, airtime, and bill payment services
- **Supabase** - For the database platform
- **CoinGecko** - For cryptocurrency price data
- **Tailwind Labs** - For Tailwind CSS
- **Vercel** - For Next.js

---

## 📞 Support

- **Issues**: GitHub Issues
- **Community**: Nimiq Discord
- **Documentation**: Check DESIGN.md for design details

---

## 🎯 Roadmap

### Completed ✅
- [x] Wallet integration (Mini App)
- [x] AI chat agent
- [x] Voice input
- [x] Gift cards
- [x] Airtime top-ups
- [x] Bill payments
- [x] Transaction history
- [x] QR code generation and scanning
- [x] Saved contacts
- [x] Quick actions from homepage
- [x] Dark/light theme
- [x] AI loading state management
- [x] Transaction notifications
- [x] Refund portal


### In Progress 🚧
- [ ] Multi-language support


### Planned 📋
- [ ] Spending analytics
- [ ] Crypto swap interface
- [ ] Mobile app (React Native)
- [ ] Bill splitting feature
- [ ] Recurring payments
- [ ] Budget tracking

---

**Built with ❤️ for the Nimiq community**

**Status**: Production Ready for Mainnet 🚀
