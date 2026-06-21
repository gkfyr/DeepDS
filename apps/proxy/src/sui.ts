/**
 * Sui client and DeepBook client setup.
 * Uses testnet for PoC. Switch to 'mainnet' for production.
 *
 * DeepBook V3 Key concepts:
 * - BalanceManager: shared Sui object that holds user's trading funds
 * - Pool: each trading pair (SUI/USDC) has an on-chain Pool object
 * - Trades are executed by signing PTBs with the ephemeral keypair
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeepBookClient } from '@mysten/deepbook-v3';

// --- Environment ---
const NETWORK = (process.env.SUI_NETWORK as 'testnet' | 'mainnet') ?? 'testnet';

// --- Shared Sui Client (read-only, no signer) ---
export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

/**
 * Creates a signer-specific DeepBookClient using the session's ephemeral keypair.
 * Each trade request creates its own client instance.
 */
export function makeDeepBookClient(secretKeyBase64: string): {
  dbClient: DeepBookClient;
  keypair: Ed25519Keypair;
} {
  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(secretKeyBase64, 'base64'),
  );

  const dbClient = new DeepBookClient({
    client: suiClient,
    signer: keypair,
    env: NETWORK,
  });

  return { dbClient, keypair };
}

/**
 * Get SUI balance for an address.
 */
export async function getSuiBalance(address: string): Promise<bigint> {
  const balance = await suiClient.getBalance({
    owner: address,
    coinType: '0x2::sui::SUI',
  });
  return BigInt(balance.totalBalance);
}

/**
 * Get USDC balance for an address.
 * USDC coin type on testnet/mainnet — using Sui's native USDC.
 *
 * TODO: Verify the correct USDC coin type for your target network.
 * Testnet: 0x...::usdc::USDC (from faucet or Circle bridge)
 */
export async function getUsdcBalance(address: string): Promise<bigint> {
  try {
    // On testnet, we use a mock USDC or the test USDC from the faucet
    // For PoC: if USDC not found, return 0
    const USDC_TYPE =
      process.env.USDC_COIN_TYPE ??
      '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'; // Mainnet Circle USDC

    const balance = await suiClient.getBalance({
      owner: address,
      coinType: USDC_TYPE,
    });
    return BigInt(balance.totalBalance);
  } catch {
    return 0n;
  }
}

export { NETWORK };
