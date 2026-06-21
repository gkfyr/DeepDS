/**
 * Ephemeral keypair utilities.
 * Generates a temporary Ed25519 keypair for session delegation.
 *
 * SECURITY: The secret key is held in memory only and sent to the
 * proxy over localhost/LAN. Never persist to localStorage.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

export interface EphemeralKeyPair {
  keypair: Ed25519Keypair;
  address: string;
  /** Sui Bech32 secret key for proxy transmission */
  secretKey: string;
}

/**
 * Generates a fresh Ed25519 ephemeral keypair.
 * Call once per session, discard after use.
 */
export function generateEphemeralKeypair(): EphemeralKeyPair {
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();

  // Export the 32-byte raw secret key as base64 for proxy
  return { keypair, address, secretKey: keypair.getSecretKey() };
}
