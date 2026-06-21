# DeepDS Dummy Mode

This branch runs the complete browser → proxy → Nintendo 3DS UI flow without
a wallet, dUSDC, SUI RPC, or a blockchain transaction.

## Start the local demo

Use two terminals:

```bash
pnpm dev:dummy:proxy
```

```bash
NEXT_PUBLIC_PROXY_URL=http://YOUR_LAN_IP:3001 pnpm dev:dummy:web
```

Open `http://localhost:3000` and select **Start dummy session**.

## Connect the physical Nintendo 3DS

The QR decoder is not yet included in the homebrew build, so use its manual
pairing fallback:

1. Start DeepDS on the 3DS.
2. Press `A` on the pairing screen.
3. Enter the proxy URL shown by the web app, for example
   `http://192.168.0.15:3001`.
4. Enter the full session UUID shown under the QR code.
5. The top screen will show a locally generated BTC market.
6. Tap **UP** or **DOWN**. The proxy returns a mock digest and subtracts the
   simulated cost from the session's virtual dUSDC balance.

## What is mocked

- BTC spot, strike, expiry, and UP/DOWN prices
- PredictManager creation
- SUI and dUSDC balances
- UP/DOWN transaction execution and digest

The REST response shape is the same as live mode, so the 3DS application uses
the same networking and rendering code.

## Verify the proxy

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/market-data
```

The health response should contain `"mode":"dummy"`.
