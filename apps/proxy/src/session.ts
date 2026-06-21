/**
 * In-memory session store for ephemeral trading sessions.
 * Each session holds a temporary Ed25519 keypair that has been
 * authorized as a trader on the user's DeepBook BalanceManager.
 *
 * Sessions expire after 1 hour and are cleaned up every 5 minutes.
 */

import type { EphemeralSession } from './types.js';

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, EphemeralSession>();

export function createSession(
  sid: string,
  keypairSecretKey: string,
  ephemeralAddress: string,
  userAddress: string,
  mockBalance?: bigint,
): void {
  const now = Date.now();
  store.set(sid, {
    keypairSecretKey,
    ephemeralAddress,
    mockBalance,
    userAddress,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  console.log(`[session] Created session ${sid} for ${userAddress}`);
}

export function setSessionManager(sid: string, managerId: string): void {
  const session = getSession(sid);
  if (!session) throw new Error('Session not found or expired');
  session.managerId = managerId;
}

export function spendMockBalance(sid: string, amount: bigint): bigint {
  const session = getSession(sid);
  if (!session || session.mockBalance === undefined) {
    throw new Error('Mock session not found');
  }
  if (session.mockBalance < amount) {
    throw new Error('Mock dUSDC allowance exhausted');
  }
  session.mockBalance -= amount;
  return session.mockBalance;
}

export function getSession(sid: string): EphemeralSession | undefined {
  const session = store.get(sid);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    store.delete(sid);
    console.log(`[session] Session ${sid} expired`);
    return undefined;
  }
  return session;
}

export function deleteSession(sid: string): boolean {
  const existed = store.has(sid);
  store.delete(sid);
  if (existed) console.log(`[session] Deleted session ${sid}`);
  return existed;
}

export function listSessions(): string[] {
  return Array.from(store.keys());
}

// Background cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sid, session] of store.entries()) {
    if (now > session.expiresAt) {
      store.delete(sid);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[session] Cleaned up ${cleaned} expired sessions`);
  }
}, CLEANUP_INTERVAL_MS);
