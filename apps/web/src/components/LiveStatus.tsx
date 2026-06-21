'use client';

import { useEffect, useState } from 'react';
import {
  fetchBalance,
  fetchMarketData,
  type BalanceData,
  type MarketData,
} from '../lib/proxy';

interface LiveStatusProps {
  sid: string;
  ephemeralAddress: string;
  proxyUrl: string;
}

export function LiveStatus({ sid, ephemeralAddress, proxyUrl }: LiveStatusProps) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = async () => {
      const [bal, mkt] = await Promise.all([
        fetchBalance(sid, proxyUrl),
        fetchMarketData(proxyUrl),
      ]);

      if (!bal && !mkt) {
        setError('Proxy is not responding. Check the local address.');
        return;
      }

      if (bal) setBalance(bal);
      if (mkt) setMarket(mkt);
      setLastUpdate(new Date());
      setError(null);
    };

    void update();
    const interval = setInterval(() => void update(), 5000);
    return () => clearInterval(interval);
  }, [sid, proxyUrl]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow">Live session</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-ds-ink">
            Console status
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#eaf8f3] px-3 py-2 font-mono text-[10px] font-medium text-[#187b5c]">
          <span className="status-dot" />
          {error ? 'OFFLINE' : 'LIVE'}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[14px] bg-[#fff1f1] px-4 py-3 text-sm text-[#a74444]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] bg-ds-screen p-5 text-white">
        <div className="flex items-center justify-between border-b border-[#23445c] pb-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#74b8e7]">
              BTC spot
            </div>
            <div className="mt-1 font-mono text-2xl">
              {market ? `$${market.spot.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#74b8e7]">
              Strike
            </div>
            <div className="mt-1 font-mono text-lg">
              {market ? `$${market.strike.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <div>
            <div className="font-mono text-[9px] uppercase text-[#6f9dbb]">UP</div>
            <div className="mt-1 font-mono text-sm text-[#79dabc]">
              {market ? `${(market.up * 100).toFixed(1)}¢` : '—'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase text-[#6f9dbb]">DOWN</div>
            <div className="mt-1 font-mono text-sm text-[#ffadb8]">
              {market ? `${(market.down * 100).toFixed(1)}¢` : '—'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase text-[#6f9dbb]">Expires</div>
            <div className="mt-1 font-mono text-sm text-white">
              {market ? new Date(market.expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flat-card p-4">
          <div className="data-label">Gas balance</div>
          <div className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-ds-ink">
            {balance?.sui ?? '—'} <span className="text-sm text-ds-muted">SUI</span>
          </div>
        </div>
        <div className="flat-card p-4">
          <div className="data-label">Session allowance</div>
          <div className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-ds-ink">
            {balance?.dusdc ?? '—'} <span className="text-sm text-ds-muted">dUSDC</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[16px] bg-ds-blue-pale p-4">
        <div className="data-label">Ephemeral wallet</div>
        <div className="mt-2 break-all font-mono text-[10px] leading-5 text-ds-muted">
          {ephemeralAddress}
        </div>
      </div>

      <div className="mt-3 text-right font-mono text-[9px] uppercase tracking-[0.12em] text-ds-muted">
        Updated {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}
