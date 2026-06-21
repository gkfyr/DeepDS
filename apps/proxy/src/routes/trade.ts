import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import { getSession } from '../session.js';
import {
  CLOCK_ID,
  DUSDC_TYPE,
  PREDICT_ID,
  PREDICT_PACKAGE_ID,
  execute,
  keypairFromSecret,
} from '../sui.js';
import { fetchActiveMarket } from './market.js';
import type { TradeResponse } from '../types.js';

const router = Router();
const DEFAULT_QUANTITY = 1_000_000n;

router.post('/', async (req: Request, res: Response) => {
  const sid = String(req.body.sid ?? '');
  const action = String(req.body.action ?? '').toUpperCase();

  if (!sid || (action !== 'UP' && action !== 'DOWN')) {
    res.status(400).json({ ok: 0, error: 'Required: sid, action=UP|DOWN' });
    return;
  }

  let quantity: bigint;
  try {
    quantity = BigInt(String(req.body.qty ?? DEFAULT_QUANTITY));
    if (quantity <= 0n) throw new Error();
  } catch {
    res.status(400).json({ ok: 0, error: 'qty must be a positive integer' });
    return;
  }

  const session = getSession(sid);
  if (!session?.managerId) {
    res.status(401).json({ ok: 0, error: 'Session is not initialized' });
    return;
  }

  try {
    const market = await fetchActiveMarket();
    const keypair = keypairFromSecret(session.keypairSecretKey);
    const tx = new Transaction();
    tx.setSender(session.ephemeralAddress);
    const marketKey = tx.moveCall({
      target: `${PREDICT_PACKAGE_ID}::market_key::new`,
      arguments: [
        tx.pure.id(market.oracle),
        tx.pure.u64(BigInt(market.expiry)),
        tx.pure.u64(BigInt(Math.round(market.strike * 1e9))),
        tx.pure.bool(action === 'UP'),
      ],
    });
    tx.moveCall({
      target: `${PREDICT_PACKAGE_ID}::predict::mint`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(PREDICT_ID),
        tx.object(session.managerId),
        tx.object(market.oracle),
        marketKey,
        tx.pure.u64(quantity),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execute(tx, keypair);
    const response: TradeResponse = { ok: 1, digest: result.digest };
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response: TradeResponse = { ok: 0, error: message };
    res.status(500).json(response);
  }
});

export default router;
