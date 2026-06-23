// Shared TypeScript types for the proxy

export interface EphemeralSession {
  keypairSecretKey: string;      // Bech32-encoded Ed25519 secret key
  ephemeralAddress: string;
  managerId?: string;            // PredictManager owned by the ephemeral key
  managerFunded?: boolean;       // dUSDC deposit completed
  mockBalance?: bigint;          // Dummy mode dUSDC balance in base units
  userAddress: string;           // User's main wallet address (for display)
  expiresAt: number;             // Unix timestamp (ms)
  createdAt: number;
}

export interface TradeRequest {
  sid: string;                   // Session ID (UUID)
  action: 'UP' | 'DOWN';
  qty?: string;                  // Position quantity, fixed point 1e9 = 1 unit
}

export interface MarketDataResponse {
  spot: number;
  forward: number;
  strike: number;
  up: number;
  down: number;
  history: number[];
  expiry: number;
  expiresInMs: number;
  oracle: string;
  status: string;
  ts: number;                    // Timestamp
}

export interface TradeResponse {
  ok: 0 | 1;
  digest?: string;
  cost?: string;
  askPrice?: string;
  error?: string;
}

export interface BalanceResponse {
  sui: string;
  dusdc: string;
  manager: string;
}

export interface SessionCreateRequest {
  sid: string;
  privkey: string;               // Bech32 secret key
  ephemeralAddress: string;
  userAddress: string;
  allowance?: string;
}
