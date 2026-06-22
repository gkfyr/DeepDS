/**
 * DeepDS Proxy — Express Server Entry Point
 *
 * Exposes a simple REST API for the Nintendo 3DS to:
 * 1. Read market data (GET /api/market-data)
 * 2. Execute trades (POST /api/trade)
 * 3. Check balances (GET /api/balance/:sid)
 *
 * Sessions are created by the web frontend and stored in memory.
 * The 3DS only needs a session ID (scanned from QR code) to trade.
 *
 * Port: 3001 (HTTP — 3DS does not support modern TLS)
 */

import express from 'express';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import marketRouter from './routes/market.js';
import tradeRouter from './routes/trade.js';
import balanceRouter from './routes/balance.js';
import { DUMMY_MODE } from './config.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// --- Middleware ---

// CORS: allow the web frontend and 3DS (any origin for local LAN demo)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] }));

// Parse JSON (for web frontend session creation)
app.use(express.json());

// Parse URL-encoded form data (for 3DS httpc requests)
// The 3DS sends: sid=abc&action=UP&qty=1000000
app.use(express.urlencoded({ extended: false }));

// --- Routes ---
app.use('/api/session', sessionRouter);
app.use('/api/market-data', marketRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/balance', balanceRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ts: Date.now(),
    service: 'deepds-proxy',
    mode: DUMMY_MODE ? 'dummy' : 'live',
  });
});

// Root info (helps 3DS verify connection after QR scan)
app.get('/', (_req, res) => {
  res.json({
    service: 'DeepDS Proxy',
    version: '0.1.0',
    network: process.env.SUI_NETWORK ?? 'testnet',
    mode: DUMMY_MODE ? 'dummy' : 'live',
    endpoints: [
      'GET  /health',
      'POST /api/session',
      'GET  /api/market-data',
      'POST /api/trade (form-encoded: sid, action=UP|DOWN, qty)',
      'GET  /api/balance/:sid',
    ],
  });
});

// --- Start server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ██████╗ ███████╗███████╗██████╗ ██████╗ ███████╗
  ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝
  ██║  ██║█████╗  █████╗  ██████╔╝██║  ██║███████╗
  ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██║  ██║╚════██║
  ██████╔╝███████╗███████╗██║     ██████╔╝███████║
  ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═════╝ ╚══════╝
  
  🎮 DeepDS Proxy v0.1.0
  🌐 Network: ${process.env.SUI_NETWORK ?? 'testnet'}
  🧪 Mode: ${DUMMY_MODE ? 'DUMMY (no chain / no dUSDC)' : 'LIVE'}
  🚀 Listening on http://0.0.0.0:${PORT}
  📡 3DS endpoint: http://<YOUR_LAN_IP>:${PORT}
  `);
});

export default app;
