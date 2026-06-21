'use client';

/**
 * Live Status Panel
 * Polls the proxy for balance updates every 5 seconds.
 * Displays SUI and USDC balances of the ephemeral trading address.
 */

import { useEffect, useState } from 'react';
import { fetchBalance, fetchMarketData, type BalanceData, type MarketData } from '../lib/proxy';

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
      try {
        const [bal, mkt] = await Promise.all([
          fetchBalance(sid, proxyUrl),
          fetchMarketData(proxyUrl),
        ]);
        if (bal) setBalance(bal);
        if (mkt) setMarket(mkt);
        setLastUpdate(new Date());
        setError(null);
      } catch {
        setError('Failed to fetch data');
      }
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [sid, proxyUrl]);

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="ds-status-dot" />
        <span className="text-green-600">
          LIVE · Updated {lastUpdate.toLocaleTimeString()}
        </span>
        {error && <span className="text-red-400 ml-auto">⚠ {error}</span>}
      </div>

      {/* Market data */}
      {market && (
        <div className="ds-panel p-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="ds-label">BTC SPOT</div>
            <div className="ds-value text-sm">${market.spot.toFixed(2)}</div>
          </div>
          <div>
            <div className="ds-label">STRIKE</div>
            <div className="ds-value text-sm">${market.strike.toFixed(0)}</div>
          </div>
          <div>
            <div className="ds-label">UP MARK</div>
            <div className="text-yellow-400 font-mono">{(market.up * 100).toFixed(1)}¢</div>
          </div>
          <div>
            <div className="ds-label">EXPIRES</div>
            <div className="text-ds-blue font-mono">
              {new Date(market.expiry).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Balance */}
      <div className="ds-panel p-3 space-y-2 text-xs">
        <div className="ds-label">EPHEMERAL WALLET BALANCE</div>
        <div className="font-mono text-xs text-green-800 break-all mb-2">
          {ephemeralAddress}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-green-700">SUI</span>
          <span className="ds-value">
            {balance ? balance.sui : '---'} SUI
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-green-700">dUSDC (wallet)</span>
          <span className="ds-value">
            {balance ? balance.dusdc : '---'} dUSDC
          </span>
        </div>
        <div className="text-green-800 break-all">
          Manager: {balance?.manager || 'initializing...'}
        </div>
      </div>
    </div>
  );
}
