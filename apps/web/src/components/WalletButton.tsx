'use client';

import { useState } from 'react';
import {
  useDAppKit,
  useWalletConnection,
  useWallets,
} from '@mysten/dapp-kit-react';

export function WalletButton() {
  const dAppKit = useDAppKit();
  const connection = useWalletConnection();
  const wallets = useWallets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (wallet: (typeof wallets)[number]) => {
    setBusy(true);
    setError(null);
    try {
      await dAppKit.connectWallet({ wallet });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (connection.isConnected) {
    return (
      <button
        type="button"
        className="wallet-button"
        onClick={() => void dAppKit.disconnectWallet()}
        title="Disconnect wallet"
      >
        {connection.account.address.slice(0, 6)}…
        {connection.account.address.slice(-4)}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="wallet-button"
        onClick={() => setOpen((value) => !value)}
        disabled={busy || connection.isConnecting || connection.isReconnecting}
      >
        {busy || connection.isConnecting || connection.isReconnecting
          ? 'Connecting…'
          : 'Connect wallet'}
      </button>

      {open && (
        <div className="wallet-menu">
          <p className="data-label px-3 pb-2">Choose a Sui wallet</p>
          {wallets.length > 0 ? (
            wallets.map((wallet) => (
              <button
                key={`${wallet.name}-${wallet.version}`}
                type="button"
                className="wallet-menu-item"
                onClick={() => void connect(wallet)}
                disabled={busy}
              >
                {wallet.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs leading-5 text-ds-muted">
              Install or unlock Slush, then refresh this page.
            </p>
          )}
          {error && (
            <p className="px-3 pt-2 text-xs leading-5 text-[#c94b4b]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
