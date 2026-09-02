/**
 * Lazily constructed Prisma client.
 *
 * Two separate build failures live here, and both are fixed by not trusting
 * the generated client to exist at compile time:
 *
 *  1. The old version called `new PrismaClient()` at module scope. Next's
 *     "Collecting page data" pass imports every route module, so merely
 *     importing /api/stream constructed a client — and with no client
 *     generated, the *build* died with "@prisma/client did not initialize
 *     yet". A route that talks to a database should fail when it is called,
 *     not when it is compiled.
 *
 *  2. Importing any type from '@prisma/client' fails too, because before
 *     `prisma generate` runs the package exports nothing at all. So the shape
 *     below is declared locally rather than imported. It describes only what
 *     this app actually queries; widen it if more of the schema gets used.
 *
 * Net effect: the app builds and deploys with no database configured, and the
 * database path fails cleanly at request time instead.
 */

export interface EpisodeRecord {
  id: string;
  title: string | null;
  streamUrl: string;
  drmKey: string | null;
  quality: string | null;
  bitrate: number | null;
  duration: number | null;
  thumbnail: string | null;
  subtitles: unknown;
}

interface EpisodeDelegate {
  findUnique(args: {
    where: { id: string };
    select?: Partial<Record<keyof EpisodeRecord, boolean>>;
  }): Promise<EpisodeRecord | null>;
}

interface Database {
  episode: EpisodeDelegate;
  $disconnect(): Promise<void>;
}

const globalForPrisma = global as unknown as { prisma?: Database };

function client(): Database {
  if (!globalForPrisma.prisma) {
    // Required lazily, and by a computed name so bundlers do not try to
    // resolve it eagerly when the package has not been generated.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@prisma/client');
    globalForPrisma.prisma = new mod.PrismaClient() as Database;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as Database, {
  get(_target, property) {
    const live = client() as unknown as Record<string | symbol, unknown>;
    const value = live[property];
    return typeof value === 'function' ? (value as Function).bind(live) : value;
  },
});

/**
 * True when a database is actually configured. Check this before reaching for
 * `prisma`, so a missing DATABASE_URL becomes a clear response rather than an
 * unhandled initialisation error surfacing as a 500.
 */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
