# 🎮 DeepDS — Nintendo 3DS × Sui DeepBook Trading Terminal

> **Sui Overflow 2026 Hackathon | DeepBook Track**

Trade crypto on Sui's DeepBook V3 using a Nintendo 3DS as a physical trading terminal. Because why use a boring phone when you have a dual-screen wonder?

---

## 🏗️ Architecture

```
[Browser Wallet]
    │
    ├─ Generate ephemeral Ed25519 keypair
    ├─ Sign PTB: authorize_trader on BalanceManager + fund with 0.05 SUI gas
    ├─ Register session with Proxy (POST /api/session)
    └─ Display QR code: {"url":"http://<LAN_IP>:3001","sid":"<uuid>"}
         │
         ▼
[Nintendo 3DS Camera]
    │
    ├─ Scan QR code
    ├─ Connect to Proxy: GET / (verify)
    ├─ Poll: GET /api/market-data (every 2s → top screen)
    └─ Trade: POST /api/trade (touch BUY/SELL → bottom screen)
         │
         ▼
[Node.js Proxy]
    │
    ├─ Holds ephemeral keypair in memory (1 hour TTL)
    ├─ Builds DeepBook PTB (placeMarketOrder)
    └─ Signs & executes on Sui testnet
         │
         ▼
[Sui DeepBook V3 CLOB]
```

---

## 📁 Monorepo Structure

```
deep-ds/
├── apps/
│   ├── proxy/          # Node.js/Express transaction executor
│   ├── web/            # Next.js auth & session onboarding
│   └── 3ds/            # Nintendo 3DS C/C++ homebrew
├── pnpm-workspace.yaml
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Sui wallet (testnet) with some SUI
- (For 3DS) devkitPro with devkitARM + libctru + citro2d

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start the Proxy

```bash
cd apps/proxy
cp .env.example .env
# Edit .env if needed (default: testnet, port 3001)
pnpm dev
```

The proxy starts at `http://0.0.0.0:3001`.

### 3. Start the Web Frontend

```bash
cd apps/web
cp .env.local.example .env.local
# Set NEXT_PUBLIC_PROXY_URL to your LAN IP for 3DS demo
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Create a Trading Session

1. Connect your Sui testnet wallet
2. Click **Create Trading Session**
3. Enter your proxy LAN IP (e.g., `http://192.168.1.5:3001`)
4. Approve the wallet transaction (funds ephemeral key with 0.05 SUI gas)
5. Scan the QR code with your 3DS!

---

## 🧪 Smoke Tests (curl)

```bash
# Health check
curl http://localhost:3001/health

# Market data
curl http://localhost:3001/api/market-data?pool=SUI_USDC


# Create a test session manually
curl -X POST http://localhost:3001/api/session \
  -H "Content-Type: application/json" \
  -d '{"sid":"test-001","privkey":"<base64_privkey>","balanceManagerId":"0x...","userAddress":"0x..."}'

# Check balance
curl http://localhost:3001/api/balance/test-001

# Execute a trade (mimics 3DS request)
curl -X POST http://localhost:3001/api/trade \
  -d "sid=test-001&action=BUY&qty=1000000000&pool=SUI_USDC"
```

---

## 🎮 Building the 3DS App

### Prerequisites

- [devkitPro](https://devkitpro.org/wiki/Getting_Started) with:
  - `devkitARM`
  - `3ds-dev` package group (includes libctru, citro2d, citro3d)

```bash
cd apps/3ds

# Edit source/main.c and set your proxy URL + session ID
# (or implement QR scanning with quirc library)

make

# Output: deepds.3dsx + deepds.elf
```

### Testing on Citra Emulator

1. Download [Citra](https://citra-emu.org/)
2. Open `deepds.3dsx` in Citra
3. The app will use the hardcoded test URL from `main.c`

### Testing on Real 3DS

1. Install [Luma3DS](https://github.com/LumaTeam/Luma3DS)
2. Copy `deepds.3dsx` to `/3ds/` on your SD card
3. Launch via Homebrew Launcher

---

## 🔑 Security Model

The ephemeral key delegation flow:

1. **User's wallet** signs a PTB to add the ephemeral key as an authorized trader on their DeepBook **BalanceManager** (`balance_manager::authorize_trader`)
2. **Ephemeral key** is stored in the proxy's memory only (never persisted, 1-hour TTL)
3. **3DS** only knows the session ID — never sees any private keys
4. After trading, the user can **revoke** the session from the web UI

This means the user approves trading authority **once** and the 3DS can trade autonomously without wallet confirmations.

---

## 🏆 DeepBook V3 Features Used

| Feature             | Usage                                                     |
| ------------------- | --------------------------------------------------------- |
| **BalanceManager**  | User's trading account, delegation via `authorize_trader` |
| **Pool (SUI/USDC)** | Primary trading pair                                      |
| **Market Orders**   | `placeMarketOrder` via `@mysten/deepbook-v3` SDK          |
| **Indexer API**     | Real-time orderbook data for top screen display           |
| **DEEP token**      | Fee payment option (payWithDeep flag)                     |

---

## 🔗 Resources

- [Sui DeepBook V3 Docs](https://docs.sui.io/onchain-finance/deepbookv3/deepbook)
- [DeepBook Sandbox](https://github.com/MystenLabs/deepbook-sandbox)
- [DeepBook V3 SDK](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3)
- [Sui Overflow 2026](https://mystenlabs.notion.site/overflow-2026-handbook)
- [devkitPro](https://devkitpro.org/)
- [libctru](https://libctru.devkitpro.org/)

---

## 📝 License

MIT — Built with ❤️ and nostalgia for Sui Overflow 2026
