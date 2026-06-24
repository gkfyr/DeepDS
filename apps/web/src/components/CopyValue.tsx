'use client';

import { useState } from 'react';

interface CopyValueProps {
  label: string;
  value: string;
}

export function CopyValue({ label, value }: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <span className="data-label">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full border border-ds-line bg-white px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ds-blue transition hover:border-ds-blue hover:bg-ds-blue-pale focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ds-blue/15"
          aria-label={`Copy ${label}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="mt-2.5 block break-all font-mono text-xs leading-5 tracking-[0.015em] text-ds-ink">
        {value}
      </code>
    </div>
  );
}
