# 🎮 DeepDS — Nintendo 3DS × DeepBook Predict

DeepDS turns a Nintendo 3DS into a physical BTC prediction terminal for the Sui Overflow 2026 DeepBook Predict track.

The browser creates an allowance-limited ephemeral wallet, the proxy creates a `PredictManager` owned by that wallet, and the 3DS submits simple `UP` or `DOWN` commands over local HTTP. Private keys and Sui transaction building never run on the 3DS.

## Video links
- https://youtube.com/shorts/9Y_k8kW2xns?feature=share
- https://youtu.be/Xie-nVBO11o

## Architecture

```text
Browser wallet
  ├─ generates an ephemeral Ed25519 key
  ├─ sends 0.05 SUI + a user-selected dUSDC allowance
  └─ registers the one-hour session with the proxy
             │
             ▼
Node.js proxy
  ├─ creates and funds an ephemeral PredictManager
  ├─ reads active BTC oracles from predict-server
  └─ signs predict::mint<dUSDC> for UP/DOWN commands
             ▲
             │ plain HTTP on the local network
Nintendo 3DS
  ├─ scans or manually enters the session
  ├─ displays BTC spot, ATM strike, expiry, and balances
  └─ submits UP/DOWN from the touch screen
```

The session can only spend the SUI and dUSDC explicitly transferred to its ephemeral address. The key is held in proxy memory for one hour and is never persisted.

## Requirements

- Node.js 20+
- pnpm 9+
- A Sui testnet wallet with SUI and hackathon dUSDC
- For the 3DS build: devkitPro, devkitARM, libctru, citro2d, and citro3d

The Predict deployment currently configured by default is:

- Package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- Quote asset: `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC`
- Public data API: `https://predict-server.testnet.mystenlabs.com`

Override these values in `apps/proxy/.env` if the hackathon deployment changes.

## Run locally

```bash
pnpm install

cp apps/proxy/.env.example apps/proxy/.env
pnpm dev:proxy

cp apps/web/.env.local.example apps/web/.env.local
pnpm dev:web
```

Open `http://localhost:3000`, connect a testnet wallet, choose a dUSDC session allowance, and create the session. For a real 3DS, set the proxy URL in the web UI to the computer's LAN address, such as `http://192.168.1.5:3001`.

## Deploy

- Deploy `apps/web` to Vercel.
- Deploy the root `Dockerfile` to a Koyeb Web Service.
- Configure Vercel's `NEXT_PUBLIC_PROXY_URL` with the HTTPS Koyeb URL.

The full Koyeb setup, environment variables, health check, and free-instance
limitations are documented in [KOYEB_DEPLOY.md](./KOYEB_DEPLOY.md).

To host the proxy from your own Mac for free, run `pnpm host:local` and paste
the generated Cloudflare Tunnel URL into the session page. See
[LOCAL_HOSTING.md](./LOCAL_HOSTING.md) for setup and demo limitations.

The Express proxy can also run on Vercel Functions with Upstash Redis-backed
sessions. See [VERCEL_PROXY_DEPLOY.md](./VERCEL_PROXY_DEPLOY.md).

The connected wallet must already hold dUSDC. The official track instructions provide the request form: <https://tally.so/r/Xx102L>.

## Proxy smoke tests

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/market-data
```

The trade endpoint is deliberately flat for the 3DS:

```bash
curl -X POST http://localhost:3001/api/trade \
  -d "sid=<session-uuid>&action=UP&qty=1000000"
```

`qty=1000000` represents a position with a maximum 1 dUSDC payout.

## Build the 3DS app

```bash
cd apps/3ds
make
```

Copy `deepds.3dsx` to the `/3ds/` directory on the SD card and launch it through Homebrew Launcher.

Open the pairing page in the web app, then point the 3DS outer camera at its QR code. The app decodes the proxy URL and session UUID together using the bundled `quirc` library. Press `A` on the scan screen if you need the native software-keyboard fallback.

## API

- `POST /api/session` — register the ephemeral key
- `POST /api/session/:sid/initialize` — create and fund its PredictManager
- `GET /api/session/:sid` — verify session status
- `GET /api/market-data` — nearest-expiry active BTC market
- `GET /api/balance/:sid` — ephemeral gas/dUSDC balance and manager ID
- `POST /api/trade` — mint an `UP` or `DOWN` Predict position
- `DELETE /api/session/:sid` — revoke the in-memory session

## Security notes

- Run the proxy only on a trusted local network.
- Use a small dUSDC allowance suitable for the demo.
- Sessions expire after one hour and disappear when the proxy restarts.
- The current PoC sends the ephemeral private key from the browser to the local proxy over HTTP because Nintendo 3DS TLS support is constrained. Do not expose the proxy to the public internet.

## References

- [DeepBook Predict integration guide](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)
- [DeepBook V3 documentation](https://docs.sui.io/onchain-finance/deepbookv3/deepbook)
- [devkitPro](https://devkitpro.org/)

MIT
