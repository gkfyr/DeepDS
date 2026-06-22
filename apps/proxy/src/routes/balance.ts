/**
 * Route: Balance Check
 * GET /api/balance/:sid
 *
 * Returns the SUI and USDC balances of the ephemeral key address
 * associated with the given session.
 *
 * Response: {"sui":"4.95","usdc":"12.50"}
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSession } from '../session.js';
import { DUSDC_TYPE, getCoinBalance } from '../sui.js';
import type { BalanceResponse } from '../types.js';
import { DUMMY_MODE } from '../config.js';

const router = Router();

// GET /api/balance/:sid
router.get('/:sid', async (req: Request, res: Response) => {
  const { sid } = req.params;

  let session;
  try {
    session = await getSession(sid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ error: message });
    return;
  }
  if (!session) {
    res.status(401).json({ error: 'Session not found or expired' });
    return;
  }

  try {
    if (DUMMY_MODE) {
      const resp: BalanceResponse = {
        sui: '0.0500',
        dusdc: (Number(session.mockBalance ?? 0n) / 1e6).toFixed(2),
        manager: session.managerId ?? '',
      };
      res.json(resp);
      return;
    }

    const [suiRaw, dusdcRaw] = await Promise.all([
      getCoinBalance(session.ephemeralAddress, '0x2::sui::SUI'),
      getCoinBalance(session.ephemeralAddress, DUSDC_TYPE),
    ]);

    // Convert from MIST (9 decimals) to SUI, and from USDC base units (6 decimals)
    const suiAmount = (Number(suiRaw) / 1e9).toFixed(4);
    const dusdcAmount = (Number(dusdcRaw) / 1e6).toFixed(2);

    const resp: BalanceResponse = {
      sui: suiAmount,
      dusdc: dusdcAmount,
      manager: session.managerId ?? '',
    };
    res.json(resp);
  } catch (err) {
    console.error('[balance] Error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
