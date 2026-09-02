/**
 * Outbound gate for the AniList API.
 *
 * AniList documents 90 requests/minute, but the API has been running in a
 * degraded state capped at 30/minute, and there is a separate burst limiter on
 * top of that. Going over earns a 1-minute timeout; doing it repeatedly from
 * one IP earns a manual block, which is served as a 403.
 *
 * The old code fired four `searchAnime` calls in parallel on every cold render
 * of the home page. On a serverless host — where the outbound IP is shared with
 * every other app on the platform — that is exactly the traffic shape that trips
 * the burst limiter. This module makes that impossible: every call to AniList
 * passes through one token bucket, and requests queue rather than burst.
 */

const RATE = Number(process.env.ANILIST_RATE_PER_MIN ?? 24); // under the 30 degraded cap
const BURST = Number(process.env.ANILIST_BURST ?? 4); // never more than 4 in flight at once
const MIN_GAP_MS = Math.ceil(60_000 / RATE);

type Job<T> = () => Promise<T>;

let tokens = BURST;
let lastRefill = Date.now();
let inFlight = 0;
const queue: Array<() => void> = [];

/**
 * Set when AniList tells us to back off (429 Retry-After, or a 403 block).
 * Nothing leaves the process until this passes — continuing to hammer a
 * limiter that has already tripped is what converts a timeout into a ban.
 */
let cooldownUntil = 0;

function refill() {
  const now = Date.now();
  const gained = Math.floor((now - lastRefill) / MIN_GAP_MS);
  if (gained > 0) {
    tokens = Math.min(BURST, tokens + gained);
    lastRefill = now;
  }
}

function pump() {
  refill();
  while (queue.length > 0 && tokens > 0 && inFlight < BURST && Date.now() >= cooldownUntil) {
    tokens -= 1;
    const next = queue.shift();
    next?.();
  }
  if (queue.length > 0) {
    const waitForCooldown = Math.max(0, cooldownUntil - Date.now());
    setTimeout(pump, Math.max(waitForCooldown, MIN_GAP_MS));
  }
}

/** Queue a call to AniList. Resolves when the gate lets it through. */
export function schedule<T>(job: Job<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      inFlight += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          inFlight -= 1;
          pump();
        });
    });
    pump();
  });
}

/** Called when AniList sends Retry-After, or when we get blocked outright. */
export function backOff(seconds: number) {
  const until = Date.now() + Math.max(1, seconds) * 1000;
  if (until > cooldownUntil) cooldownUntil = until;
}

export function cooldownRemaining(): number {
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
}

export function isCoolingDown(): boolean {
  return Date.now() < cooldownUntil;
}
