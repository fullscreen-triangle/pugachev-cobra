/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // esmExternals keeps require() working inside emitter.ts (registry import).
    esmExternals: false,
  },
  webpack(config) {
    // Enable `new Worker(new URL('./worker.tsx', import.meta.url), {type:'module'})`
    // pattern required by @react-three/offscreen.
    config.output.workerChunkLoading = 'import-scripts';
    return config;
  },
}

module.exports = nextConfig
