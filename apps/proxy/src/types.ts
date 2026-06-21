// Shared TypeScript types for the proxy

export interface EphemeralSession {
  keypairSecretKey: string;      // base64-encoded 32-byte Ed25519 secret key
  balanceManagerId: string;      // Sui object ID of the user's DeepBook BalanceManager
  userAddress: string;           // User's main wallet address (for display)
  expiresAt: number;             // Unix timestamp (ms)
  createdAt: number;
}

export interface TradeRequest {
  sid: string;                   // Session ID (UUID)
  action: 'BUY' | 'SELL';
  qty: string;                   // Quantity in base token units (string to avoid JS number precision issues)
  pool?: string;                 // Pool key, default: 'SUI_USDC'
}

export interface MarketDataResponse {
  bid: number;
  ask: number;
  spread: number;
  vol: number;
  ts: number;                    // Timestamp
}

export interface TradeResponse {
  ok: 0 | 1;
  digest?: string;
  error?: string;
}

export interface BalanceResponse {
  sui: string;
  usdc: string;
}

export interface SessionCreateRequest {
  sid: string;
  privkey: string;               // base64 secret key
  balanceManagerId: string;
  userAddress: string;
}
