/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * The scraper packages are Node-only — they reach for got-scraping, cheerio
   * and friends at require time — so they are left out of the bundle and
   * loaded at runtime instead. Bundling them fails outright on got-scraping,
   * which has no browser-resolvable entry point.
   */
  serverExternalPackages: ['@consumet/extensions', 'aniwatch'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: 'media.kitsu.io' },
    ],
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
