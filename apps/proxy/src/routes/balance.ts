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
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSession } from '../session.js';
import { getSuiBalance, getUsdcBalance } from '../sui.js';
import type { BalanceResponse } from '../types.js';

const router = Router();

// GET /api/balance/:sid
router.get('/:sid', async (req: Request, res: Response) => {
  const { sid } = req.params;

  const session = getSession(sid);
  if (!session) {
    res.status(401).json({ error: 'Session not found or expired' });
    return;
  }

  try {
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(session.keypairSecretKey, 'base64'),
    );
    const ephemeralAddress = keypair.getPublicKey().toSuiAddress();

    const [suiRaw, usdcRaw] = await Promise.all([
      getSuiBalance(ephemeralAddress),
      getUsdcBalance(ephemeralAddress),
    ]);

    // Convert from MIST (9 decimals) to SUI, and from USDC base units (6 decimals)
    const suiAmount = (Number(suiRaw) / 1e9).toFixed(4);
    const usdcAmount = (Number(usdcRaw) / 1e6).toFixed(2);

    const resp: BalanceResponse = {
      sui: suiAmount,
      usdc: usdcAmount,
    };
    res.json(resp);
  } catch (err) {
    console.error('[balance] Error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
