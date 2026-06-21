/** @type {import('next').NextConfig} */
const nextConfig = {
  // Needed for @mysten/sui ESM compatibility
  transpilePackages: ['@mysten/sui', '@mysten/dapp-kit'],
};

export default nextConfig;
