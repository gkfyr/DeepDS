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
  isSessionStorageConfigurationError,
  setSessionManager,
} from '../session.js';
import {
  createAndFundPredictManager,
  keypairFromSecret,
} from '../sui.js';
import { DUMMY_MODE, mockId } from '../config.js';
import type { SessionCreateRequest } from '../types.js';

const router = Router();

// POST /api/session
// Body: { sid, privkey, ephemeralAddress, userAddress }
router.post('/', async (req: Request, res: Response) => {
  const { sid, privkey, ephemeralAddress, userAddress, allowance } =
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
    const mockBalance = DUMMY_MODE
      ? BigInt(Math.max(1, Math.round(Number(allowance ?? '5') * 1_000_000)))
      : undefined;
    await createSession(
      sid,
      privkey,
      ephemeralAddress,
      userAddress,
      mockBalance,
    );
    res.json({ ok: 1, sid, expires_in: 3600, mode: DUMMY_MODE ? 'dummy' : 'live' });
  } catch (err) {
    console.error('[session] Create error:', err);
    if (isSessionStorageConfigurationError(err)) {
      res.status(503).json({
        ok: 0,
        error: err instanceof Error ? err.message : 'Session storage unavailable',
      });
      return;
    }
    res.status(500).json({ ok: 0, error: 'Internal error' });
  }
});

router.post('/:sid/initialize', async (req: Request, res: Response) => {
  let session;
  try {
    session = await getSession(req.params.sid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ ok: 0, error: message });
    return;
  }
  if (!session) {
    res.status(404).json({ ok: 0, error: 'Session not found or expired' });
    return;
  }
  if (session.managerId) {
    res.json({ ok: 1, managerId: session.managerId });
    return;
  }

  try {
    if (DUMMY_MODE) {
      const managerId = mockId('mock_manager');
      await setSessionManager(req.params.sid, managerId);
      res.json({
        ok: 1,
        managerId,
        digest: mockId('mock_setup'),
        mode: 'dummy',
      });
      return;
    }

    const result = await createAndFundPredictManager(
      keypairFromSecret(session.keypairSecretKey),
    );
    await setSessionManager(req.params.sid, result.managerId);
    res.json({ ok: 1, managerId: result.managerId, digest: result.digest });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: 0, error: message });
  }
});

// DELETE /api/session/:sid
router.delete('/:sid', async (req: Request, res: Response) => {
  const { sid } = req.params;
  try {
    const existed = await deleteSession(sid);
    res.json({ ok: 1, deleted: existed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ ok: 0, error: message });
  }
});

// GET /api/session/:sid (debug only)
router.get('/:sid', async (req: Request, res: Response) => {
  const { sid } = req.params;
  let session;
  try {
    session = await getSession(sid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ ok: 0, error: message });
    return;
  }
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
    mode: DUMMY_MODE ? 'dummy' : 'live',
  });
});

export default router;
