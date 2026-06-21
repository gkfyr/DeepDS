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
}

export function LiveStatus({ sid, ephemeralAddress }: LiveStatusProps) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = async () => {
      try {
        const [bal, mkt] = await Promise.all([
          fetchBalance(sid),
          fetchMarketData('SUI_USDC'),
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
  }, [sid]);

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
            <div className="ds-label">BID</div>
            <div className="ds-value text-sm">{market.bid.toFixed(4)} USDC</div>
          </div>
          <div>
            <div className="ds-label">ASK</div>
            <div className="ds-value text-sm">{market.ask.toFixed(4)} USDC</div>
          </div>
          <div>
            <div className="ds-label">SPREAD</div>
            <div className="text-yellow-400 font-mono">{market.spread.toFixed(4)}</div>
          </div>
          <div>
            <div className="ds-label">VOL</div>
            <div className="text-ds-blue font-mono">{market.vol.toLocaleString()}</div>
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
          <span className="text-green-700">USDC</span>
          <span className="ds-value">
            {balance ? balance.usdc : '---'} USDC
          </span>
        </div>
      </div>
    </div>
  );
}
