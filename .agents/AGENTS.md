# 🎮 Project DeepDS (Sui Overflow 2026 Hackathon)

## 1. Project Overview

This project is an entry for the **Sui Overflow 2026 Hackathon (DeepBook Track)**.
For the problem statement of the track, try to read .agents/deepbook-track-statement.md
The goal is to build "DeepDS", a geeky and highly creative trading terminal that allows users to trade crypto assets on Sui's DeepBook using a **Nintendo 3DS**.

To bypass the hardware limitations of the 3DS (lack of modern web support, weak CPU, and clunky keyboard input), we use a hybrid architecture:
A Web Frontend generates an ephemeral (delegated) key session -> encodes it into a QR code -> The 3DS scans the QR code to authenticate -> The 3DS acts strictly as a UI controller, sending simple HTTP commands to a Node.js Proxy -> The Proxy executes Sui transactions on DeepBook.

PoC first. make work/tradable on Nintendo first, and think about what to trade(predict market... etc) next.

## 2. Monorepo Architecture & Tech Stack

The project is a monorepo (using `pnpm` workspaces for JS/TS, and a separate Makefile structure for C/C++).

```text
/deepds-monorepo
 ├── /apps/web      # Web Frontend (Next.js, Sui dApp Kit, Tailwind)
 ├── /apps/proxy    # Backend Proxy (Node.js, Express, @mysten/sui.js)
 └── /apps/3ds      # Nintendo 3DS Homebrew (C/C++, devkitPro, libctru)
```

### 2.1. apps/web (The Auth & Onboarding Layer)

Role: User connects their Sui Wallet (zkLogin or standard extensions) and generates a session.

Key Logic (Ephemeral Key):

1. Create a temporary keypair (Ephemeral Key).
2. Build a Programmable Transaction Block (PTB) to delegate limited DeepBook trading authority (or transfer a small allowance) to this temporary key.
3. Generate a UUID for the session. Send the session ID and Ephemeral Key to apps/proxy.
4. Display the Session ID (and proxy endpoint) as a QR Code on the screen.

### 2.2. apps/proxy (The Magic Box / Transaction Executor)

Role: Acts as the bridge between the 3DS and the Sui blockchain.

Key Logic:

- Manage active sessions in memory or a lightweight DB (Redis/SQLite).
- Expose simple REST APIs for the 3DS (e.g., GET /api/market-data, POST /api/trade).
- When receiving a POST /api/trade (e.g., {"sessionId": "123", "action": "BUY", "amount": 10}), construct a DeepBook PTB (place_market_order), sign it using the session's Ephemeral Key, and execute it on Sui.
- Return lightweight, easy-to-parse responses (JSON or CSV) for the 3DS.

### 2.3. apps/3ds (The Retro Controller)

Role: The physical trading terminal running natively on a Nintendo 3DS.

Tech: C/C++ using the devkitPro toolchain and libctru.

Key Logic:

- Camera/QR: Use the cam service and a lightweight C QR library (e.g., quirc) to scan the QR code from the PC screen.
- UI: Render orderbook and chart data on the Top Screen. Render Buy/Sell buttons on the Bottom Touch Screen.
- Network: Use httpc (HTTP Client) to poll data and send trade commands to apps/proxy. NO complex crypto signing happens here.

## 3. Agent Instructions & Rules

When generating code or suggesting architectures, strictly adhere to the following rules:

- 3DS Hardware Constraints: Do NOT suggest WebSockets, complex HTTPS handshakes, or heavy JSON parsing for the apps/3ds directory. The 3DS network stack is primitive. Keep API responses from the proxy as flat and small as possible.
- Sui SDK: Use the latest @mysten/sui.js in the apps/proxy and apps/web. Ensure you are referencing the correct DeepBook V3 move call structures.
- Ephemeral Key Pattern: The core UX relies on the user NOT having to confirm every single trade on their phone. The Web app MUST delegate power to an ephemeral key that the Proxy holds temporarily. Focus heavily on getting this PTB logic right.
- C/C++ Compilation: Ensure the Makefile for the 3DS app is correctly configured for devkitARM. If you don't know the exact libctru function, leave a TODO comment rather than hallucinating an API.
- Step-by-Step Execution: Do not try to build all three apps at once. Ask the user which app to focus on first (Recommendation: Build proxy first, then web, then mock the 3DS with curl before writing C code).

## 4. Official links for this hackathon

- https://mystenlabs.notion.site/overflow-2026-handbook

- https://docs.sui.io/onchain-finance/deepbookv3/deepbook
- https://docs.sui.io/onchain-finance/deepbook-margin
- https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict
- https://github.com/MystenLabs/deepbook-sandbox
