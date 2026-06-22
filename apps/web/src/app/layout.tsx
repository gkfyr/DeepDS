'use client';

/**
 * Root layout — wraps the app with Sui wallet providers.
 * Uses Sui dApp Kit 2.0 for wallet connection (testnet).
 */

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import './globals.css';
import { dAppKit } from '../lib/dapp-kit';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>DeepDS — Nintendo 3DS Predict Terminal</title>
        <meta
          name="description"
          content="Trade DeepBook Predict on Sui using a Nintendo 3DS. A retro prediction terminal for the Sui Overflow 2026 hackathon."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
      </body>
    </html>
  );
}
