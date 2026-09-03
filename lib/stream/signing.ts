import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed proxy URLs.
 *
 * The player cannot set a `Referer` on its own segment requests, and the CDNs
 * these providers hand back reject anything without one — so segments have to
 * be fetched server-side. That turns `/api/stream/proxy?url=…` into a fetch
 * primitive pointed at arbitrary hosts, which is a server-side request forgery
 * hole and, worse, an open relay strangers can run their own traffic through.
 *
 * A host allowlist does not work here: stream hosts rotate per request and are
 * only known once the provider answers. So instead every proxied URL is signed
 * with a server-side secret at the moment we mint it, and the proxy refuses
 * anything it did not sign itself. Signatures carry an expiry so a URL lifted
 * from someone's network tab stops working.
 */

const TTL_SECONDS = 6 * 60 * 60;

function secret(): string {
  const value = process.env.STREAM_PROXY_SECRET;
  if (value && value.length >= 16) return value;

  // Failing closed would take the whole player down on a deployment that
  // simply forgot the variable, so fall back to a per-process random key:
  // links stop working across a restart or between instances, which is
  // recoverable, rather than leaving the proxy unsigned, which is not.
  if (!cachedFallback) {
    cachedFallback = randomKey();
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[animux] STREAM_PROXY_SECRET is unset or too short. Using an ephemeral key — ' +
          'proxied stream URLs will break on restart and across instances. Set it to 32+ random characters.',
      );
    }
  }
  return cachedFallback;
}

let cachedFallback: string | null = null;

function randomKey(): string {
  // `crypto.randomUUID` is available on every runtime this app targets.
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

function digest(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export interface ProxyTarget {
  url: string;
  /** Referer the upstream CDN insists on; empty when it does not care. */
  referer?: string;
}

export type ProxyKind = 'playlist' | 'segment' | 'caption';

/** Mint a same-origin URL the player can hand straight to hls.js. */
export function signProxyUrl(target: ProxyTarget, kind: ProxyKind = 'segment'): string {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const params = new URLSearchParams({
    url: target.url,
    exp: String(expires),
    k: kind,
  });
  if (target.referer) params.set('ref', target.referer);

  params.set('sig', digest(canonical(params)));
  return `/api/stream/proxy?${params.toString()}`;
}

/** The exact string that gets signed. Order matters, so it is fixed here. */
function canonical(params: URLSearchParams): string {
  return [
    params.get('url') ?? '',
    params.get('ref') ?? '',
    params.get('exp') ?? '',
    params.get('k') ?? '',
  ].join('\n');
}

/** A caption file the player will load as a <track>, signed the same way. */
export function signCaptionUrl(url: string, referer?: string): string {
  return `/api/stream/captions?${signProxyUrl({ url, referer }, 'caption').split('?')[1]}`;
}

export type VerifyResult =
  | { ok: true; url: string; referer: string | null; kind: ProxyKind }
  | { ok: false; reason: 'missing' | 'bad-signature' | 'expired' | 'bad-url' };

export function verifyProxyUrl(params: URLSearchParams): VerifyResult {
  const url = params.get('url');
  const sig = params.get('sig');
  const exp = params.get('exp');
  const raw = params.get('k');
  const kind: ProxyKind = raw === 'playlist' || raw === 'caption' ? raw : 'segment';

  if (!url || !sig || !exp) return { ok: false, reason: 'missing' };

  const expected = digest(canonical(params));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' };
  }

  if (Number(exp) * 1000 < Date.now()) return { ok: false, reason: 'expired' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'bad-url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'bad-url' };
  }

  return { ok: true, url, referer: params.get('ref'), kind };
}
