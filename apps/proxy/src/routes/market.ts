import { Router } from 'express';
import type { Request, Response } from 'express';
import { PREDICT_ID } from '../sui.js';
import type { MarketDataResponse } from '../types.js';

const router = Router();
const PREDICT_SERVER =
  process.env.PREDICT_SERVER_URL ?? 'https://predict-server.testnet.mystenlabs.com';
const PRICE_SCALE = 1e9;

interface OracleInfo {
  oracle_id: string;
  underlying_asset: string;
  expiry: number;
  min_strike: number;
  tick_size: number;
  status: string;
}

interface OracleState {
  latest_price?: { spot: number };
}

export async function fetchActiveMarket(): Promise<MarketDataResponse> {
  const response = await fetch(`${PREDICT_SERVER}/predicts/${PREDICT_ID}/oracles`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Predict server returned ${response.status}`);

  const now = Date.now();
  const oracles = (await response.json()) as OracleInfo[];
  const oracle = oracles
    .filter((item) => item.status === 'active' && item.expiry > now)
    .sort((a, b) => a.expiry - b.expiry)[0];
  if (!oracle) throw new Error('No active Predict oracle');

  const stateResponse = await fetch(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/state`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!stateResponse.ok) throw new Error(`Oracle state returned ${stateResponse.status}`);
  const state = (await stateResponse.json()) as OracleState;
  const spotRaw = Number(state.latest_price?.spot ?? 0);
  if (!spotRaw) throw new Error('Oracle has no live spot price');

  const strikeRaw = Math.max(
    oracle.min_strike,
    Math.round(spotRaw / oracle.tick_size) * oracle.tick_size,
  );
  const distance = (spotRaw - strikeRaw) / Math.max(spotRaw, 1);
  const up = Math.max(0.05, Math.min(0.95, 0.5 + distance * 8));

  return {
    spot: spotRaw / PRICE_SCALE,
    strike: strikeRaw / PRICE_SCALE,
    up: Number(up.toFixed(4)),
    down: Number((1 - up).toFixed(4)),
    expiry: oracle.expiry,
    oracle: oracle.oracle_id,
    status: oracle.status,
    ts: Date.now(),
  };
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await fetchActiveMarket());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ error: message });
  }
});

export default router;
