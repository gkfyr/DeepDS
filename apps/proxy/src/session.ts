/**
 * Session storage for ephemeral trading sessions.
 *
 * Local development uses process memory. Vercel deployments use an Upstash
 * Redis REST database so different Function instances share the same session.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { EphemeralSession } from './types.js';

const SESSION_TTL_SECONDS = 60 * 60;
const SESSION_KEY_PREFIX = 'deepds:session:';
const IS_VERCEL = Boolean(process.env.VERCEL);

interface StoredSession {
  [key: string]: string | undefined;
  keypairSecretKey: string;
  ephemeralAddress: string;
  managerId?: string;
  managerFunded?: string;
  mockBalance?: string;
  userAddress: string;
  expiresAt: string;
  createdAt: string;
}

const memoryStore = new Map<string, EphemeralSession>();

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

function redisKey(sid: string): string {
  return `${SESSION_KEY_PREFIX}${sid}`;
}

function encryptionKey(): Buffer | null {
  const encoded = process.env.SESSION_ENCRYPTION_KEY;
  if (!encoded) {
    if (IS_VERCEL || redis) {
      throw new Error(
        'SESSION_ENCRYPTION_KEY is required when using Redis or Vercel',
      );
    }
    return null;
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

function encryptSecret(secret: string): string {
  const key = encryptionKey();
  if (!key) return `plain:${secret}`;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptSecret(value: string): string {
  if (value.startsWith('plain:')) return value.slice(6);

  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(':');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted session secret');
  }

  const key = encryptionKey();
  if (!key) throw new Error('SESSION_ENCRYPTION_KEY is missing');

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivEncoded, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function requireRedisOnVercel(): void {
  if (IS_VERCEL && !redis) {
    throw new Error(
      'Upstash Redis is required on Vercel. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    );
  }
}

function toStoredSession(session: EphemeralSession): StoredSession {
  return {
    keypairSecretKey: encryptSecret(session.keypairSecretKey),
    ephemeralAddress: session.ephemeralAddress,
    ...(session.managerId ? { managerId: session.managerId } : {}),
    ...(session.managerFunded !== undefined
      ? { managerFunded: session.managerFunded ? '1' : '0' }
      : {}),
    ...(session.mockBalance !== undefined
      ? { mockBalance: session.mockBalance.toString() }
      : {}),
    userAddress: session.userAddress,
    expiresAt: session.expiresAt.toString(),
    createdAt: session.createdAt.toString(),
  };
}

function fromStoredSession(stored: StoredSession): EphemeralSession {
  return {
    keypairSecretKey: decryptSecret(String(stored.keypairSecretKey)),
    ephemeralAddress: String(stored.ephemeralAddress),
    ...(stored.managerId ? { managerId: String(stored.managerId) } : {}),
    ...(stored.managerFunded !== undefined
      ? { managerFunded: stored.managerFunded === '1' }
      : {}),
    ...(stored.mockBalance !== undefined
      ? { mockBalance: BigInt(String(stored.mockBalance)) }
      : {}),
    userAddress: String(stored.userAddress),
    expiresAt: Number(stored.expiresAt),
    createdAt: Number(stored.createdAt),
  };
}

async function saveRedisSession(
  sid: string,
  session: EphemeralSession,
): Promise<void> {
  if (!redis) throw new Error('Redis is not configured');
  const key = redisKey(sid);
  await redis.hset(key, toStoredSession(session));
  await redis.expire(key, SESSION_TTL_SECONDS);
}

export function sessionStorageMode(): 'redis' | 'memory' | 'unconfigured' {
  if (redis) {
    try {
      encryptionKey();
      return 'redis';
    } catch {
      return 'unconfigured';
    }
  }
  if (IS_VERCEL) return 'unconfigured';
  return 'memory';
}

export function isSessionStorageConfigurationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Upstash Redis is required') ||
    error.message.includes('SESSION_ENCRYPTION_KEY')
  );
}

export async function createSession(
  sid: string,
  keypairSecretKey: string,
  ephemeralAddress: string,
  userAddress: string,
  mockBalance?: bigint,
): Promise<void> {
  requireRedisOnVercel();
  const now = Date.now();
  const session: EphemeralSession = {
    keypairSecretKey,
    ephemeralAddress,
    mockBalance,
    userAddress,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };

  if (redis) {
    await saveRedisSession(sid, session);
  } else {
    memoryStore.set(sid, session);
  }
  console.log(`[session] Created session ${sid} for ${userAddress}`);
}

export async function setSessionManager(
  sid: string,
  managerId: string,
  funded = false,
): Promise<void> {
  const session = await getSession(sid);
  if (!session) throw new Error('Session not found or expired');
  session.managerId = managerId;
  session.managerFunded = funded;

  if (redis) {
    await saveRedisSession(sid, session);
  } else {
    memoryStore.set(sid, session);
  }
}

export async function markSessionManagerFunded(sid: string): Promise<void> {
  const session = await getSession(sid);
  if (!session?.managerId) throw new Error('Session manager is not initialized');
  session.managerFunded = true;

  if (redis) {
    await saveRedisSession(sid, session);
  } else {
    memoryStore.set(sid, session);
  }
}

export async function spendMockBalance(
  sid: string,
  amount: bigint,
): Promise<bigint> {
  if (redis) {
    const result = await redis.eval<[string], string | number>(
      `
        local current = redis.call('HGET', KEYS[1], 'mockBalance')
        if not current then return -1 end
        local balance = tonumber(current)
        local amount = tonumber(ARGV[1])
        if balance < amount then return -2 end
        local remaining = balance - amount
        redis.call('HSET', KEYS[1], 'mockBalance', tostring(remaining))
        return tostring(remaining)
      `,
      [redisKey(sid)],
      [amount.toString()],
    );
    if (Number(result) === -1) throw new Error('Mock session not found');
    if (Number(result) === -2) throw new Error('Mock dUSDC allowance exhausted');
    return BigInt(String(result));
  }

  const session = await getSession(sid);
  if (!session || session.mockBalance === undefined) {
    throw new Error('Mock session not found');
  }
  if (session.mockBalance < amount) {
    throw new Error('Mock dUSDC allowance exhausted');
  }

  session.mockBalance -= amount;
  memoryStore.set(sid, session);
  return session.mockBalance;
}

export async function getSession(
  sid: string,
): Promise<EphemeralSession | undefined> {
  requireRedisOnVercel();

  if (redis) {
    const stored = await redis.hgetall<StoredSession>(redisKey(sid));
    if (!stored || Object.keys(stored).length === 0) return undefined;
    const session = fromStoredSession(stored);
    if (Date.now() > session.expiresAt) {
      await redis.del(redisKey(sid));
      return undefined;
    }
    return session;
  }

  const session = memoryStore.get(sid);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    memoryStore.delete(sid);
    return undefined;
  }
  return session;
}

export async function deleteSession(sid: string): Promise<boolean> {
  requireRedisOnVercel();
  if (redis) return (await redis.del(redisKey(sid))) > 0;
  return memoryStore.delete(sid);
}
