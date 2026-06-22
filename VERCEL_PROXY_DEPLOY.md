# Deploy the DeepDS Express proxy to Vercel

The proxy is compatible with Vercel Functions. Express is automatically
detected from `apps/proxy/src/index.ts`; no custom server process or Dockerfile
is needed.

Because Vercel can serve consecutive requests from different Function
instances, production sessions use Upstash Redis instead of process memory.
Ephemeral private keys are encrypted with AES-256-GCM before they are written
to Redis.

## 1. Create a separate Vercel project

Import the same Git repository into Vercel a second time and configure:

- **Root Directory:** `apps/proxy`
- **Framework Preset:** Express, or leave it on automatic detection
- **Build Command:** leave the detected/default value
- **Install Command:** leave the detected/default value

Keep the existing Next.js frontend as a separate Vercel project rooted at
`apps/web`.

## 2. Add Redis

In the proxy project's Vercel dashboard:

1. Open **Storage** or **Marketplace**.
2. Create an Upstash Redis database.
3. Connect it to the proxy project.
4. Confirm that these variables were added:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The proxy also accepts `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

## 3. Generate the session encryption key

Run this once:

```bash
openssl rand -base64 32
```

Add the output to the proxy project as:

```env
SESSION_ENCRYPTION_KEY=...
```

Do not expose this value to the frontend or commit it to Git. Changing it
invalidates sessions created with the previous key.

## 4. Add proxy environment variables

Add the remaining values from `apps/proxy/.env.example`:

```env
SUI_NETWORK=testnet
DUMMY_MODE=false
PREDICT_PACKAGE_ID=0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_ID=0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
DUSDC_COIN_TYPE=0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
PREDICT_SERVER_URL=https://predict-server.testnet.mystenlabs.com
```

`PORT` is not required on Vercel.

## 5. Deploy and verify

After deployment, test:

```bash
curl https://YOUR-PROXY.vercel.app/health
curl https://YOUR-PROXY.vercel.app/api/market-data
```

A healthy response contains:

```json
{"status":"ok","mode":"live","storage":"redis"}
```

If storage is not configured, `/health` returns HTTP 503 with
`"storage":"unconfigured"`.

## 6. Point the frontend at the proxy

In the existing Next.js frontend project, set:

```env
NEXT_PUBLIC_PROXY_URL=https://YOUR-PROXY.vercel.app
NEXT_PUBLIC_DUMMY_MODE=false
NEXT_PUBLIC_DUSDC_ALLOWANCE=5
```

Redeploy the frontend. Newly generated QR codes will contain the Vercel proxy
address, and the 3DS will connect to it over HTTPS.

## Operational notes

- Sessions expire after one hour using Redis TTL.
- Sessions survive Function cold starts and routing between instances.
- Redeploying the proxy does not remove active sessions.
- Deleting the Redis database or rotating `SESSION_ENCRYPTION_KEY` invalidates
  existing sessions.
