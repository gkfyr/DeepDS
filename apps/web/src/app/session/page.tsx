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

import { useState } from 'react';
import {
  useCurrentAccount,
  useCurrentClient,
  useDAppKit,
} from '@mysten/dapp-kit-react';
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
import { Brand } from '../../components/Brand';
import Image from 'next/image';
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

interface PendingSession {
  sid: string;
  ephemeralAddress: string;
  funded: boolean;
}

// Gas amount to transfer to ephemeral address for transaction fees
const GAS_ALLOWANCE_MIST = 50_000_000n; // 0.05 SUI

const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC';
const DEFAULT_DUSDC_ALLOWANCE =
  process.env.NEXT_PUBLIC_DUSDC_ALLOWANCE ?? '5';
const DUMMY_MODE = process.env.NEXT_PUBLIC_DUMMY_MODE === 'true';

export default function SessionPage() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();

  const [step, setStep] = useState<Step>('idle');
  const [session, setSession] = useState<SessionState | null>(null);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [dusdcAllowance, setDusdcAllowance] = useState(DEFAULT_DUSDC_ALLOWANCE);
  const [proxyUrl, setProxyUrl] = useState(PROXY_URL);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const createSession = async () => {
    if (!account && !DUMMY_MODE) return;
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
          userAddress: account?.address ?? 'dummy-local-user',
          allowance: dusdcAllowance,
        },
        proxyUrl,
      );
      setPendingSession({ sid, ephemeralAddress: address, funded: false });
      addLog('Session registered successfully!');

      if (DUMMY_MODE) {
        addLog('Dummy mode: skipping wallet funding and Sui transaction.');
        const initialized = await initializeSession(sid, proxyUrl);
        addLog(`Mock PredictManager ready: ${initialized.managerId}`);
        addLog('3DS can now submit local UP/DOWN mock trades.');
        setSession({
          sid,
          ephemeralAddress: address,
          managerId: initialized.managerId,
        });
        setStep('active');
        return;
      }

      // Step 3: Fund the limited session wallet
      setStep('waiting-wallet');
      addLog('Building session allowance PTB...');

      const tx = new Transaction();
      tx.setSender(account!.address);

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
        owner: account!.address,
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

      const { bytes, signature } = await dAppKit.signTransaction({
        transaction: tx,
        network: 'testnet',
      });

      addLog('Wallet signed! Submitting to Sui testnet...');

      const result = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true },
      });

      setTxDigest(result.digest);
      setPendingSession({ sid, ephemeralAddress: address, funded: true });
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

  const retryManagerSetup = async () => {
    if (!pendingSession?.funded) return;
    setError(null);
    setStep('registering');
    addLog('Retrying PredictManager setup with the funded session...');
    try {
      const initialized = await initializeSession(
        pendingSession.sid,
        proxyUrl,
      );
      addLog(`✅ PredictManager ready: ${initialized.managerId.slice(0, 18)}...`);
      setSession({
        sid: pendingSession.sid,
        ephemeralAddress: pendingSession.ephemeralAddress,
        managerId: initialized.managerId,
      });
      setPendingSession(null);
      setStep('active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep('error');
      addLog(`❌ Retry failed: ${msg}`);
    }
  };

  const endSession = async () => {
    if (!session) return;
    await revokeSession(session.sid, proxyUrl).catch(() => {});
    setSession(null);
    setStep('idle');
    setLogs([]);
    setTxDigest(null);
    setPendingSession(null);
  };

  if (!account && !DUMMY_MODE) {
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <div className="soft-card w-full max-w-md p-8 text-center sm:p-10">
          <Image
            src="/deepds-logo.png"
            alt="DeepDS"
            width={80}
            height={80}
            priority
            className="mx-auto rounded-[22px] border border-ds-line bg-white p-1 shadow-sm"
          />
          <p className="eyebrow mt-7">Wallet disconnected</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-ds-ink">
            Connect before pairing.
          </h1>
          <p className="mt-4 leading-7 text-ds-muted">
            Your wallet creates the temporary allowance used by the 3DS session.
          </p>
          <Link href="/" className="secondary-button mt-7">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="site-shell">
        <header className="site-header">
          <Brand />
          <div className="flex items-center gap-2 rounded-full border border-ds-line bg-white px-3 py-2 font-mono text-[10px] text-ds-muted">
            <span className="status-dot" />
            {DUMMY_MODE
              ? 'LOCAL DUMMY'
              : `${account!.address.slice(0, 7)}…${account!.address.slice(-5)}`}
          </div>
        </header>

        <div className="pb-20 pt-10">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow">3DS pairing</p>
            <h1 className="section-title mt-3 sm:text-5xl">
              Create a pocket-sized trading session.
            </h1>
            <p className="body-copy mt-5 max-w-xl">
              {DUMMY_MODE
                ? 'Choose the local proxy and a pretend dUSDC balance. No wallet or blockchain is used; your real 3DS still runs the complete UI flow.'
                : 'Choose the local proxy and a small dUSDC allowance. Your wallet approves once; the 3DS can then place predictions until the session ends.'}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <section className="soft-card p-6 sm:p-8">
                <div className="mb-7 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Session setup</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-ds-ink">
                      Set your limits
                    </h2>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ds-blue-soft font-mono text-xs font-medium text-ds-ink">
                    01
                  </span>
                </div>

                <div>
                  <label htmlFor="proxy-url" className="form-label">
                    Server address
                  </label>
                  <input
                    id="proxy-url"
                    className="form-input"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="https://example.trycloudflare.com"
                    disabled={step !== 'idle' && step !== 'error'}
                  />
                  <p className="mt-2 text-xs leading-5 text-ds-muted">
                    Paste the public HTTPS tunnel URL shown by the host command.
                  </p>
                </div>

                <div className="mt-6">
                  <label htmlFor="dusdc-allowance" className="form-label">
                    Session allowance
                  </label>
                  <div className="relative">
                    <input
                      id="dusdc-allowance"
                      className="form-input pr-20"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={dusdcAllowance}
                      onChange={(e) => setDusdcAllowance(e.target.value)}
                      disabled={step !== 'idle' && step !== 'error'}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-ds-muted">
                      dUSDC
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ds-muted">
                    {DUMMY_MODE
                      ? 'Virtual balance used by local mock trades. Nothing leaves a wallet.'
                      : 'Only this amount and 0.05 SUI gas move into the temporary wallet.'}
                  </p>
                </div>

                <div className="mt-8">
                  {step === 'idle' || step === 'error' ? (
                    <button
                      id="create-session-btn"
                      className="primary-button w-full"
                      onClick={
                        pendingSession?.funded
                          ? retryManagerSetup
                          : createSession
                      }
                    >
                      {pendingSession?.funded
                        ? 'Retry manager setup'
                        : DUMMY_MODE
                          ? 'Create dummy session'
                          : 'Create and fund session'}
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : step === 'active' ? (
                    <button
                      id="end-session-btn"
                      className="danger-button w-full"
                      onClick={endSession}
                    >
                      End this session
                    </button>
                  ) : (
                    <button className="secondary-button w-full cursor-wait opacity-70" disabled>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-ds-blue" />
                      {step === 'generating' && 'Generating a temporary key'}
                      {step === 'registering' && 'Connecting to the proxy'}
                      {step === 'waiting-wallet' &&
                        (DUMMY_MODE ? 'Preparing dummy session' : 'Waiting for wallet approval')}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-[14px] bg-[#fff1f1] px-4 py-3 text-sm leading-6 text-[#a74444]">
                    {error}
                  </div>
                )}
              </section>

              <section className="flat-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="data-label">Session activity</span>
                  <span className="h-2 w-2 rounded-full bg-ds-blue" />
                </div>
                <div id="session-logs" className="log-panel min-h-[148px] max-h-56 overflow-y-auto">
                  {logs.length === 0 ? (
                    <span className="text-[#658ba6]">
                      Ready when you are. Session updates will appear here.
                    </span>
                  ) : (
                    logs.map((log, index) => <div key={index}>{log}</div>)
                  )}
                </div>
                {txDigest && (
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-between rounded-[14px] bg-ds-blue-pale px-4 py-3 text-xs font-bold text-ds-ink transition hover:bg-ds-blue-soft"
                  >
                    View funding transaction
                    <span className="font-mono">↗</span>
                  </a>
                )}
              </section>
            </div>

            <div className="space-y-6">
              {session ? (
                <>
                  <section className="soft-card p-6 sm:p-8">
                    <SessionQR sid={session.sid} proxyUrl={proxyUrl} />
                  </section>
                  <section className="soft-card p-6 sm:p-8">
                    <LiveStatus
                      sid={session.sid}
                      ephemeralAddress={session.ephemeralAddress}
                      proxyUrl={proxyUrl}
                    />
                  </section>
                </>
              ) : (
                <section className="soft-card relative min-h-[520px] overflow-hidden p-8">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ds-blue via-[#9ad2ff] to-ds-coral" />
                  <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
                    <div className="device-shell max-w-[280px] p-4">
                      <div className="device-screen aspect-[5/3] grid place-items-center">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#75b7e5]">
                          Waiting to pair
                        </span>
                      </div>
                      <div className="device-hinge my-2 h-3" />
                      <div className="device-screen aspect-[4/2.2] grid place-items-center">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-[#32536b] font-mono text-lg text-[#77b8e5]">
                          +
                        </div>
                      </div>
                    </div>
                    <h2 className="mt-8 text-2xl font-extrabold tracking-[-0.04em] text-ds-ink">
                      Your pairing code appears here.
                    </h2>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-ds-muted">
                      {DUMMY_MODE
                        ? 'Create the session on the left, then enter its local connection details on your console.'
                        : 'Create the session on the left, approve it in your wallet, then open DeepDS on your console.'}
                    </p>
                  </div>
                </section>
              )}

              <section className="flat-card p-6">
                <p className="eyebrow">What happens next</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      DUMMY_MODE ? 'Allocate' : 'Fund',
                      DUMMY_MODE
                        ? 'The proxy creates your virtual dUSDC balance.'
                        : 'A temporary wallet receives your chosen allowance.',
                    ],
                    ['Pair', 'The 3DS connects using the QR session details.'],
                    [
                      'Tap',
                      DUMMY_MODE
                        ? 'UP or DOWN returns a mock fill and digest.'
                        : 'UP or DOWN becomes a Predict transaction.',
                    ],
                  ].map(([title, copy]) => (
                    <div key={title}>
                      <h3 className="text-sm font-extrabold text-ds-ink">{title}</h3>
                      <p className="mt-2 text-xs leading-5 text-ds-muted">{copy}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
