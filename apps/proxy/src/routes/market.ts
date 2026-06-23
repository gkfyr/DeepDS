import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import {
  CLOCK_ID,
  PREDICT_ID,
  PREDICT_PACKAGE_ID,
  suiClient,
} from '../sui.js';
import type { MarketDataResponse } from '../types.js';
import { DUMMY_MODE } from '../config.js';

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
  latest_price?: { spot: number; forward: number };
}

interface OraclePrice {
  spot: number;
}

const QUOTE_QUANTITY = 1_000_000n;
const MARKET_CACHE_MS = 3000;
let cachedMarket: MarketDataResponse | null = null;
let cachedAt = 0;

function decodeU64(bytes: number[]): bigint {
  let value = 0n;
  for (let i = Math.min(bytes.length, 8) - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i]!);
  }
  return value;
}

async function quoteMintCost(
  oracle: OracleInfo,
  strikeRaw: number,
  isUp: boolean,
): Promise<number> {
  const tx = new Transaction();
  const marketKey = tx.moveCall({
    target: `${PREDICT_PACKAGE_ID}::market_key::new`,
    arguments: [
      tx.pure.id(oracle.oracle_id),
      tx.pure.u64(BigInt(oracle.expiry)),
      tx.pure.u64(BigInt(Math.round(strikeRaw))),
      tx.pure.bool(isUp),
    ],
  });
  tx.moveCall({
    target: `${PREDICT_PACKAGE_ID}::predict::get_trade_amounts`,
    arguments: [
      tx.object(PREDICT_ID),
      tx.object(oracle.oracle_id),
      marketKey,
      tx.pure.u64(QUOTE_QUANTITY),
      tx.object(CLOCK_ID),
    ],
  });

  const inspected = await suiClient.devInspectTransactionBlock({
    sender: '0x0000000000000000000000000000000000000000000000000000000000000001',
    transactionBlock: tx,
  });
  if (inspected.effects.status.status !== 'success') {
    throw new Error(inspected.effects.status.error ?? 'Quote simulation failed');
  }
  const values = inspected.results?.at(-1)?.returnValues;
  if (!values?.[0]) throw new Error('Quote simulation returned no mint cost');
  return Number(decodeU64(values[0][0])) / 1_000_000;
}

export async function fetchActiveMarket(): Promise<MarketDataResponse> {
  if (cachedMarket && Date.now() - cachedAt < MARKET_CACHE_MS) {
    return cachedMarket;
  }

  if (DUMMY_MODE) {
    const now = Date.now();
    const wave = Math.sin(now / 18_000) * 145;
    const spot = 64_000 + wave;
    const strike = Math.round(spot / 100) * 100;
    const up = Math.max(0.2, Math.min(0.8, 0.5 + (spot - strike) / 500));
    cachedMarket = {
      spot: Number(spot.toFixed(2)),
      forward: Number(spot.toFixed(2)),
      strike,
      up: Number(up.toFixed(4)),
      down: Number((1 - up).toFixed(4)),
      history: Array.from({ length: 24 }, (_, index) =>
        Number((spot + Math.sin(index / 3) * 35).toFixed(2)),
      ),
      expiry: Math.ceil(now / 900_000) * 900_000,
      oracle: 'mock_btc_15m',
      status: 'active',
      ts: now,
    };
    cachedAt = now;
    return cachedMarket;
  }

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

  const [stateResponse, historyResponse] = await Promise.all([
    fetch(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/state`, {
      signal: AbortSignal.timeout(5000),
    }),
    fetch(`${PREDICT_SERVER}/oracles/${oracle.oracle_id}/prices?limit=24`, {
      signal: AbortSignal.timeout(5000),
    }),
  ]);
  if (!stateResponse.ok) throw new Error(`Oracle state returned ${stateResponse.status}`);
  const state = (await stateResponse.json()) as OracleState;
  const spotRaw = Number(state.latest_price?.spot ?? 0);
  if (!spotRaw) throw new Error('Oracle has no live spot price');
  const forwardRaw = Number(state.latest_price?.forward ?? spotRaw);

  const strikeRaw = Math.max(
    oracle.min_strike,
    Math.round(spotRaw / oracle.tick_size) * oracle.tick_size,
  );
  let history: number[] = [];
  if (historyResponse.ok) {
    const prices = (await historyResponse.json()) as OraclePrice[];
    history = prices
      .slice(0, 24)
      .reverse()
      .map((price) => price.spot / PRICE_SCALE);
  }

  const [up, down] = await Promise.all([
    quoteMintCost(oracle, strikeRaw, true),
    quoteMintCost(oracle, strikeRaw, false),
  ]);

  cachedMarket = {
    spot: spotRaw / PRICE_SCALE,
    forward: forwardRaw / PRICE_SCALE,
    strike: strikeRaw / PRICE_SCALE,
    up: Number(up.toFixed(6)),
    down: Number(down.toFixed(6)),
    history,
    expiry: oracle.expiry,
    oracle: oracle.oracle_id,
    status: oracle.status,
    ts: Date.now(),
  };
  cachedAt = Date.now();
  return cachedMarket;
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
