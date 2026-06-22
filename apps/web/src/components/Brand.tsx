import Image from 'next/image';
import Link from 'next/link';

interface BrandProps {
  centered?: boolean;
  showName?: boolean;
}

export function Brand({ centered = false, showName = true }: BrandProps) {
  return (
    <Link
      href="/"
      className={`brand${centered ? ' justify-center' : ''}`}
      aria-label="DeepDS home"
    >
      <Image
        src="/deepds-logo.png"
        alt=""
        width={44}
        height={44}
        priority
        className="brand-logo"
      />
      {showName && <span className="text-xl">DeepDS</span>}
    </Link>
  );
}
