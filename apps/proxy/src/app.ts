import express from 'express';
import cors from 'cors';
import sessionRouter from './routes/session.js';
import marketRouter from './routes/market.js';
import tradeRouter from './routes/trade.js';
import balanceRouter from './routes/balance.js';
import { DUMMY_MODE } from './config.js';
import { sessionStorageMode } from './session.js';

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/session', sessionRouter);
app.use('/api/market-data', marketRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/balance', balanceRouter);

app.get('/health', (_req, res) => {
  const storage = sessionStorageMode();
  res.status(storage === 'unconfigured' ? 503 : 200).json({
    status: storage === 'unconfigured' ? 'configuration_required' : 'ok',
    ts: Date.now(),
    service: 'deepds-proxy',
    mode: DUMMY_MODE ? 'dummy' : 'live',
    storage,
  });
});

app.get('/', (_req, res) => {
  res.json({
    service: 'DeepDS Proxy',
    version: '0.2.0',
    network: process.env.SUI_NETWORK ?? 'testnet',
    mode: DUMMY_MODE ? 'dummy' : 'live',
    storage: sessionStorageMode(),
    endpoints: [
      'GET  /health',
      'POST /api/session',
      'GET  /api/market-data',
      'POST /api/trade (form-encoded: sid, action=UP|DOWN, qty)',
      'GET  /api/balance/:sid',
    ],
  });
});

export default app;
