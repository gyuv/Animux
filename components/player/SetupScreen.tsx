'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Plug, ExternalLink, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

/**
 * What the player shows when the catalogue is working but no video source is
 * connected.
 *
 * This replaces a public test clip that used to play here. Serving a stock
 * cartoon in place of the episode meant every title looked identical and
 * broken, and the viewer only discovered the real problem after sitting
 * through something they did not ask for. A screen that names the missing
 * piece is worth more than a video that is not the one you chose.
 */
export function SetupScreen({
  animeId,
  title,
  episode,
}: {
  animeId: string;
  title: string;
  episode: number;
}) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checking, setChecking] = useState(true);

  const check = () => {
    setChecking(true);
    fetch('/api/stream/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setChecking(false));
  };

  useEffect(check, []);

  return (
    <div className="min-h-svh bg-ink-900 px-6 py-10">
      <div className="mx-auto max-w-[62ch]">
        <Link
          href={`/title/${animeId}`}
          className="mb-8 inline-flex items-center gap-2 text-meta text-haze transition-colors hover:text-paper"
        >
          <ArrowLeft size={15} aria-hidden />
          Back to {title}
        </Link>

        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800">
            <Plug size={17} className="text-chroma" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-hero font-black leading-tight text-paper">
              No video source is connected
            </h1>
            <p className="mt-2 text-body text-haze">
              Animux has the catalogue — that is why {title} and its episode {episode} are here —
              but nothing is wired up to supply the video itself. Until something is, no episode
              will play.
            </p>
          </div>
        </div>

        {/* The live check matters more than the instructions: it says whether
            the thing you just configured is actually answering. */}
        <section className="mt-8 rounded-panel border border-ink-700 bg-ink-800/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-meta font-semibold uppercase tracking-wider text-haze/70">
              What this deployment sees
            </h2>
            <button
              type="button"
              onClick={check}
              className="inline-flex items-center gap-1.5 text-micro text-haze transition-colors hover:text-paper"
            >
              <RefreshCw size={12} className={checking ? 'animate-spin' : ''} aria-hidden />
              Re-check
            </button>
          </div>

          {health ? (
            <>
              <p className="text-meta text-paper">{health.verdict}</p>
              <ul className="mt-3 space-y-1.5">
                {(['own', 'consumet', 'aniwatch'] as const).map((key) => {
                  const probe = health.providers?.[key];
                  const label = { own: 'Your own backend', consumet: 'Consumet', aniwatch: 'Aniwatch' }[key];
                  const ok = probe?.configured && probe.reachable;
                  return (
                    <li key={key} className="flex items-center gap-2 text-micro">
                      {ok ? (
                        <CheckCircle2 size={13} className="shrink-0 text-chroma" aria-hidden />
                      ) : (
                        <XCircle size={13} className="shrink-0 text-haze/40" aria-hidden />
                      )}
                      <span className={ok ? 'text-paper' : 'text-haze'}>{label}</span>
                      <span className="text-haze/60">
                        {!probe?.configured
                          ? 'not configured'
                          : probe.reachable
                            ? 'answering'
                            : `configured but not answering${probe.error ? ` — ${probe.error}` : ''}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {health.warnings?.map((warning) => (
                <p key={warning} className="mt-3 text-micro text-signal">{warning}</p>
              ))}
            </>
          ) : (
            <p className="text-meta text-haze">
              {checking ? 'Checking…' : 'Could not read /api/stream/health.'}
            </p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-meta font-semibold uppercase tracking-wider text-haze/70">
            Connecting one
          </h2>
          <ol className="mt-3 space-y-4 text-body text-haze">
            <li>
              <span className="font-semibold text-paper">Deploy a source API.</span>{' '}
              <a
                href="https://github.com/ghoshRitesh12/aniwatch-api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-chroma hover:underline"
              >
                aniwatch-api <ExternalLink size={12} aria-hidden />
              </a>{' '}
              is the least work and carries both subtitled and dubbed audio.
            </li>
            <li>
              <span className="font-semibold text-paper">Set two variables</span> on this
              deployment, then redeploy:
              <pre className="mt-2 overflow-x-auto rounded-key border border-ink-700 bg-ink-900 p-3 text-micro text-paper">
{`ANIWATCH_API_URL=https://your-instance.example
STREAM_PROXY_SECRET=<openssl rand -hex 32>`}
              </pre>
            </li>
            <li>
              <span className="font-semibold text-paper">Re-check above.</span> When it reads
              “answering”, come back and press play.
            </li>
          </ol>

          <p className="mt-6 text-meta text-haze/70">
            Already have your own licensed backend? Point <code className="text-haze">STREAM_PROVIDER_URL</code>{' '}
            at it instead and it takes precedence. To get the old test clip back while working on
            the player, set <code className="text-haze">STREAM_DEMO=1</code>.
          </p>
        </section>
      </div>
    </div>
  );
}

interface HealthReport {
  verdict: string;
  warnings?: string[];
  providers?: Record<string, { configured: boolean; reachable: boolean | null; error: string | null }>;
}
