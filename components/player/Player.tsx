'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, Settings, ArrowLeft, Loader2, Subtitles,
} from 'lucide-react';
import Link from 'next/link';
import { useLibrary } from '@/store/useLibrary';
import { timecode } from '@/lib/format';
import type { StreamPayload, StreamSource } from '@/app/api/stream/route';
import { LanguageMenu } from './LanguageMenu';

interface Props {
  animeId: string;
  title: string;
  cover: string;
  color: string | null;
  episode: number;
  totalEpisodes: number | null;
  startAt?: number;
}

const SUB_SIZE = { small: '78%', medium: '100%', large: '132%' };

export function Player({
  animeId, title, cover, color, episode, totalEpisodes, startAt = 0,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(0);

  const { preferences, setPreferences, recordProgress } = useLibrary();

  const [payload, setPayload] = useState<StreamPayload | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startAt);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [menu, setMenu] = useState(false);

  /* ---------------------------------------------------------------- fetch */

  useEffect(() => {
    let live = true;
    setPayload(null);
    setError(null);
    setBuffering(true);

    fetch(`/api/stream?id=${animeId}&ep=${episode}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'That episode would not load.');
        return body as StreamPayload;
      })
      .then((data) => {
        if (!live) return;
        setPayload(data);
        // Honour the viewer's stored language choice, then their sub/dub
        // preference, then whatever the provider listed first.
        const sources = data.sources ?? [];
const pick =
  sources.find((s) => s.kind === preferences.audio && s.language === preferences.audioLang) ??
  sources.find((s) => s.kind === preferences.audio) ??
  sources[0];
setSource(pick);
      })
      .catch((e) => live && setError(e.message));

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, episode]);

  /* --------------------------------------------------------------- attach */

  useEffect(() => {
    const el = video.current;
    if (!el || !source) return;

    hls.current?.destroy();
    hls.current = null;

    const resumeAt = position > 5 ? position : startAt;

    if (source.type === 'hls' && Hls.isSupported()) {
      const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
      instance.loadSource(source.url);
      instance.attachMedia(el);
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (resumeAt > 0) el.currentTime = resumeAt;
      });
      instance.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
        else setError('The video stream stopped. Try reloading the episode.');
      });
      hls.current = instance;
    } else {
      // Safari and iOS play HLS natively; mp4 needs nothing special.
      el.src = source.url;
      const seek = () => { if (resumeAt > 0) el.currentTime = resumeAt; };
      el.addEventListener('loadedmetadata', seek, { once: true });
    }

    return () => { hls.current?.destroy(); hls.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  /* ------------------------------------------------------------- progress */

  const onTime = () => {
    const el = video.current;
    if (!el) return;
    setPosition(el.currentTime);

    // Write at most once every five seconds of wall clock. The previous build
    // tested `Math.floor(currentTime) % 5 === 0`, which is true for every one
    // of the ~15 timeupdate events inside that second.
    const now = Date.now();
    if (now - lastSaved.current > 5000 && el.duration > 0) {
      lastSaved.current = now;
      recordProgress({
        animeId, title, cover, color, episode,
        position: el.currentTime,
        duration: el.duration,
      });
    }
  };

  /* -------------------------------------------------------------- control */

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    el.paused ? el.play().catch(() => {}) : el.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
    setChrome(true);
  }, []);

  const seekTo = (value: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = value;
    setPosition(value);
  };

  const toggleFullscreen = useCallback(async () => {
    if (!shell.current) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await shell.current.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const el = video.current;
    if (el) { el.volume = volume; el.muted = muted; }
  }, [volume, muted]);

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      const map: Record<string, () => void> = {
        ' ': toggle,
        k: toggle,
        Enter: toggle,
        ArrowRight: () => seekBy(10),
        ArrowLeft: () => seekBy(-10),
        l: () => seekBy(10),
        j: () => seekBy(-10),
        f: toggleFullscreen,
        m: () => setMuted((v) => !v),
        ArrowUp: () => setVolume((v) => Math.min(1, v + 0.1)),
        ArrowDown: () => setVolume((v) => Math.max(0, v - 0.1)),
      };

      const action = map[e.key];
      if (action) { e.preventDefault(); action(); setChrome(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seekBy, toggleFullscreen]);

  /* ---------------------------------------------------------- chrome hide */

  const wake = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!menu) setChrome(false);
    }, 3000);
  }, [menu]);

  useEffect(() => { wake(); }, [wake, playing]);

  /* ---------------------------------------------------------------- intro */

  const intro = payload?.chapters?.intro;
  const inIntro = Boolean(intro && position >= intro[0] && position < intro[1]);

  useEffect(() => {
    if (inIntro && preferences.autoSkipIntro && intro) seekTo(intro[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inIntro, preferences.autoSkipIntro]);

  const hasNext = totalEpisodes ? episode < totalEpisodes : true;

  /* ----------------------------------------------------------------- view */

  if (error) {
    return (
      <div className="grid min-h-svh place-items-center bg-ink-900 px-6 text-center">
        <div className="max-w-[38ch]">
          <h1 className="font-display text-title font-bold text-paper">This episode would not play</h1>
          <p className="mt-2 text-body text-haze">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => location.reload()} className="key-primary">Reload</button>
            <Link href={`/title/${animeId}`} className="key-ghost">Back to episodes</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shell}
      onMouseMove={wake}
      onTouchStart={wake}
      className="relative min-h-svh select-none bg-black"
    >
      <video
        ref={video}
        playsInline
        className="h-svh w-full object-contain"
        onClick={toggle}
        onTimeUpdate={onTime}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        style={{ ['--cue-scale' as string]: SUB_SIZE[preferences.subtitleSize] }}
      >
        {(payload?.subtitles || []).map((s) => (
          <track
            key={s.lang}
            kind="subtitles"
            src={s.url}
            srcLang={s.lang}
            label={s.label}
            default={preferences.subtitleLang === s.lang}
          />
        ))}
      </video>

      {buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 size={40} className="animate-spin text-paper/80" aria-hidden />
        </div>
      )}

      {/* Skip intro sits above the controls so it never fights the seek bar. */}
      {inIntro && !preferences.autoSkipIntro && intro && (
        <button
          onClick={() => seekTo(intro[1])}
          className="key-ghost absolute bottom-28 right-6 z-20 border-paper/25 bg-black/60"
        >
          Skip intro
        </button>
      )}

      <div
        className={`absolute inset-0 z-10 flex flex-col justify-between
                    bg-gradient-to-b from-black/70 via-transparent to-black/85
                    transition-opacity duration-300
                    ${chrome || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <header className="flex items-start gap-4 p-5">
          <Link
            href={`/title/${animeId}`}
            aria-label="Back to episodes"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/50 text-paper backdrop-blur"
          >
            <ArrowLeft size={19} aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-title font-bold text-paper">{title}</h1>
            <p className="text-meta text-haze">
              Episode {episode}{totalEpisodes ? ` of ${totalEpisodes}` : ''}
              {source ? ` — ${source.label}` : ''}
            </p>
          </div>
        </header>

        <footer className="space-y-3 p-5">
          <Scrubber position={position} duration={duration || payload?.duration || 0} onSeek={seekTo} />

          <div className="flex items-center gap-2">
            <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
              {playing ? <Pause size={22} aria-hidden /> : <Play size={22} className="fill-paper" aria-hidden />}
            </IconButton>

            <div className="group/vol flex items-center gap-1.5">
              <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((v) => !v)}>
                {muted || volume === 0 ? <VolumeX size={20} aria-hidden /> : <Volume2 size={20} aria-hidden />}
              </IconButton>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                aria-label="Volume"
                data-owns-arrows="true"
                className="h-1 w-0 cursor-pointer accent-[rgb(var(--chroma))] opacity-0
                           transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100
                           focus-visible:w-20 focus-visible:opacity-100"
              />
            </div>

            <span className="ml-1 text-meta tabular-nums text-haze">
              {timecode(position)} / {timecode(duration || payload?.duration || 0)}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {payload?.sources?.length ? (
                <IconButton label="Audio and subtitles" onClick={() => setMenu((v) => !v)} pressed={menu}>
                  {(payload.subtitles?.length ?? 0) > 0 ? <Subtitles size={20} aria-hidden /> : <Settings size={20} aria-hidden />}
                </IconButton>
              )}

              {hasNext && (
                <Link
                  href={`/watch/${animeId}?ep=${episode + 1}`}
                  className="key-ghost border-paper/20 bg-black/50 py-2"
                >
                  <SkipForward size={16} aria-hidden />
                  Next episode
                </Link>
              )}

              <IconButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize size={20} aria-hidden /> : <Maximize size={20} aria-hidden />}
              </IconButton>
            </div>
          </div>
        </footer>
      </div>

      {menu && payload && (
        <LanguageMenu
          payload={payload}
          current={source}
          preferences={preferences}
          onPickSource={(s) => {
            setSource(s);
            setPreferences({ audio: s.kind, audioLang: s.audioLang });
          }}
          onPickSubtitle={(lang) => {
            setPreferences({ subtitleLang: lang });
            const tracks = video.current?.textTracks;
            if (tracks) {
              for (let i = 0; i < tracks.length; i += 1) {
                tracks[i].mode = tracks[i].language === lang ? 'showing' : 'disabled';
              }
            }
          }}
          onSetSize={(subtitleSize) => setPreferences({ subtitleSize })}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  );
}

function IconButton({
  label, onClick, pressed, children,
}: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={`grid h-10 w-10 place-items-center rounded-full transition-colors duration-150
                  ${pressed ? 'bg-paper text-ink-900' : 'text-paper hover:bg-paper/15'}`}
    >
      {children}
    </button>
  );
}

function Scrubber({
  position, duration, onSeek,
}: { position: number; duration: number; onSeek: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div
      className="group/seek relative py-2"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        setHover(((e.clientX - box.left) / box.width) * duration);
      }}
    >
      <div className="h-1 rounded-full bg-paper/25 transition-all group-hover/seek:h-1.5">
        <div className="h-full rounded-full bg-chroma" style={{ width: `${pct}%` }} />
      </div>

      <span
        className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-chroma opacity-0 transition-opacity group-hover/seek:opacity-100"
        style={{ left: `${pct}%` }}
        aria-hidden
      />

      {hover !== null && (
        <span
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/85
                     px-1.5 py-0.5 text-micro tabular-nums text-paper"
          style={{ left: `${(hover / duration) * 100}%` }}
          aria-hidden
        >
          {timecode(hover)}
        </span>
      )}

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={position}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek"
        data-owns-arrows="true"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
