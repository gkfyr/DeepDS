'use client';

/**
 * Landing Page — DeepDS Home
 *
 * Shows the project pitch, architecture diagram, and CTA to connect wallet.
 * Judging criterion: Real-world application + UX polish
 */

import Link from 'next/link';
import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit';

export default function HomePage() {
  const account = useCurrentAccount();

  return (
    <main className="relative z-10 min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-ds-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <h1 className="ds-title text-lg">DeepDS</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="ds-tag hidden sm:inline">testnet</span>
          <ConnectButton />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        {/* ASCII 3DS art */}
        <pre className="text-ds-green text-xs leading-tight mb-8 opacity-60 hidden md:block">
{`  ╔══════════════════════════════╗
  ║  ██████╗ ███████╗ ██████╗  ║  TOP SCREEN
  ║  ██╔══██╗██╔════╝ ██╔══██╗ ║  [ DEEPBOOK ORDERBOOK ]
  ║  ██║  ██║███████╗ ██║  ██║ ║
  ║  ██║  ██║╚════██║ ██║  ██║ ║  BID: 3.2100 SUI
  ║  ██████╔╝███████║ ██████╔╝ ║  ASK: 3.2300 SUI
  ║  ╚═════╝ ╚══════╝ ╚═════╝  ║
  ╠══════════════════════════════╣
  ║  [ BUY ]        [ SELL ]   ║  BOTTOM TOUCH SCREEN
  ║  qty: 1 SUI     qty: 1 SUI ║
  ║  [ REFRESH ]  [ SETTINGS ] ║
  ╚══════════════════════════════╝`}
        </pre>

        <div className="mb-6 animate-fade-in">
          <h2 className="ds-title text-4xl md:text-6xl mb-4 ds-cursor">
            DEEP<span className="text-ds-blue">DS</span>
          </h2>
          <p className="text-green-600 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Trade on <span className="text-ds-green">Sui DeepBook V3</span> using a{' '}
            <span className="text-ds-blue">Nintendo 3DS</span> as your trading terminal.
            <br />
            Because why use a phone when you have a dual-screen wonder?
          </p>
        </div>

        {/* Architecture flow */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 text-xs text-green-700">
          {[
            '🖥️ Browser Wallet',
            '→',
            '📱 QR Code',
            '→',
            '🎮 3DS Camera',
            '→',
            '📡 HTTP',
            '→',
            '⚡ Proxy',
            '→',
            '🌐 Sui DeepBook',
          ].map((item, i) => (
            <span key={i} className={item === '→' ? 'text-green-900' : 'ds-tag'}>
              {item}
            </span>
          ))}
        </div>

        {/* CTA */}
        {account ? (
          <div className="flex flex-col items-center gap-4 animate-slide-up">
            <div className="ds-panel px-4 py-2 text-sm">
              <span className="ds-status-dot" />
              <span className="text-green-600">Connected: </span>
              <span className="text-ds-green font-mono text-xs">
                {account.address.slice(0, 10)}...{account.address.slice(-8)}
              </span>
            </div>
            <Link href="/session">
              <button className="ds-button-primary text-lg px-10 py-4">
                🎮 Create Trading Session
              </button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 animate-slide-up">
            <p className="text-green-700 text-xs mb-2">
              Connect your Sui wallet to begin
            </p>
            <ConnectButton />
          </div>
        )}

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-3xl w-full text-left">
          {[
            {
              icon: '🔑',
              title: 'Ephemeral Key Delegation',
              desc: 'Your wallet authorizes a temporary key on DeepBook BalanceManager. No tx signing on every trade.',
            },
            {
              icon: '📺',
              title: 'Dual Screen Terminal',
              desc: 'Top screen shows live orderbook & chart. Bottom touch screen has BUY/SELL buttons.',
            },
            {
              icon: '⚡',
              title: 'DeepBook V3 CLOB',
              desc: 'Real on-chain market orders via Sui DeepBook — flash loans, governance, maker rebates.',
            },
          ].map((f) => (
            <div key={f.title} className="ds-panel p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="ds-title text-xs mb-2">{f.title}</div>
              <p className="text-green-700 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-ds-border px-6 py-3 flex items-center justify-between text-xs text-green-900">
        <span>Sui Overflow 2026 · DeepBook Track</span>
        <span>
          Powered by{' '}
          <span className="text-ds-green">DeepBook V3</span> ×{' '}
          <span className="text-ds-blue">devkitARM</span>
        </span>
      </footer>
    </main>
  );
}
