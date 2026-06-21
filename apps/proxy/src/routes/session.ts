/**
 * Route: Session Management
 * POST /api/session  — Register an ephemeral session
 * DELETE /api/session/:sid — Revoke a session
 * GET /api/session/:sid — Check session status (for debugging)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  createSession,
  deleteSession,
  getSession,
  setSessionManager,
} from '../session.js';
import {
  createAndFundPredictManager,
  keypairFromSecret,
} from '../sui.js';
import type { SessionCreateRequest } from '../types.js';

const router = Router();

// POST /api/session
// Body: { sid, privkey, ephemeralAddress, userAddress }
router.post('/', (req: Request, res: Response) => {
  const { sid, privkey, ephemeralAddress, userAddress } =
    req.body as SessionCreateRequest;

  if (!sid || !privkey || !ephemeralAddress || !userAddress) {
    res.status(400).json({ ok: 0, error: 'Missing required fields' });
    return;
  }

  // Basic validation
  if (sid.length < 8 || sid.length > 64) {
    res.status(400).json({ ok: 0, error: 'Invalid session ID' });
    return;
  }

  try {
    const derivedAddress = keypairFromSecret(privkey).getPublicKey().toSuiAddress();
    if (derivedAddress !== ephemeralAddress) {
      res.status(400).json({ ok: 0, error: 'Private key/address mismatch' });
      return;
    }
    createSession(sid, privkey, ephemeralAddress, userAddress);
    res.json({ ok: 1, sid, expires_in: 3600 });
  } catch (err) {
    console.error('[session] Create error:', err);
    res.status(500).json({ ok: 0, error: 'Internal error' });
  }
});

router.post('/:sid/initialize', async (req: Request, res: Response) => {
  const session = getSession(req.params.sid);
  if (!session) {
    res.status(404).json({ ok: 0, error: 'Session not found or expired' });
    return;
  }
  if (session.managerId) {
    res.json({ ok: 1, managerId: session.managerId });
    return;
  }

  try {
    const result = await createAndFundPredictManager(
      keypairFromSecret(session.keypairSecretKey),
    );
    setSessionManager(req.params.sid, result.managerId);
    res.json({ ok: 1, managerId: result.managerId, digest: result.digest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: 0, error: message });
  }
});

// DELETE /api/session/:sid
router.delete('/:sid', (req: Request, res: Response) => {
  const { sid } = req.params;
  const existed = deleteSession(sid);
  res.json({ ok: 1, deleted: existed });
});

// GET /api/session/:sid (debug only)
router.get('/:sid', (req: Request, res: Response) => {
  const { sid } = req.params;
  const session = getSession(sid);
  if (!session) {
    res.status(404).json({ ok: 0, error: 'Session not found or expired' });
    return;
  }
  // Never expose the private key!
  res.json({
    ok: 1,
    sid,
    userAddress: session.userAddress,
    ephemeralAddress: session.ephemeralAddress,
    managerId: session.managerId ?? null,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
});

export default router;
