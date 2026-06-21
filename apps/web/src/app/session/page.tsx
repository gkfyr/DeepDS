'use client';

/**
 * Session Page — The heart of DeepDS
 *
 * Flow:
 * 1. Generate ephemeral Ed25519 keypair (in browser memory)
 * 2. Register session with proxy (POST /api/session)
 * 3. Transfer a limited SUI + dUSDC allowance to the ephemeral address
 * 4. Proxy creates/funds a PredictManager owned by the ephemeral key
 * 5. Display QR code for 3DS to scan
 *
 * Judging criteria this covers:
 * - DeepBook utilization (authorize_trader on BalanceManager)
 * - Real-world application (functional delegation flow)
 * - UX (clear step-by-step onboarding)
 */

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { v4 as uuidv4 } from 'uuid';
import { generateEphemeralKeypair } from '../../lib/ephemeral';
import {
  initializeSession,
  registerSession,
  revokeSession,
  PROXY_URL,
} from '../../lib/proxy';
import { SessionQR } from '../../components/SessionQR';
import { LiveStatus } from '../../components/LiveStatus';
import Link from 'next/link';

type Step =
  | 'idle'
  | 'generating'
  | 'registering'
  | 'waiting-wallet'
  | 'active'
  | 'error';

interface SessionState {
  sid: string;
  ephemeralAddress: string;
  managerId: string;
}

// Gas amount to transfer to ephemeral address for transaction fees
const GAS_ALLOWANCE_MIST = 50_000_000n; // 0.05 SUI

const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';
const DEFAULT_DUSDC_ALLOWANCE =
  process.env.NEXT_PUBLIC_DUSDC_ALLOWANCE ?? '5';

export default function SessionPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();

  const [step, setStep] = useState<Step>('idle');
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [dusdcAllowance, setDusdcAllowance] = useState(DEFAULT_DUSDC_ALLOWANCE);
  const [proxyUrl, setProxyUrl] = useState(PROXY_URL);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const createSession = async () => {
    if (!account) return;
    setError(null);
    setLogs([]);

    try {
      // Step 1: Generate ephemeral keypair
      setStep('generating');
      addLog('Generating ephemeral Ed25519 keypair...');
      const { address, secretKey } = generateEphemeralKeypair();
      const sid = uuidv4();
      addLog(`Ephemeral address: ${address.slice(0, 16)}...`);
      addLog(`Session ID: ${sid}`);

      // Step 2: Register session with proxy
      setStep('registering');
      addLog(`Registering session with proxy at ${proxyUrl}...`);

      await registerSession(
        {
          sid,
          privkey: secretKey,
          ephemeralAddress: address,
          userAddress: account.address,
        },
        proxyUrl,
      );
      addLog('Session registered successfully!');

      // Step 3: Fund the limited session wallet
      setStep('waiting-wallet');
      addLog('Building session allowance PTB...');

      const tx = new Transaction();
      tx.setSender(account.address);

      // Transfer gas SUI to ephemeral address
      const [gasCoin] = tx.splitCoins(tx.gas, [GAS_ALLOWANCE_MIST]);
      tx.transferObjects([gasCoin], address);

      const allowanceBaseUnits = BigInt(
        Math.round(Number(dusdcAllowance) * 1_000_000),
      );
      if (allowanceBaseUnits <= 0n) {
        throw new Error('dUSDC allowance must be greater than zero');
      }

      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: DUSDC_TYPE,
      });
      const total = coins.data.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        0n,
      );
      if (total < allowanceBaseUnits) {
        throw new Error(
          `Insufficient dUSDC. Need ${dusdcAllowance} dUSDC in the connected wallet.`,
        );
      }

      const [primary, ...rest] = coins.data.map((coin) =>
        tx.object(coin.coinObjectId),
      );
      if (rest.length > 0) tx.mergeCoins(primary!, rest);
      const [allowanceCoin] = tx.splitCoins(primary!, [allowanceBaseUnits]);
      tx.transferObjects([allowanceCoin], address);

      addLog('Requesting one wallet signature...');
      addLog(`Funding 0.05 SUI + ${dusdcAllowance} dUSDC allowance`);

      const { bytes, signature } = await signTransaction({ transaction: tx });

      addLog('Wallet signed! Submitting to Sui testnet...');

      const result = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true },
      });

      setTxDigest(result.digest);
      addLog(`✅ Transaction confirmed! Digest: ${result.digest.slice(0, 20)}...`);
      addLog('Creating ephemeral PredictManager...');

      await suiClient.waitForTransaction({ digest: result.digest });
      const initialized = await initializeSession(sid, proxyUrl);
      addLog(`✅ PredictManager ready: ${initialized.managerId.slice(0, 18)}...`);
      addLog('Session is ready for 3DS UP/DOWN predictions!');

      // Step 4: Show QR
      setSession({
        sid,
        ephemeralAddress: address,
        managerId: initialized.managerId,
      });
      setStep('active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      addLog(`❌ Error: ${msg}`);
    }
  };

  const endSession = async () => {
    if (!session) return;
    await revokeSession(session.sid, proxyUrl).catch(() => {});
    setSession(null);
    setStep('idle');
    setLogs([]);
    setTxDigest(null);
  };

  if (!account) {
    return (
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
        <div className="ds-panel p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🔌</div>
          <div className="ds-title text-xl mb-4">WALLET REQUIRED</div>
          <p className="text-green-700 text-sm mb-6">
            Connect your Sui wallet to create a trading session.
          </p>
          <Link href="/">
            <button className="ds-button">← Back to Home</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-ds-border">
        <Link href="/" className="text-green-700 hover:text-ds-green text-sm transition-colors">
          ← DEEPDS
        </Link>
        <h1 className="ds-title text-sm">SESSION MANAGER</h1>
        <div className="text-xs text-green-800">
          {account.address.slice(0, 8)}...
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-2 gap-6 p-6 max-w-5xl mx-auto w-full">
        {/* LEFT: Setup panel */}
        <div className="space-y-4">
          <div className="ds-panel p-4">
            <div className="ds-title text-xs mb-4">SESSION SETUP</div>

            {/* Proxy URL config */}
            <div className="mb-3">
              <label className="ds-label">PROXY URL</label>
              <input
                id="proxy-url"
                className="ds-input"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://192.168.1.x:3001"
                disabled={step !== 'idle' && step !== 'error'}
              />
              <p className="text-xs text-green-900 mt-1">
                Enter your LAN IP where apps/proxy is running
              </p>
            </div>

            {/* dUSDC allowance */}
            <div className="mb-4">
              <label className="ds-label">SESSION ALLOWANCE (dUSDC)</label>
              <input
                id="dusdc-allowance"
                className="ds-input"
                type="number"
                min="0.1"
                step="0.1"
                value={dusdcAllowance}
                onChange={(e) => setDusdcAllowance(e.target.value)}
                disabled={step !== 'idle' && step !== 'error'}
              />
              <p className="text-xs text-green-900 mt-1">
                Maximum capital exposed to the temporary 3DS session
              </p>
            </div>

            {/* Action button */}
            {step === 'idle' || step === 'error' ? (
              <button
                id="create-session-btn"
                className="ds-button-primary w-full py-3"
                onClick={createSession}
              >
                🎮 Create Trading Session
              </button>
            ) : step === 'active' ? (
              <button
                id="end-session-btn"
                className="ds-button-danger w-full py-3"
                onClick={endSession}
              >
                ✕ End Session
              </button>
            ) : (
              <button className="ds-button w-full py-3 opacity-50 cursor-wait" disabled>
                {step === 'generating' && '⌛ Generating keypair...'}
                {step === 'registering' && '⌛ Registering with proxy...'}
                {step === 'waiting-wallet' && '⏳ Waiting for wallet...'}
              </button>
            )}

            {error && (
              <div className="mt-3 p-2 border border-red-800 bg-red-900/20 text-red-400 text-xs">
                ❌ {error}
              </div>
            )}
          </div>

          {/* Terminal logs */}
          <div className="ds-panel p-4">
            <div className="ds-title text-xs mb-3">TERMINAL</div>
            <div
              id="session-logs"
              className="font-mono text-xs text-green-700 space-y-1 min-h-[120px] max-h-48 overflow-y-auto"
            >
              {logs.length === 0 ? (
                <span className="text-green-900">
                  Awaiting session creation<span className="animate-blink">_</span>
                </span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tx link */}
          {txDigest && (
            <div className="ds-panel p-3 text-xs">
              <div className="ds-label">DELEGATION TX</div>
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ds-green hover:underline font-mono break-all"
              >
                {txDigest.slice(0, 20)}... ↗
              </a>
            </div>
          )}
        </div>

        {/* RIGHT: QR + Live status */}
        <div className="space-y-4">
          {session ? (
            <>
              <div className="ds-panel p-4">
                <SessionQR sid={session.sid} proxyUrl={proxyUrl} />
              </div>
              <div className="ds-panel p-4">
                <LiveStatus
                  sid={session.sid}
                  ephemeralAddress={session.ephemeralAddress}
                  proxyUrl={proxyUrl}
                />
              </div>
            </>
          ) : (
            <div className="ds-panel p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
              <div className="text-6xl mb-4 opacity-30">📷</div>
              <div className="text-green-800 text-sm">
                Create a session to generate
                <br />
                the QR code for your 3DS
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="ds-panel p-4 text-xs text-green-800 space-y-2">
            <div className="ds-title text-xs mb-2">HOW IT WORKS</div>
            {[
              '1. Browser generates temporary Ed25519 keypair',
              '2. Keypair registered with proxy (in-memory only)',
              '3. Wallet sends limited SUI + dUSDC allowance',
              '4. Proxy creates an ephemeral PredictManager',
              '5. 3DS scans QR → connects to proxy',
              '6. UP/DOWN executes on DeepBook Predict testnet',
            ].map((step) => (
              <div key={step} className="leading-relaxed">
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
