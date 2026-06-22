import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

const RPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
} as const;

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  defaultNetwork: 'testnet',
  autoConnect: true,
  // Browser extensions such as Slush still register through Wallet Standard.
  // Disable the hosted Slush initializer so Next.js can prerender safely.
  slushWalletConfig: null,
  createClient(network) {
    return new SuiJsonRpcClient({
      network,
      url: RPC_URLS[network],
    });
  },
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
