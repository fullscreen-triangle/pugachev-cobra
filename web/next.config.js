/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep require() working in emitter.ts
  experimental: { esmExternals: false },

  images: {
    // Serve WebP/AVIF instead of raw JPEG/PNG
    formats: ['image/avif', 'image/webp'],
    // Cap the largest responsive image at 1920px; background slides never need more
    deviceSizes: [640, 960, 1280, 1920],
    imageSizes:  [64, 128, 256],
    // Aggressively cache optimised images for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  webpack(config, { isServer }) {
    // Workers
    config.output.workerChunkLoading = 'import-scripts';

    if (!isServer) {
      // Split postprocessing / three / r3f into their own chunks so the
      // playground doesn't bloat the landing page bundle.
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups ?? {}),
          three: {
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            name: 'three',
            chunks: 'all',
            priority: 30,
          },
          postprocessing: {
            test: /[\\/]node_modules[\\/](postprocessing)[\\/]/,
            name: 'postprocessing',
            chunks: 'all',
            priority: 25,
          },
          remotion: {
            test: /[\\/]node_modules[\\/](remotion)[\\/]/,
            name: 'remotion',
            chunks: 'async',
            priority: 20,
          },
        },
      };
    }

    return config;
  },
};

module.exports = nextConfig;
