/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel Specific: Optimize for Edge Runtime performance
  experimental: {
    optimizeCss: true,
    // Allow dynamic imports for heavy components like the Video Player
    swcPlugins: [], 
  },
  
  // Images: Vercel Edge Network handles resizing automatically
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Example CDN
      },
      {
        protocol: 'https',
        hostname: '**', // Allow all for anime cover art from various CDNs
      },
    ],
    // Performance: Preload critical images if needed
    minimumCacheTTL: 60 * 60 * 24, // Cache for 1 day
  },

  // GitHub Web: No special config needed here, but ensure 
  // you use 'npm' or 'pnpm' in your GitHub repo's root for CI/CD builds
};

module.exports = nextConfig;
