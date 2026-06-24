/**
 * Proxy API client for the web frontend.
 * Communicates with apps/proxy over the local network.
 */

const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:3001';

export interface SessionPayload {
  sid: string;
  privkey: string;
  ephemeralAddress: string;
  userAddress: string;
  allowance?: string;
}

export interface MarketData {
  marketName: string;
  spot: number;
  strike: number;
  up: number;
  down: number;
  expiry: number;
  oracle: string;
  status: string;
  ts: number;
}

export interface BalanceData {
  sui: string;
  dusdc: string;
  manager: string;
}

/** Register an ephemeral session with the proxy */
export async function registerSession(
  payload: SessionPayload,
  baseUrl = PROXY_URL,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to register session: ${(err as { error?: string }).error ?? response.statusText}`,
    );
  }
}

/** Create and fund the ephemeral key's PredictManager after wallet funding */
export async function initializeSession(
  sid: string,
  baseUrl = PROXY_URL,
): Promise<{ managerId: string; digest?: string }> {
  const response = await fetch(`${baseUrl}/api/session/${sid}/initialize`, {
    method: 'POST',
  });
  const result = (await response.json().catch(() => ({}))) as {
    managerId?: string;
    digest?: string;
    error?: string;
  };
  if (!response.ok || !result.managerId) {
    throw new Error(result.error ?? 'Failed to initialize PredictManager');
  }
  return { managerId: result.managerId, digest: result.digest };
}

/** Revoke a session from the proxy */
export async function revokeSession(
  sid: string,
  baseUrl = PROXY_URL,
): Promise<void> {
  await fetch(`${baseUrl}/api/session/${sid}`, { method: 'DELETE' });
}

/** Fetch current market data for a pool */
export async function fetchMarketData(
  baseUrl = PROXY_URL,
): Promise<MarketData | null> {
  try {
    const response = await fetch(`${baseUrl}/api/market-data`);
    if (!response.ok) return null;
    return response.json() as Promise<MarketData>;
  } catch {
    return null;
  }
}

/** Check the balance of the ephemeral address */
export async function fetchBalance(
  sid: string,
  baseUrl = PROXY_URL,
): Promise<BalanceData | null> {
  try {
    const response = await fetch(`${baseUrl}/api/balance/${sid}`);
    if (!response.ok) return null;
    return response.json() as Promise<BalanceData>;
  } catch {
    return null;
  }
}

export { PROXY_URL };
