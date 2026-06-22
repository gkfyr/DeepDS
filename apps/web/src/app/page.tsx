'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Brand } from '../components/Brand';

const DUMMY_MODE = process.env.NEXT_PUBLIC_DUMMY_MODE === 'true';

function DeepDsDevice() {
  return (
    <div className="device-shell" aria-label="DeepDS dual-screen trading terminal preview">
      <div className="mb-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <Image
            src="/deepds-logo.png"
            alt=""
            width={20}
            height={20}
            className="rounded-[5px] bg-white object-contain"
          />
          <span className="h-2 w-2 rounded-full bg-ds-coral" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ds-muted">
          DeepDS / {DUMMY_MODE ? 'dummy' : 'testnet'}
        </span>
      </div>

      <div className="device-screen screen-grid aspect-[5/3] p-5 sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#78bdf2]">
              BTC · 15 min
            </div>
            <div className="mt-1 font-mono text-2xl font-medium text-white sm:text-3xl">
              $64,141
            </div>
          </div>
          <div className="rounded-full border border-[#2e5774] px-2.5 py-1 font-mono text-[9px] text-[#92d2ff]">
            LIVE
          </div>
        </div>

        <div className="mt-6 flex h-16 items-end gap-1">
          {[30, 38, 34, 48, 43, 58, 52, 66, 61, 76, 69, 84, 78, 90].map(
            (height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-sm bg-ds-blue"
                style={{ height: `${height}%`, opacity: 0.35 + index * 0.04 }}
              />
            ),
          )}
        </div>

        <div className="mt-4 flex justify-between border-t border-[#24465f] pt-3 font-mono text-[9px] text-[#6d9cbd]">
          <span>STRIKE $64,141</span>
          <span>09:30 LEFT</span>
        </div>
      </div>

      <div className="device-hinge" />

      <div className="device-screen aspect-[4/2.45] p-5 sm:p-6">
        <div className="grid h-full grid-cols-2 gap-3">
          <div className="flex flex-col justify-between rounded-[14px] border border-[#235b4e] bg-[#0d302d] p-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#6ed4b2]">
              BTC above strike
            </span>
            <div>
              <div className="text-2xl font-extrabold tracking-[-0.04em] text-white">UP</div>
              <div className="mt-1 font-mono text-xs text-[#79dabc]">50.0¢</div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-[14px] border border-[#713f49] bg-[#351b27] p-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#f0a1ad]">
              BTC below strike
            </span>
            <div>
              <div className="text-2xl font-extrabold tracking-[-0.04em] text-white">DOWN</div>
              <div className="mt-1 font-mono text-xs text-[#ffadb8]">50.0¢</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#d5dfe6] shadow-inner">
          <div className="relative h-7 w-7">
            <span className="absolute left-2.5 top-0 h-7 w-2 rounded-sm bg-[#aebdc8]" />
            <span className="absolute left-0 top-2.5 h-2 w-7 rounded-sm bg-[#aebdc8]" />
          </div>
        </div>
        <div className="flex gap-2">
          <span className="h-7 w-7 rounded-full bg-ds-blue shadow-[inset_0_-3px_0_rgba(0,0,0,.12)]" />
          <span className="mt-5 h-7 w-7 rounded-full bg-ds-coral shadow-[inset_0_-3px_0_rgba(0,0,0,.12)]" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const account = useCurrentAccount();

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="site-shell">
        <header className="site-header">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-ds-blue-soft px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ds-ink sm:inline">
              {DUMMY_MODE ? 'Local dummy' : 'Sui testnet'}
            </span>
            {!DUMMY_MODE && (
              <div className="hidden sm:block">
                <ConnectButton />
              </div>
            )}
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-80px)] items-center gap-14 pb-20 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-16">
          <div className="hero-copy max-w-xl">
            <p className="eyebrow mb-6">DeepBook Predict, in your hands</p>
            <h1 className="display-title">
              Trade the
              <br />
              next move.
            </h1>
            <p className="body-copy mt-8 max-w-lg">
              {DUMMY_MODE
                ? 'Turn a Nintendo 3DS into a pocket-sized BTC prediction terminal. Run the full console UI locally with virtual funds.'
                : 'Turn a Nintendo 3DS into a pocket-sized BTC prediction terminal. One wallet approval, then tap UP or DOWN on real Sui markets.'}
            </p>

            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {account || DUMMY_MODE ? (
                <Link href="/session" className="primary-button">
                  {DUMMY_MODE ? 'Start dummy session' : 'Create a 3DS session'}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <ConnectButton />
                  <span className="pl-2 text-xs text-ds-muted">
                    Connect a testnet wallet to begin
                  </span>
                </div>
              )}
              <a href="#how-it-works" className="secondary-button">
                See how it works
              </a>
            </div>

            {(account || DUMMY_MODE) && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-ds-line bg-white px-3 py-2 font-mono text-[10px] text-ds-muted">
                <span className="status-dot" />
                {DUMMY_MODE
                  ? 'No wallet · no chain · local mock'
                  : `${account!.address.slice(0, 8)}…${account!.address.slice(-6)}`}
              </div>
            )}
          </div>

          <div className="relative py-4">
            <div className="absolute -left-8 top-10 h-24 w-24 rounded-full bg-ds-blue-soft blur-2xl" />
            <div className="absolute -right-16 bottom-10 h-40 w-40 rounded-full bg-[#ffdede] blur-3xl" />
            <DeepDsDevice />
          </div>
        </section>
      </div>

      <section id="how-it-works" className="border-y border-ds-line bg-white py-24">
        <div className="site-shell">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="eyebrow mb-4">
                {DUMMY_MODE ? 'No tokens. Real hardware.' : 'One approval. Many taps.'}
              </p>
              <h2 className="section-title">Simple enough for a handheld.</h2>
              <p className="mt-5 max-w-md leading-7 text-ds-muted">
                {DUMMY_MODE
                  ? 'The local proxy simulates the market, balance, and fills. Your 3DS runs the same networking, controls, and rendering as live mode.'
                  : 'The browser handles wallet security. The proxy handles Sui. Your 3DS only needs to show the market and send a choice.'}
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[28px] border border-ds-line bg-ds-line sm:grid-cols-3">
              {[
                {
                  label: DUMMY_MODE ? 'Allocate' : 'Approve',
                  title: DUMMY_MODE ? 'Set virtual funds' : 'Set a small allowance',
                  copy: DUMMY_MODE
                    ? 'Choose the pretend dUSDC balance used by the local session.'
                    : 'Choose exactly how much dUSDC the temporary session can use.',
                },
                {
                  label: 'Pair',
                  title: 'Open it on your 3DS',
                  copy: 'Scan the session QR or enter the local proxy address manually.',
                },
                {
                  label: 'Predict',
                  title: 'Tap UP or DOWN',
                  copy: DUMMY_MODE
                    ? 'The proxy returns a mock digest and subtracts the simulated cost.'
                    : 'The proxy signs the Predict transaction and returns the digest.',
                },
              ].map((item) => (
                <article key={item.label} className="bg-white p-7">
                  <div className="mb-10 font-mono text-[10px] uppercase tracking-[0.14em] text-ds-blue">
                    {item.label}
                  </div>
                  <h3 className="text-lg font-extrabold tracking-[-0.03em] text-ds-ink">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-ds-muted">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="site-shell flex flex-col gap-3 py-8 text-xs text-ds-muted sm:flex-row sm:items-center sm:justify-between">
        <span>DeepDS · Sui Overflow 2026</span>
        <span className="font-mono">DeepBook Predict × Nintendo 3DS</span>
      </footer>
    </main>
  );
}
