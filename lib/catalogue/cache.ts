/**
 * Stale-while-revalidate cache for catalogue responses.
 *
 * The point of this file is a single rule: once Animux has successfully seen a
 * shelf, a later upstream failure must never blank it. AniList going down is a
 * routine event — it is a free API that periodically disables itself — and a
 * viewer opening the app during one of those windows should get last night's
 * trending row, not an error page.
 *
 * Entries are kept well past their freshness window on purpose. A day-old
 * "Trending this week" is worth infinitely more to a viewer than a correct
 * apology.
 */

interface Entry<T> {
  value: T;
  storedAt: number;
  /** Seconds after which the entry should be refreshed if we can. */
  ttl: number;
}

const store = new Map<string, Entry<unknown>>();

/** Hard ceiling so a long-lived instance can't grow without bound. */
const MAX_ENTRIES = 300;
/** Stale entries stay usable as a fallback for a week. */
const FALLBACK_MAX_AGE = 7 * 24 * 60 * 60;

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
  for (const [key] of oldest.slice(0, store.size - MAX_ENTRIES)) {
    store.delete(key);
  }
}

export function read<T>(key: string): { value: T; fresh: boolean; ageSeconds: number } | null {
  const hit = store.get(key) as Entry<T> | undefined;
  if (!hit) return null;

  const ageSeconds = Math.floor((Date.now() - hit.storedAt) / 1000);
  if (ageSeconds > FALLBACK_MAX_AGE) {
    store.delete(key);
    return null;
  }
  return { value: hit.value, fresh: ageSeconds < hit.ttl, ageSeconds };
}

export function write<T>(key: string, value: T, ttl: number) {
  store.set(key, { value, storedAt: Date.now(), ttl });
  evictIfNeeded();
}

/**
 * Identical queries issued in the same tick share one upstream request.
 * The home page asks for four shelves at once and the browse page re-runs the
 * same query on every pagination click; without this, each becomes its own
 * hit against a rate limit we are already close to.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function coalesce<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
