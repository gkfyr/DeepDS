#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/apps/proxy/.env"
PROXY_PID=""
TUNNEL_PID=""

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required."
  echo "macOS: brew install cloudflared"
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
else
  echo "pnpm is required. Install Node.js, then run: corepack enable"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy apps/proxy/.env.example to apps/proxy/.env first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PORT="${PORT:-3001}"
LOCAL_URL="http://127.0.0.1:$PORT"

cleanup() {
  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

echo "Building the DeepDS proxy..."
"${PNPM[@]}" --filter @deepds/proxy build

EXISTING_PROXY_PID="$(
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
)"

if [[ -n "$EXISTING_PROXY_PID" ]]; then
  EXISTING_COMMAND="$(ps -p "$EXISTING_PROXY_PID" -o command= 2>/dev/null || true)"
  if [[ "$EXISTING_COMMAND" != *"node dist/index.js"* ]]; then
    echo "Port $PORT is occupied by another process:"
    echo "  PID $EXISTING_PROXY_PID: $EXISTING_COMMAND"
    exit 1
  fi

  echo "Stopping the previous DeepDS proxy (PID $EXISTING_PROXY_PID)..."
  kill "$EXISTING_PROXY_PID"
  for _ in {1..20}; do
    if ! kill -0 "$EXISTING_PROXY_PID" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done
  if kill -0 "$EXISTING_PROXY_PID" 2>/dev/null; then
    echo "The previous proxy did not stop cleanly."
    exit 1
  fi
fi

while IFS= read -r tunnel_pid; do
  [[ -z "$tunnel_pid" ]] && continue
  echo "Stopping previous Cloudflare tunnel (PID $tunnel_pid)..."
  kill "$tunnel_pid" 2>/dev/null || true
done < <(
  pgrep -f "cloudflared tunnel --url ${LOCAL_URL}" 2>/dev/null || true
)

echo "Starting the DeepDS proxy on port $PORT..."
node "$ROOT_DIR/apps/proxy/dist/index.js" &
PROXY_PID=$!

for _ in {1..30}; do
  if curl -fsS --max-time 2 "$LOCAL_URL/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$PROXY_PID" 2>/dev/null; then
    echo "The proxy stopped before becoming ready."
    exit 1
  fi
  sleep 1
done

if ! curl -fsS --max-time 2 "$LOCAL_URL/health" >/dev/null 2>&1; then
  echo "The proxy did not become ready at $LOCAL_URL."
  exit 1
fi

echo
echo "Creating a free public Cloudflare tunnel..."
echo "Copy the https://...trycloudflare.com URL into the web app's Server address field."
echo "The 3DS app uses mbedTLS for HTTPS, so the QR code can keep the HTTPS URL."
echo "Keep this terminal open during the demo. Press Ctrl+C to stop hosting."
echo

cloudflared tunnel --url "$LOCAL_URL" --no-autoupdate &
TUNNEL_PID=$!
wait "$TUNNEL_PID"
