"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { buildPlaybackSpeedOptions } from "@/lib/playbackSpeedOptions";
import {
  clearPreviewPlayback,
  ensurePreviewPlaybackMatches,
  readPreviewPlayback,
  writePreviewPlayback,
} from "@/lib/previewPlaybackStorage";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeedLabel(rate: number): string {
  const t = rate.toFixed(2).replace(/\.?0+$/, "");
  return `${t}×`;
}

/** Tick marks line up with native range thumb centers (thumb width must match CSS). */
function PlaybackSpeedTicks({
  options,
  thumbPx,
}: {
  options: number[];
  thumbPx: number;
}) {
  const n = options.length;
  const tickLeft = (i: number) =>
    n <= 1
      ? "50%"
      : `calc(${thumbPx / 2}px + (100% - ${thumbPx}px) * ${i / (n - 1)})`;

  return (
    <div
      className="pointer-events-none relative mt-0.5 h-2.5 w-full select-none"
      aria-hidden
    >
      {options.map((r: number, i: number) => (
        <span
          key={r}
          className="absolute top-0 -translate-x-1/2 font-mono text-[8px] leading-none text-muted/70 sm:text-[9px]"
          style={{ left: tickLeft(i) }}
        >
          |
        </span>
      ))}
    </div>
  );
}

type Props = {
  src: string;
  voiceId: string;
  playingVoiceId: string | null;
  setPlayingVoiceId: Dispatch<SetStateAction<string | null>>;
  /** e.g. "Audiobook preview" vs "Voice sample playback" */
  groupAriaLabel?: string;
  playLabel?: string;
  pauseLabel?: string;
  /** When true, show a speed selector (uses HTMLAudioElement.playbackRate). */
  showPlaybackSpeed?: boolean;
  /** Lowest rate in the selector (e.g. 1.0). */
  playbackSpeedMin?: number;
  /** Highest rate in the selector (e.g. 1.2). */
  playbackSpeedMax?: number;
  /** Step between options (e.g. 0.05 → 1.0, 1.05, 1.10, …). */
  playbackSpeedStep?: number;
  /** Rate applied on load / when `src` changes. */
  playbackSpeedDefault?: number;
  /** When set, persist `currentTime` / duration for this preview (UUID from parent). */
  playbackPersistenceId?: string | null;
  /** Report `<audio>` for audiobook sync (e.g. 3D reading room). */
  onAudioElement?: (element: HTMLAudioElement | null) => void;
};

export function VoiceSamplePlayer({
  src,
  voiceId,
  playingVoiceId,
  setPlayingVoiceId,
  groupAriaLabel = "Voice sample playback",
  playLabel = "Play sample",
  pauseLabel = "Pause sample",
  showPlaybackSpeed = false,
  playbackSpeedMin = 0.5,
  playbackSpeedMax = 2,
  playbackSpeedStep = 0.05,
  playbackSpeedDefault = 1,
  playbackPersistenceId = null,
  onAudioElement,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const persistenceIdRef = useRef<string | null>(null);
  persistenceIdRef.current = playbackPersistenceId ?? null;
  const lastSaveAtRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const speedOptions = useMemo(
    () =>
      showPlaybackSpeed
        ? buildPlaybackSpeedOptions(
            playbackSpeedMin,
            playbackSpeedMax,
            playbackSpeedStep,
          )
        : [],
    [
      showPlaybackSpeed,
      playbackSpeedMin,
      playbackSpeedMax,
      playbackSpeedStep,
    ],
  );

  const [playbackRate, setPlaybackRate] = useState(playbackSpeedDefault);
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  useEffect(() => {
    setPlaybackRate(playbackSpeedDefault);
  }, [src, playbackSpeedDefault]);

  useEffect(() => {
    if (!playbackPersistenceId) return;
    ensurePreviewPlaybackMatches(playbackPersistenceId);
  }, [playbackPersistenceId]);

  const savePlaybackPosition = useCallback(() => {
    const a = audioRef.current;
    const pid = persistenceIdRef.current;
    if (!a || !pid) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const r = showPlaybackSpeed
      ? Math.min(
          playbackSpeedMax,
          Math.max(playbackSpeedMin, playbackRateRef.current),
        )
      : playbackSpeedDefault;
    writePreviewPlayback({
      v: 1,
      previewId: pid,
      currentTime: a.currentTime,
      duration: d,
      playbackRate: r,
    });
  }, [
    showPlaybackSpeed,
    playbackSpeedMin,
    playbackSpeedMax,
    playbackSpeedDefault,
  ]);

  const applyPlaybackRateToElement = useCallback(() => {
    const a = audioRef.current;
    if (!a || !showPlaybackSpeed) return;
    const r = Math.min(
      playbackSpeedMax,
      Math.max(playbackSpeedMin, playbackRateRef.current),
    );
    try {
      a.defaultPlaybackRate = r;
      a.playbackRate = r;
    } catch {
      /* ignore */
    }
  }, [showPlaybackSpeed, playbackSpeedMin, playbackSpeedMax]);

  useEffect(() => {
    applyPlaybackRateToElement();
  }, [applyPlaybackRateToElement, playbackRate]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playingVoiceId !== null && playingVoiceId !== voiceId) {
      a.pause();
    }
  }, [playingVoiceId, voiceId]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    lastSaveAtRef.current = 0;

    const restoreIfStored = () => {
      const pid = persistenceIdRef.current;
      if (!pid) return;
      const d = a.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const s = readPreviewPlayback();
      if (!s || s.previewId !== pid) return;
      const t = Math.min(Math.max(0, s.currentTime), Math.max(0, d - 0.05));
      a.currentTime = t;
      setCurrent(t);
      if (showPlaybackSpeed) {
        const r = Math.min(
          playbackSpeedMax,
          Math.max(playbackSpeedMin, s.playbackRate),
        );
        setPlaybackRate(r);
        playbackRateRef.current = r;
        try {
          a.defaultPlaybackRate = r;
          a.playbackRate = r;
        } catch {
          /* ignore */
        }
      }
    };

    const onTime = () => {
      const t = a.currentTime;
      setCurrent(t);
      const pid = persistenceIdRef.current;
      if (!pid || a.paused) return;
      const d = a.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const now = Date.now();
      if (now - lastSaveAtRef.current < 240) return;
      lastSaveAtRef.current = now;
      const r = showPlaybackSpeed
        ? Math.min(
            playbackSpeedMax,
            Math.max(playbackSpeedMin, playbackRateRef.current),
          )
        : playbackSpeedDefault;
      writePreviewPlayback({
        v: 1,
        previewId: pid,
        currentTime: t,
        duration: d,
        playbackRate: r,
      });
    };
    const onMeta = () => {
      setDuration(a.duration || 0);
      applyPlaybackRateToElement();
      restoreIfStored();
    };
    const onPlay = () => {
      applyPlaybackRateToElement();
      setPlaying(true);
      setPlayingVoiceId(voiceId);
      lastSaveAtRef.current = 0;
      savePlaybackPosition();
    };
    const onPause = () => {
      setPlaying(false);
      setPlayingVoiceId((prev) => (prev === voiceId ? null : prev));
      savePlaybackPosition();
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      setPlayingVoiceId((prev) => (prev === voiceId ? null : prev));
      if (persistenceIdRef.current) {
        clearPreviewPlayback();
      }
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("canplay", applyPlaybackRateToElement);
    a.addEventListener("playing", applyPlaybackRateToElement);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("canplay", applyPlaybackRateToElement);
      a.removeEventListener("playing", applyPlaybackRateToElement);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [
    src,
    voiceId,
    setPlayingVoiceId,
    applyPlaybackRateToElement,
    savePlaybackPosition,
    showPlaybackSpeed,
    playbackSpeedMin,
    playbackSpeedMax,
    playbackSpeedDefault,
  ]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    a.load();
    requestAnimationFrame(() => {
      applyPlaybackRateToElement();
    });
  }, [src, applyPlaybackRateToElement]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlayingVoiceId(null);
    } else {
      applyPlaybackRateToElement();
      setPlayingVoiceId(voiceId);
      void a.play().catch(() => {
        setPlayingVoiceId(null);
      });
    }
  }, [playing, voiceId, setPlayingVoiceId, applyPlaybackRateToElement]);

  const seek = useCallback(
    (value: number) => {
      const a = audioRef.current;
      if (!a || !duration) return;
      a.currentTime = value;
      setCurrent(value);
      savePlaybackPosition();
    },
    [duration, savePlaybackPosition],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const onVolumeInput = useCallback((v: number) => {
    setVolume(v);
    if (v > 0) setMuted(false);
  }, []);

  const speedSelectValue = useMemo(() => {
    if (speedOptions.length === 0) return playbackRate;
    let best = speedOptions[0]!;
    let bestD = Math.abs(best - playbackRate);
    for (const x of speedOptions) {
      const d = Math.abs(x - playbackRate);
      if (d < bestD) {
        best = x;
        bestD = d;
      }
    }
    return best;
  }, [speedOptions, playbackRate]);

  const maxDur = duration > 0 ? duration : 1;

  useEffect(() => {
    const el = audioRef.current;
    onAudioElement?.(el ?? null);
    return () => {
      onAudioElement?.(null);
    };
  }, [src, onAudioElement]);

  return (
    <div
      className="voice-player w-full min-w-0 overflow-hidden rounded-xl border border-line bg-paper px-3 py-3 shadow-inner sm:px-4"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={groupAriaLabel}
    >
      <audio ref={audioRef} src={src} preload="metadata" hidden />

      <div className="flex flex-col gap-3">
        <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-soft transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={playing ? pauseLabel : playLabel}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            )}
          </button>

          <div className="min-w-0">
            <div className="min-w-0 py-1">
              <input
                type="range"
                min={0}
                max={maxDur}
                step={0.05}
                value={Math.min(current, maxDur)}
                onChange={(e) => seek(Number(e.target.value))}
                className="voice-player-seek block h-3 w-full min-w-0 max-w-full cursor-pointer touch-manipulation"
                aria-label="Seek preview"
              />
            </div>
            <div className="mt-0.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 font-sans text-[0.625rem] tabular-nums text-ink/75 min-[400px]:gap-2 min-[400px]:text-[11px] sm:text-xs">
              <span className="min-w-0 truncate text-left">{formatTime(current)}</span>
              <span className="shrink-0 text-muted" aria-hidden>
                /
              </span>
              <span className="min-w-0 truncate text-right">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={toggleMute}
            className="shrink-0 rounded-md p-1.5 text-ink/60 transition hover:bg-line/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sage"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeInput(Number(e.target.value))}
            className="voice-player-vol h-2 min-w-0 flex-1 cursor-pointer touch-manipulation"
            aria-label="Volume"
          />
        </div>

        {showPlaybackSpeed && speedOptions.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-2 border-t border-line/70 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 text-[11px] font-medium text-muted sm:text-xs">
                Playback Speed Control
              </span>
              <span className="font-sans text-xs tabular-nums text-ink sm:text-sm">
                {formatSpeedLabel(speedSelectValue)}
              </span>
            </div>
            <div className="min-w-0">
              <input
                type="range"
                min={playbackSpeedMin}
                max={playbackSpeedMax}
                step={playbackSpeedStep}
                value={speedSelectValue}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setPlaybackRate(v);
                  playbackRateRef.current = v;
                  savePlaybackPosition();
                }}
                onChange={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setPlaybackRate(v);
                  playbackRateRef.current = v;
                  savePlaybackPosition();
                }}
                className="voice-player-seek voice-speed-slider m-0 block h-3 w-full min-w-0 max-w-full cursor-pointer touch-manipulation"
                aria-label="Playback speed"
                aria-valuemin={playbackSpeedMin}
                aria-valuemax={playbackSpeedMax}
                aria-valuenow={speedSelectValue}
              />
              <PlaybackSpeedTicks options={speedOptions} thumbPx={13} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
