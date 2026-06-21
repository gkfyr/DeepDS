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
): Promise<{ managerId: string; digest: string }> {
  const address = keypair.getPublicKey().toSuiAddress();

  const createTx = new Transaction();
  createTx.setSender(address);
  createTx.moveCall({
    target: `${PREDICT_PACKAGE_ID}::predict::create_manager`,
  });
  const created = await execute(createTx, keypair, true);
  const managerEvent = created.events?.find((event) =>
    event.type.endsWith('::predict_manager::PredictManagerCreated'),
  );
  const managerId = (managerEvent?.parsedJson as { manager_id?: string } | undefined)
    ?.manager_id;
  if (!managerId) throw new Error('PredictManagerCreated event was not returned');

  const coins = await suiClient.getCoins({ owner: address, coinType: DUSDC_TYPE });
  if (coins.data.length === 0) {
    throw new Error('No dUSDC found in ephemeral wallet');
  }

  const depositTx = new Transaction();
  depositTx.setSender(address);
  const [primary, ...rest] = coins.data.map((coin) => depositTx.object(coin.coinObjectId));
  if (rest.length > 0) depositTx.mergeCoins(primary!, rest);
  depositTx.moveCall({
    target: `${PREDICT_PACKAGE_ID}::predict_manager::deposit`,
    typeArguments: [DUSDC_TYPE],
    arguments: [depositTx.object(managerId), primary!],
  });
  const deposited = await execute(depositTx, keypair);

  return { managerId, digest: deposited.digest };
}
