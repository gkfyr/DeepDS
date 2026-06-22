# Deploy the DeepDS Proxy to Koyeb

The repository includes a root `Dockerfile` for the Express proxy. The web app
can be deployed separately to Vercel.

## 1. Push `main` to GitHub

Koyeb can deploy directly from a GitHub repository. Make sure the latest
`main` branch is available remotely.

## 2. Create the Koyeb service

In the Koyeb control panel:

1. Select **Create Web Service**.
2. Choose **GitHub** and select the DeepDS repository.
3. Select the `main` branch.
4. Choose **Dockerfile** as the builder.
5. Use `/Dockerfile` as the Dockerfile path.
6. Select the **Free** instance.
7. Expose port `8000` with HTTP protocol.
8. Set the health-check path to `/health`.

The container already starts the proxy with:

```text
pnpm --filter @deepds/proxy start
```

## 3. Environment variables

Add these variables to the Koyeb service:

```env
PORT=8000
SUI_NETWORK=testnet
DUMMY_MODE=false
PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
```

To deploy the hardware-only mock version instead, set:

```env
DUMMY_MODE=true
```

## 4. Verify the deployment

Koyeb provides an HTTPS URL similar to:

```text
https://deepds-proxy-xxxxx.koyeb.app
```

Check it with:

```bash
curl https://deepds-proxy-xxxxx.koyeb.app/health
curl https://deepds-proxy-xxxxx.koyeb.app/api/market-data
```

The health response should contain `"mode":"live"`.

## 5. Configure Vercel

Add these environment variables to the Vercel project and redeploy:

```env
NEXT_PUBLIC_PROXY_URL=https://deepds-proxy-xxxxx.koyeb.app
NEXT_PUBLIC_DUMMY_MODE=false
NEXT_PUBLIC_DUSDC_ALLOWANCE=5
```

## 6. Connect the Nintendo 3DS

The 3DS client now accepts `https://` proxy URLs. On its pairing screen, enter
the Koyeb URL and the full session UUID shown by the web app.

For this PoC, TLS certificate verification is disabled on the 3DS because its
root certificate store is outdated. The HTTPS traffic remains encrypted, but
this should not be treated as a production custody architecture.

## Free-instance note

The Koyeb free instance sleeps after a period without traffic. Before a demo,
open the `/health` URL and wait for a successful response, then create a fresh
session. Sessions are stored in memory and are lost when the service sleeps,
restarts, or redeploys.
