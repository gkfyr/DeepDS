/**
 * Route: Execute Trade
 * POST /api/trade
 *
 * Accepts application/x-www-form-urlencoded (flat key=value)
 * for compatibility with the 3DS httpc service.
 *
 * Body params:
 *   sid    — Session ID (UUID)
 *   action — 'BUY' or 'SELL'
 *   qty    — Quantity in base token units (e.g., 1000000000 = 1 SUI)
 *   pool   — Pool key (default: SUI_USDC)
 *
 * Response (flat JSON, 3DS-friendly):
 *   {"ok":1,"digest":"0x..."} on success
 *   {"ok":0,"error":"..."} on failure
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import { getSession } from '../session.js';
import { makeDeepBookClient, suiClient } from '../sui.js';
import type { TradeResponse } from '../types.js';

const router = Router();

// POST /api/trade
router.post('/', async (req: Request, res: Response) => {
  const sid = req.body.sid as string;
  const action = (req.body.action as string)?.toUpperCase() as 'BUY' | 'SELL';
  const qtyStr = req.body.qty as string;
  const poolKey = (req.body.pool as string) ?? 'SUI_USDC';

  // --- Validate inputs ---
  if (!sid || !action || !qtyStr) {
    const resp: TradeResponse = { ok: 0, error: 'Missing: sid, action, qty' };
    res.status(400).json(resp);
    return;
  }

  if (action !== 'BUY' && action !== 'SELL') {
    const resp: TradeResponse = { ok: 0, error: 'action must be BUY or SELL' };
    res.status(400).json(resp);
    return;
  }

  const qty = BigInt(qtyStr);
  if (qty <= 0n) {
    const resp: TradeResponse = { ok: 0, error: 'qty must be > 0' };
    res.status(400).json(resp);
    return;
  }

  // --- Look up session ---
  const session = getSession(sid);
  if (!session) {
    const resp: TradeResponse = { ok: 0, error: 'Session not found or expired' };
    res.status(401).json(resp);
    return;
  }

  // --- Execute trade ---
  try {
    const { dbClient, keypair } = makeDeepBookClient(session.keypairSecretKey);
    const ephemeralAddress = keypair.getPublicKey().toSuiAddress();

    console.log(
      `[trade] ${action} ${qty} on ${poolKey} by ${ephemeralAddress} (session: ${sid})`,
    );

    const tx = new Transaction();
    tx.setSender(ephemeralAddress);

    // Build DeepBook market order PTB
    // isBid = true means BUY (paying quote to get base)
    // isBid = false means SELL (paying base to get quote)
    await dbClient.placeMarketOrder(
      {
        poolKey,
        balanceManagerKey: session.balanceManagerId,
        clientOrderId: BigInt(Date.now()),
        quantity: qty,
        isBid: action === 'BUY',
        payWithDeep: false, // Use input token for fees (simpler for PoC)
      },
      tx,
    );

    // Sign and execute with ephemeral keypair
    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: {
        showEffects: true,
      },
    });

    console.log(`[trade] Success! Digest: ${result.digest}`);

    const resp: TradeResponse = { ok: 1, digest: result.digest };
    res.json(resp);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[trade] Error for session ${sid}:`, errorMessage);

    const resp: TradeResponse = { ok: 0, error: errorMessage };
    res.status(500).json(resp);
  }
});

export default router;
