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

if curl -fsS --max-time 2 "$LOCAL_URL/health" >/dev/null 2>&1; then
  echo "Using the proxy already running at $LOCAL_URL"
else
  echo "Building the DeepDS proxy..."
  "${PNPM[@]}" --filter @deepds/proxy build

  echo "Starting the DeepDS proxy on port $PORT..."
  "${PNPM[@]}" --filter @deepds/proxy start &
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
fi

echo
echo "Creating a free public HTTPS tunnel..."
echo "Copy the https://...trycloudflare.com URL into the web app's Server address field."
echo "Keep this terminal open during the demo. Press Ctrl+C to stop hosting."
echo

cloudflared tunnel --url "$LOCAL_URL" --no-autoupdate &
TUNNEL_PID=$!
wait "$TUNNEL_PID"
