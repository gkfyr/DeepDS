/**
 * Proxy API client for the web frontend.
 * Communicates with apps/proxy over the local network.
 */

const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:3001';

export interface SessionPayload {
  sid: string;
  privkey: string;
  balanceManagerId: string;
  userAddress: string;
}

export interface MarketData {
  bid: number;
  ask: number;
  spread: number;
  vol: number;
  ts: number;
}

export interface BalanceData {
  sui: string;
  usdc: string;
}

/** Register an ephemeral session with the proxy */
export async function registerSession(payload: SessionPayload): Promise<void> {
  const response = await fetch(`${PROXY_URL}/api/session`, {
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

/** Revoke a session from the proxy */
export async function revokeSession(sid: string): Promise<void> {
  await fetch(`${PROXY_URL}/api/session/${sid}`, { method: 'DELETE' });
}

/** Fetch current market data for a pool */
export async function fetchMarketData(
  pool = 'SUI_USDC',
): Promise<MarketData | null> {
  try {
    const response = await fetch(
      `${PROXY_URL}/api/market-data?pool=${pool}`,
    );
    if (!response.ok) return null;
    return response.json() as Promise<MarketData>;
  } catch {
    return null;
  }
}

/** Check the balance of the ephemeral address */
export async function fetchBalance(
  sid: string,
): Promise<BalanceData | null> {
  try {
    const response = await fetch(`${PROXY_URL}/api/balance/${sid}`);
    if (!response.ok) return null;
    return response.json() as Promise<BalanceData>;
  } catch {
    return null;
  }
}

export { PROXY_URL };
