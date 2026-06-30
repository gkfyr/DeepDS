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
 * Port: 3001 (HTTP for LAN; HTTPS is handled by deployed/tunnel frontends)
 */

import app from './app.js';
import { DUMMY_MODE } from './config.js';
import { sessionStorageMode } from './session.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ██████╗ ███████╗███████╗██████╗ ██████╗ ███████╗
  ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝
  ██║  ██║█████╗  █████╗  ██████╔╝██║  ██║███████╗
  ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██║  ██║╚════██║
  ██████╔╝███████╗███████╗██║     ██████╔╝███████║
  ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═════╝ ╚══════╝
  
  🎮 DeepDS Proxy v0.2.0
  🌐 Network: ${process.env.SUI_NETWORK ?? 'testnet'}
  🧪 Mode: ${DUMMY_MODE ? 'DUMMY (no chain / no dUSDC)' : 'LIVE'}
  💾 Sessions: ${sessionStorageMode()}
  🚀 Listening on http://0.0.0.0:${PORT}
  📡 3DS endpoint: http://<YOUR_LAN_IP>:${PORT}
  `);
  });
}

export default app;
