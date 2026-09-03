'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize,
  SkipForward, SkipBack, Settings, ArrowLeft, Loader2, Subtitles,
  PictureInPicture2, Keyboard, RotateCcw, RotateCw,
} from 'lucide-react';
import Link from 'next/link';
import { useLibrary } from '@/store/useLibrary';
import { timecode } from '@/lib/format';
import type { StreamPayload, StreamSource } from '@/app/api/stream/route';
import { PlayerMenu, type QualityLevel } from './PlayerMenu';
import { NextUpCard } from './NextUpCard';
import { ShortcutSheet } from './ShortcutSheet';

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
const SEEK_STEP = 10;
/** How long "Next episode" counts down once the outro starts. */
const NEXT_UP_LEAD = 25;

export function Player({
  animeId, title, cover, color, episode, totalEpisodes, startAt = 0,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(0);
  const lastTap = useRef(0);

  const { preferences, setPreferences, recordProgress } = useLibrary();

  const [payload, setPayload] = useState<StreamPayload | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startAt);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [menu, setMenu] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [flash, setFlash] = useState<{ side: 'back' | 'forward'; at: number } | null>(null);

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [level, setLevel] = useState(-1);

  const hasNext = totalEpisodes ? episode < totalEpisodes : true;

  /* ---------------------------------------------------------------- fetch */

  useEffect(() => {
    let live = true;
    setPayload(null);
    setError(null);
    setBuffering(true);
    setPosition(startAt);
    setLevels([]);

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
        const pick =
          data.sources.find((s) => s.kind === preferences.audio && s.audioLang === preferences.audioLang) ??
          data.sources.find((s) => s.kind === preferences.audio) ??
          data.sources[0];
        setSource(pick ?? null);
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

    // Switching audio track mid-episode must not restart the episode, so the
    // resume point is whatever is on screen right now — falling back to the
    // deep link's ?t= only on first attach.
    const resumeAt = position > 5 ? position : startAt;

    if (source.type === 'hls' && Hls.isSupported()) {
      const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
      instance.loadSource(source.url);
      instance.attachMedia(el);

      instance.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (resumeAt > 0) el.currentTime = resumeAt;
        setLevels(
          data.levels.map((l, i) => ({
            index: i,
            height: l.height ?? 0,
            bitrate: l.bitrate ?? 0,
            label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)} kbps`,
          })),
        );
      });

      instance.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setLevel(instance.autoLevelEnabled ? -1 : data.level));

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

    if (el.buffered.length > 0) {
      setBuffered(el.buffered.end(el.buffered.length - 1));
    }

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
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
    setFlash({ side: delta < 0 ? 'back' : 'forward', at: Date.now() });
    setChrome(true);
  }, []);

  const seekTo = useCallback((value: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = value;
    setPosition(value);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!shell.current) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await shell.current.requestFullscreen().catch(() => {});
  }, []);

  const togglePip = useCallback(async () => {
    const el = video.current;
    if (!el || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* Some browsers refuse before metadata loads; nothing useful to say. */
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // React does not type the picture-in-picture events on <video>, so they are
  // bound directly rather than cast onto the JSX props.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    el.addEventListener('enterpictureinpicture', enter);
    el.addEventListener('leavepictureinpicture', leave);
    return () => {
      el.removeEventListener('enterpictureinpicture', enter);
      el.removeEventListener('leavepictureinpicture', leave);
    };
  }, []);

  /* Volume, mute and speed live in preferences so they survive the jump to
     the next episode — and the next session. */
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.volume = preferences.volume;
    el.muted = preferences.muted;
    el.playbackRate = preferences.playbackRate;
  }, [preferences.volume, preferences.muted, preferences.playbackRate, source]);

  /* The seek flash badge clears itself. */
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [flash]);

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (menu) { setMenu(false); e.preventDefault(); }
        else if (shortcuts) { setShortcuts(false); e.preventDefault(); }
        return;
      }

      const map: Record<string, () => void> = {
        ' ': toggle,
        k: toggle,
        Enter: toggle,
        ArrowRight: () => seekBy(SEEK_STEP),
        ArrowLeft: () => seekBy(-SEEK_STEP),
        l: () => seekBy(SEEK_STEP),
        j: () => seekBy(-SEEK_STEP),
        f: toggleFullscreen,
        p: togglePip,
        c: () => setMenu((v) => !v),
        m: () => setPreferences({ muted: !preferences.muted }),
        ArrowUp: () => setPreferences({ volume: Math.min(1, Number((preferences.volume + 0.1).toFixed(2))), muted: false }),
        ArrowDown: () => setPreferences({ volume: Math.max(0, Number((preferences.volume - 0.1).toFixed(2))) }),
        '>': () => setPreferences({ playbackRate: Math.min(2, preferences.playbackRate + 0.25) }),
        '<': () => setPreferences({ playbackRate: Math.max(0.5, preferences.playbackRate - 0.25) }),
        '?': () => setShortcuts((v) => !v),
      };

      // Number keys jump to that tenth of the episode, the way every other
      // player on the web behaves.
      if (/^[0-9]$/.test(e.key) && duration > 0) {
        e.preventDefault();
        seekTo((Number(e.key) / 10) * duration);
        setChrome(true);
        return;
      }

      const action = map[e.key];
      if (action) { e.preventDefault(); action(); setChrome(true); }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seekBy, seekTo, toggleFullscreen, togglePip, setPreferences, preferences, duration, menu, shortcuts]);

  /* ---------------------------------------------------------- chrome hide */

  const wake = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!menu && !shortcuts) setChrome(false);
    }, 3000);
  }, [menu, shortcuts]);

  useEffect(() => { wake(); }, [wake, playing]);

  /** Double-tap the left or right third to seek, the way phones expect. */
  const onTouchStart = (e: React.TouchEvent) => {
    wake();
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const x = e.touches[0]?.clientX ?? 0;
      const third = window.innerWidth / 3;
      if (x < third) seekBy(-SEEK_STEP);
      else if (x > third * 2) seekBy(SEEK_STEP);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  /* ------------------------------------------------------ chapters & next */

  const intro = payload?.chapters?.intro;
  const outro = payload?.chapters?.outro;
  const inIntro = Boolean(intro && position >= intro[0] && position < intro[1]);
  const inOutro = Boolean(outro && position >= outro[0]);

  useEffect(() => {
    if (inIntro && preferences.autoSkipIntro && intro) seekTo(intro[1]);
  }, [inIntro, preferences.autoSkipIntro, intro, seekTo]);

  const total = duration || payload?.duration || 0;
  const nearEnd = total > 0 && total - position <= NEXT_UP_LEAD && position > 0;
  const showNextUp = hasNext && (inOutro || nearEnd);

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

  const muted = preferences.muted;
  const volume = preferences.volume;

  return (
    <div
      ref={shell}
      onMouseMove={wake}
      onTouchStart={onTouchStart}
      className={`relative min-h-svh select-none bg-black ${chrome || !playing ? '' : 'cursor-none'}`}
    >
      <video
        ref={video}
        playsInline
        className="h-svh w-full object-contain"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={onTime}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onVolumeChange={(e) => {
          const el = e.currentTarget;
          if (el.volume !== volume || el.muted !== muted) {
            setPreferences({ volume: el.volume, muted: el.muted });
          }
        }}
        style={{ ['--cue-scale' as string]: SUB_SIZE[preferences.subtitleSize] }}
      >
        {payload?.subtitles.map((s) => (
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

      {/* Double-tap feedback: a badge on the side that was tapped. */}
      {flash && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 animate-fade
                      ${flash.side === 'back' ? 'left-[12%]' : 'right-[12%]'}`}
          aria-hidden
        >
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-3 text-paper backdrop-blur">
            {flash.side === 'back' ? <RotateCcw size={20} /> : <RotateCw size={20} />}
            <span className="text-meta font-semibold tabular-nums">{SEEK_STEP}s</span>
          </div>
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

      {showNextUp && (
        <NextUpCard
          href={`/watch/${animeId}?ep=${episode + 1}`}
          episode={episode + 1}
          autoPlay={preferences.autoPlayNext}
          remaining={Math.max(0, Math.ceil(total - position))}
          lead={NEXT_UP_LEAD}
        />
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
              {preferences.playbackRate !== 1 ? ` — ${preferences.playbackRate}×` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShortcuts(true)}
            aria-label="Keyboard shortcuts"
            className="ml-auto hidden shrink-0 rounded-full bg-black/40 p-2.5 text-haze
                       backdrop-blur transition-colors hover:text-paper [@media(pointer:fine)]:block"
          >
            <Keyboard size={18} aria-hidden />
          </button>
        </header>

        <footer className="space-y-3 p-5">
          <Scrubber
            position={position}
            duration={total}
            buffered={buffered}
            chapters={payload?.chapters}
            onSeek={seekTo}
          />

          <div className="flex items-center gap-2">
            <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
              {playing ? <Pause size={22} aria-hidden /> : <Play size={22} className="fill-paper" aria-hidden />}
            </IconButton>

            <IconButton label={`Back ${SEEK_STEP} seconds`} onClick={() => seekBy(-SEEK_STEP)}>
              <SkipBack size={19} aria-hidden />
            </IconButton>
            <IconButton label={`Forward ${SEEK_STEP} seconds`} onClick={() => seekBy(SEEK_STEP)}>
              <SkipForward size={19} aria-hidden />
            </IconButton>

            <div className="group/vol flex items-center gap-1.5">
              <IconButton
                label={muted ? 'Unmute' : 'Mute'}
                onClick={() => setPreferences({ muted: !muted })}
              >
                {muted || volume === 0
                  ? <VolumeX size={20} aria-hidden />
                  : volume < 0.5
                    ? <Volume1 size={20} aria-hidden />
                    : <Volume2 size={20} aria-hidden />}
              </IconButton>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => setPreferences({ volume: Number(e.target.value), muted: false })}
                aria-label="Volume"
                data-owns-arrows="true"
                className="h-1 w-0 cursor-pointer accent-[rgb(var(--chroma))] opacity-0
                           transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100
                           focus-visible:w-20 focus-visible:opacity-100"
              />
            </div>

            <span className="ml-1 text-meta tabular-nums text-haze">
              {timecode(position)} <span className="text-haze/50">/ {timecode(total)}</span>
            </span>

            <div className="ml-auto flex items-center gap-2">
              {payload && (
                <IconButton label="Audio, subtitles and quality" onClick={() => setMenu((v) => !v)} pressed={menu}>
                  {payload.subtitles.length > 0 ? <Subtitles size={20} aria-hidden /> : <Settings size={20} aria-hidden />}
                </IconButton>
              )}

              {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                <IconButton label="Picture in picture" onClick={togglePip} pressed={pip}>
                  <PictureInPicture2 size={19} aria-hidden />
                </IconButton>
              )}

              {hasNext && (
                <Link
                  href={`/watch/${animeId}?ep=${episode + 1}`}
                  className="key-ghost hidden border-paper/20 bg-black/50 py-2 sm:inline-flex"
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
        <PlayerMenu
          payload={payload}
          current={source}
          preferences={preferences}
          levels={levels}
          activeLevel={level}
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
          onPickLevel={(index) => {
            setLevel(index);
            if (hls.current) hls.current.currentLevel = index;
          }}
          onSetPreference={setPreferences}
          onClose={() => setMenu(false)}
        />
      )}

      <ShortcutSheet open={shortcuts} onClose={() => setShortcuts(false)} seekStep={SEEK_STEP} />
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function IconButton({
  label, onClick, pressed, children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`grid h-10 w-10 place-items-center rounded-full text-paper transition-colors
                  duration-150 hover:bg-white/12 ${pressed ? 'bg-white/15' : ''}`}
    >
      {children}
    </button>
  );
}

/**
 * The seek bar carries three layers of information: where you are, how much
 * has downloaded ahead of you, and where the intro and outro sit. The buffered
 * band is the one most players omit, and it is the difference between "this is
 * broken" and "this is still loading" when a stream stalls.
 */
function Scrubber({
  position, duration, buffered, chapters, onSeek,
}: {
  position: number;
  duration: number;
  buffered: number;
  chapters?: { intro?: [number, number]; outro?: [number, number] };
  onSeek: (v: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  const marks = useMemo(() => {
    if (!duration || !chapters) return [];
    return (['intro', 'outro'] as const)
      .map((key) => {
        const span = chapters[key];
        if (!span) return null;
        return {
          key,
          left: (span[0] / duration) * 100,
          width: ((span[1] - span[0]) / duration) * 100,
        };
      })
      .filter(Boolean) as { key: string; left: number; width: number }[];
  }, [chapters, duration]);

  return (
    <div
      className="group/seek relative py-2"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        setHover(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * duration);
      }}
    >
      <div className="relative h-1 overflow-hidden rounded-full bg-paper/20 transition-all group-hover/seek:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-paper/25" style={{ width: `${bufferedPct}%` }} />
        {marks.map((m) => (
          <div
            key={m.key}
            className="absolute inset-y-0 bg-gold/40"
            style={{ left: `${m.left}%`, width: `${m.width}%` }}
            aria-hidden
          />
        ))}
        <div className="absolute inset-y-0 left-0 rounded-full bg-chroma" style={{ width: `${pct}%` }} />
      </div>

      <span
        className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-chroma opacity-0 transition-opacity group-hover/seek:opacity-100"
        style={{ left: `${pct}%` }}
        aria-hidden
      />

      {hover !== null && duration > 0 && (
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
        aria-valuetext={`${timecode(position)} of ${timecode(duration)}`}
        data-owns-arrows="true"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
