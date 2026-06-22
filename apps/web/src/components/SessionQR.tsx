'use client';

import { QRCodeSVG } from 'qrcode.react';

interface SessionQRProps {
  sid: string;
  proxyUrl: string;
}

export function SessionQR({ sid, proxyUrl }: SessionQRProps) {
  /*
   * The original 3DS SSL service only supports up to TLS 1.1, while Vercel
   * requires TLS 1.2+. Cloudflare Quick Tunnels still accept plain HTTP and
   * forward it to the local proxy, so the browser uses the HTTPS tunnel URL
   * while the console receives its HTTP equivalent.
   */
  const configured3dsUrl = process.env.NEXT_PUBLIC_3DS_PROXY_URL?.trim();
  const consoleProxyUrl =
    configured3dsUrl ||
    (proxyUrl.startsWith('https://') &&
    proxyUrl.includes('.trycloudflare.com')
      ? `http://${proxyUrl.slice('https://'.length)}`
      : proxyUrl);

  /*
   * Compact wire format for the 3DS camera:
   * D1|https://proxy.example|uuid-without-hyphens
   *
   * Removing JSON keys and UUID hyphens lowers the QR grid from 37×37
   * (Version 5) to 33×33 (Version 4) for the deployed Vercel URL. The larger
   * modules are much more reliable with the 3DS QVGA camera.
   */
  const qrPayload = `D1|${consoleProxyUrl}|${sid.replaceAll('-', '')}`;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5">
        <p className="eyebrow">Pair your console</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-ds-ink">
          Scan with DeepDS
        </h2>
      </div>

      <div className="relative rounded-[28px] bg-ds-shell p-5 shadow-inner">
        <div className="absolute left-3 top-3 h-2 w-2 rounded-full bg-ds-blue" />
        <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-ds-coral" />
        <div className="rounded-[16px] border-[6px] border-ds-ink bg-white p-3">
          <QRCodeSVG
            value={qrPayload}
            size={280}
            level="L"
            includeMargin
            fgColor="#000000"
            bgColor="#ffffff"
            style={{ width: 'min(280px, 72vw)', height: 'auto' }}
          />
        </div>
      </div>

      <div className="mt-6 w-full divide-y divide-ds-line rounded-[18px] border border-ds-line text-left">
        <div className="px-4 py-3">
          <span className="data-label">Session</span>
          <span className="mt-2 block break-all font-mono text-[11px] leading-5 text-ds-ink">
            {sid}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="data-label">Proxy</span>
          <span className="max-w-[210px] truncate font-mono text-[11px] text-ds-ink">
            {consoleProxyUrl}
          </span>
        </div>
      </div>

      <div className="mt-4 max-w-sm rounded-[14px] bg-ds-blue-pale px-4 py-3 text-left text-xs leading-5 text-ds-muted">
        <strong className="text-ds-ink">On your 3DS:</strong> open DeepDS and
        point the outer camera at this code. Legacy HTTP is selected
        automatically for Cloudflare Tunnel addresses.
      </div>
    </div>
  );
}
