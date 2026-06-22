# Host the DeepDS proxy from this Mac

The proxy can run on this computer and use a free Cloudflare Quick Tunnel for
its public HTTPS address. No Cloudflare account or router port forwarding is
required.

## Start hosting

Install the tunnel client once:

```bash
brew install cloudflared
```

Make sure `apps/proxy/.env` contains the intended network configuration, then
run:

```bash
pnpm host:local
```

The command builds and starts the proxy, waits for `/health`, and prints a URL
similar to:

```text
https://example-words.trycloudflare.com
```

Keep that terminal and the Mac awake during the demo.

## Connect the Vercel frontend

On the DeepDS session page, paste the generated HTTPS URL into **Server
address** before creating a session. The web browser uses HTTPS, while DeepDS
automatically converts a `trycloudflare.com` address to HTTP inside the QR
code. This matters because the original Nintendo 3DS system SSL service only
supports TLS 1.1, while Vercel requires TLS 1.2 or newer.

Alternatively, set this value in Vercel and redeploy:

```env
NEXT_PUBLIC_PROXY_URL=https://example-words.trycloudflare.com
```

If you use another legacy-compatible relay hostname, set a separate address
for the QR code:

```env
NEXT_PUBLIC_3DS_PROXY_URL=http://relay.example.com
```

## Verify

```bash
curl https://example-words.trycloudflare.com/health
curl http://example-words.trycloudflare.com/health
curl https://example-words.trycloudflare.com/api/market-data
```

The health response should contain `"mode":"live"` when
`apps/proxy/.env` has `DUMMY_MODE=false`.

## Limitations

- The `trycloudflare.com` address changes whenever the tunnel restarts.
- Sessions are stored in memory and disappear when the proxy stops.
- The Mac must remain powered on, awake, and connected to the internet.
- The endpoint is public while the tunnel runs. Stop it with `Ctrl+C` when the
  demo is over.

For a stable URL, create a named Cloudflare Tunnel and attach a domain you
control.
