/**
 * Route: Market Data
 * GET /api/market-data?pool=SUI_USDC
 *
 * Returns a minimal, 3DS-friendly flat JSON object.
 * For PoC: fetches real orderbook data from DeepBook indexer,
 * falls back to mock data if unavailable.
 *
 * DeepBook V3 Indexer: https://deepbook-indexer.mainnet.mystenlabs.com/
 * Testnet indexer: https://deepbook-indexer.testnet.mystenlabs.com/ (if available)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { MarketDataResponse } from '../types.js';

const router = Router();

// Pool key to indexer pool ID mapping (testnet)
// TODO: fetch dynamically from indexer /get_pools endpoint in production
const POOL_KEYS: Record<string, string> = {
  SUI_USDC: 'SUI_USDC',
};

const INDEXER_BASE =
  process.env.DEEPBOOK_INDEXER_URL ??
  'https://deepbook-indexer.mainnet.mystenlabs.com';

/**
 * Fetch order book summary from DeepBook indexer.
 * Returns best bid/ask prices.
 */
async function fetchOrderBook(
  poolKey: string,
): Promise<MarketDataResponse | null> {
  try {
    // DeepBook indexer API — get level2 orderbook
    const response = await fetch(
      `${INDEXER_BASE}/get_level2_book_status_bid_side?pool_id=${poolKey}&price_low=0&price_high=99999999999999&level_depth=1`,
      { signal: AbortSignal.timeout(3000) },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      bids?: Array<{ price: string; quantity: string }>;
    };

    // Also fetch ask side
    const askResponse = await fetch(
      `${INDEXER_BASE}/get_level2_book_status_ask_side?pool_id=${poolKey}&price_low=0&price_high=99999999999999&level_depth=1`,
      { signal: AbortSignal.timeout(3000) },
    );

    const askData = (await askResponse.json()) as {
      asks?: Array<{ price: string; quantity: string }>;
    };

    const bestBid = data.bids?.[0]?.price
      ? parseFloat(data.bids[0].price) / 1e9
      : 0;
    const bestAsk = askData.asks?.[0]?.price
      ? parseFloat(askData.asks[0].price) / 1e9
      : 0;

    return {
      bid: bestBid,
      ask: bestAsk,
      spread: parseFloat((bestAsk - bestBid).toFixed(4)),
      vol: 0, // Volume requires historical query
      ts: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Mock market data for local testing when indexer is unavailable.
 */
function mockMarketData(poolKey: string): MarketDataResponse {
  // Simulate slight price movement for demo realism
  const base = poolKey === 'SUI_USDC' ? 3.21 : 1.0;
  const jitter = (Math.random() - 0.5) * 0.04;
  const bid = parseFloat((base + jitter).toFixed(4));
  const ask = parseFloat((bid + 0.02).toFixed(4));
  return {
    bid,
    ask,
    spread: parseFloat((ask - bid).toFixed(4)),
    vol: Math.floor(10000 + Math.random() * 5000),
    ts: Date.now(),
  };
}

// GET /api/market-data?pool=SUI_USDC
router.get('/', async (req: Request, res: Response) => {
  const poolKey = (req.query['pool'] as string) ?? 'SUI_USDC';

  if (!POOL_KEYS[poolKey]) {
    res.status(400).json({ error: 'Unknown pool' });
    return;
  }

  // Try real indexer first, fall back to mock
  const liveData = await fetchOrderBook(POOL_KEYS[poolKey]!);
  const data = liveData ?? mockMarketData(poolKey);

  // Set short cache for polling (3DS polls every 2s)
  res.setHeader('Cache-Control', 'no-cache');
  res.json(data);
});

export default router;
