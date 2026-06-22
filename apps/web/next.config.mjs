/** @type {import('next').NextConfig} */
const nextConfig = {
  // Needed for @mysten/sui ESM compatibility
  transpilePackages: [
    '@mysten/sui',
    '@mysten/dapp-kit-core',
    '@mysten/dapp-kit-react',
  ],
};

export default nextConfig;
