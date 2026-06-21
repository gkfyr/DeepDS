/**
 * Route: Session Management
 * POST /api/session  — Register an ephemeral session
 * DELETE /api/session/:sid — Revoke a session
 * GET /api/session/:sid — Check session status (for debugging)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createSession, deleteSession, getSession } from '../session.js';
import type { SessionCreateRequest } from '../types.js';

const router = Router();

// POST /api/session
// Body: { sid, privkey, balanceManagerId, userAddress }
router.post('/', (req: Request, res: Response) => {
  const { sid, privkey, balanceManagerId, userAddress } =
    req.body as SessionCreateRequest;

  if (!sid || !privkey || !balanceManagerId || !userAddress) {
    res.status(400).json({ ok: 0, error: 'Missing required fields' });
    return;
  }

  // Basic validation
  if (sid.length < 8 || sid.length > 64) {
    res.status(400).json({ ok: 0, error: 'Invalid session ID' });
    return;
  }

  try {
    createSession(sid, privkey, balanceManagerId, userAddress);
    res.json({ ok: 1, sid, expires_in: 3600 });
  } catch (err) {
    console.error('[session] Create error:', err);
    res.status(500).json({ ok: 0, error: 'Internal error' });
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
    balanceManagerId: session.balanceManagerId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
});

export default router;
