/** @type {import('next').NextConfig} */
const nextConfig = {
  // Needed for @mysten/sui ESM compatibility
  transpilePackages: ['@mysten/sui', '@mysten/deepbook-v3', '@mysten/dapp-kit'],
};

export default nextConfig;
