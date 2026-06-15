/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the compiler modules (written in TypeScript) to be imported by JS pages.
  // Next.js handles this automatically when tsconfig.json is present.
  experimental: {
    // esmExternals keeps require() working inside emitter.ts (registry import).
    esmExternals: false,
  },
}

module.exports = nextConfig
