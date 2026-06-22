import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

export const NETWORK = (process.env.SUI_NETWORK as 'testnet' | 'mainnet') ?? 'testnet';
export const PREDICT_PACKAGE_ID =
  process.env.PREDICT_PACKAGE_ID ??
  '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
export const PREDICT_ID =
  process.env.PREDICT_ID ??
  '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a';
export const DUSDC_TYPE =
  process.env.DUSDC_COIN_TYPE ??
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';
export const CLOCK_ID = '0x6';

export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

const OBJECT_READY_ATTEMPTS = 12;
const OBJECT_READY_DELAY_MS = 750;
const DEPOSIT_SUBMIT_ATTEMPTS = 6;
const DEPOSIT_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObjectVisibilityRace(error: unknown, objectId: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('"code":"notExists"') &&
    message.toLowerCase().includes(objectId.toLowerCase())
  );
}

async function waitForSharedObject(objectId: string): Promise<{
  objectId: string;
  initialSharedVersion: string | number;
}> {
  let lastError = 'object is not available';
  for (let attempt = 1; attempt <= OBJECT_READY_ATTEMPTS; attempt++) {
    const response = await suiClient.getObject({
      id: objectId,
      options: { showOwner: true, showType: true },
    });
    if (response.data) {
      const owner = response.data.owner;
      if (
        owner &&
        typeof owner === 'object' &&
        'Shared' in owner
      ) {
        return {
          objectId,
          initialSharedVersion: owner.Shared.initial_shared_version,
        };
      }
      lastError = `object ${objectId} is not shared`;
    } else if (response.error) {
      lastError = response.error.code;
    }
    await sleep(OBJECT_READY_DELAY_MS);
  }
  throw new Error(`PredictManager is not ready: ${lastError}`);
}

async function waitForDusdcCoins(address: string) {
  for (let attempt = 1; attempt <= OBJECT_READY_ATTEMPTS; attempt++) {
    const coins = await suiClient.getCoins({
      owner: address,
      coinType: DUSDC_TYPE,
    });
    if (coins.data.length > 0) return coins.data;
    await sleep(OBJECT_READY_DELAY_MS);
  }
  throw new Error(
    'Transferred dUSDC is not visible yet. Wait a few seconds and retry initialization.',
  );
}

export function keypairFromSecret(secretKey: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(secretKey);
}

export async function execute(
  tx: Transaction,
  keypair: Ed25519Keypair,
  showEvents = false,
) {
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents,
      showObjectChanges: showEvents,
    },
  });
  const status = result.effects?.status;
  if (status?.status === 'failure') {
    throw new Error(status.error ?? 'Sui transaction failed');
  }
  return result;
}

export async function getCoinBalance(address: string, coinType: string): Promise<bigint> {
  const balance = await suiClient.getBalance({ owner: address, coinType });
  return BigInt(balance.totalBalance);
}

export async function createAndFundPredictManager(
  keypair: Ed25519Keypair,
  existingManagerId?: string,
  onManagerCreated?: (managerId: string) => Promise<void>,
): Promise<{ managerId: string; digest: string }> {
  const address = keypair.getPublicKey().toSuiAddress();

  let managerId = existingManagerId;
  if (!managerId) {
    const createTx = new Transaction();
    createTx.setSender(address);
    createTx.moveCall({
      target: `${PREDICT_PACKAGE_ID}::predict::create_manager`,
    });
    const created = await execute(createTx, keypair, true);
    await suiClient.waitForTransaction({
      digest: created.digest,
      options: { showEffects: true },
    });
    const managerEvent = created.events?.find((event) =>
      event.type.endsWith('::predict_manager::PredictManagerCreated'),
    );
    managerId = (
      managerEvent?.parsedJson as { manager_id?: string } | undefined
    )?.manager_id;
    if (!managerId) {
      throw new Error('PredictManagerCreated event was not returned');
    }
    if (onManagerCreated) await onManagerCreated(managerId);
  }

  /*
   * Testnet's public RPC hostname is load-balanced. Immediately after
   * create_manager, one backend can return the new shared object while the
   * backend receiving the deposit transaction still reports it as notExists.
   * Rebuild and resubmit only that safe pre-execution validation failure.
   */
  for (let attempt = 1; attempt <= DEPOSIT_SUBMIT_ATTEMPTS; attempt++) {
    const [managerRef, coins] = await Promise.all([
      waitForSharedObject(managerId),
      waitForDusdcCoins(address),
    ]);

    const depositTx = new Transaction();
    depositTx.setSender(address);
    const [primary, ...rest] = coins.map((coin) =>
      depositTx.objectRef({
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
      }),
    );
    if (rest.length > 0) depositTx.mergeCoins(primary!, rest);
    depositTx.moveCall({
      target: `${PREDICT_PACKAGE_ID}::predict_manager::deposit`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        depositTx.sharedObjectRef({
          objectId: managerRef.objectId,
          initialSharedVersion: managerRef.initialSharedVersion,
          mutable: true,
        }),
        primary!,
      ],
    });

    try {
      const deposited = await execute(depositTx, keypair);
      return { managerId, digest: deposited.digest };
    } catch (error) {
      if (
        attempt === DEPOSIT_SUBMIT_ATTEMPTS ||
        !isObjectVisibilityRace(error, managerId)
      ) {
        throw error;
      }
      await sleep(DEPOSIT_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('PredictManager deposit retry limit reached');
}
