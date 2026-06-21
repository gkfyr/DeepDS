'use client';

/**
 * Session QR Code component.
 * Displays a QR code containing the proxy URL and session ID.
 * The 3DS scans this to authenticate.
 *
 * QR payload: {"url":"http://192.168.x.x:3001","sid":"<uuid>"}
 */

import { QRCodeSVG } from 'qrcode.react';

interface SessionQRProps {
  sid: string;
  proxyUrl: string;
}

export function SessionQR({ sid, proxyUrl }: SessionQRProps) {
  const qrPayload = JSON.stringify({ url: proxyUrl, sid });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="ds-label text-center">📷 SCAN WITH 3DS CAMERA</div>

      {/* QR Code with DS-style border */}
      <div className="relative p-4 border border-ds-green ds-panel">
        {/* Corner decorators */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ds-green" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-ds-green" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-ds-green" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ds-green" />

        <div className="bg-white p-3">
          <QRCodeSVG
            value={qrPayload}
            size={200}
            level="M"
            includeMargin={false}
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>
      </div>

      {/* Session details */}
      <div className="w-full space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-green-700">SESSION ID</span>
          <span className="text-ds-green font-mono">
            {sid.slice(0, 8)}...
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-green-700">PROXY URL</span>
          <span className="text-ds-green font-mono text-xs">{proxyUrl}</span>
        </div>
      </div>

      <p className="text-xs text-green-800 text-center">
        Point your 3DS camera at this code.
        <br />
        DeepDS app will connect automatically.
      </p>
    </div>
  );
}
