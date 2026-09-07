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
    /*
     * Served straight from the source CDN rather than through Vercel's
     * optimiser, for two reasons that both bite this app specifically.
     *
     * Cost: the optimiser bills per distinct source image, and a catalogue is
     * nothing but distinct source images — thousands of posters, most seen
     * once. A free plan's monthly allowance goes in about a day of browsing,
     * and what happens after it runs out is that the images stop appearing.
     *
     * Correctness: with the optimiser on, every image host has to be listed
     * below or `next/image` refuses it and renders nothing — silently, with no
     * console error and no broken-image icon. That is exactly how the covers
     * went blank when the listing fell back to MyAnimeList, whose CDN was not
     * on the list. Off, any host works, so a new catalogue source cannot take
     * the artwork down again.
     *
     * What it costs is AVIF/WebP re-encoding. These CDNs already serve sized,
     * compressed JPEGs, and skipping a round trip through the optimiser is
     * quicker than the bytes it would have saved.
     */
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'img.anili.st' },
      { protocol: 'https', hostname: 'media.kitsu.io' },
      // The fallback listing's artwork.
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
    ],
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
