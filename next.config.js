/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type-checking passes locally but Vercel's build env resolves
    // slightly different @types versions. We run tsc in CI separately.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
module.exports = nextConfig;
