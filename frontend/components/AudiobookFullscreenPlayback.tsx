"use client";

import { Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPlaybackSpeedOptions } from "@/lib/playbackSpeedOptions";

function formatSpeedLabel(rate: number): string {
  const t = rate.toFixed(2).replace(/\.?0+$/, "");
  return `${t}×`;
}

type Props = {
  audioEl: HTMLAudioElement | null;
};

export function AudiobookFullscreenPlayback({ audioEl }: Props) {
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const speedOptions = useMemo(
    () => buildPlaybackSpeedOptions(0.5, 2, 0.05),
    [],
  );

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

  useEffect(() => {
    const a = audioEl;
    if (!a) {
      setPlaying(false);
      return;
    }
    const syncRate = () => {
      const r = a.playbackRate;
      if (Number.isFinite(r) && r > 0) setPlaybackRate(r);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    syncRate();
    setPlaying(!a.paused && !a.ended);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("ratechange", syncRate);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("ratechange", syncRate);
    };
  }, [audioEl]);

  const applyRate = useCallback(
    (r: number) => {
      const a = audioEl;
      if (!a) return;
      const clamped = Math.min(2, Math.max(0.5, r));
      setPlaybackRate(clamped);
      try {
        a.defaultPlaybackRate = clamped;
        a.playbackRate = clamped;
      } catch {
        /* ignore */
      }
    },
    [audioEl],
  );

  const togglePlay = useCallback(() => {
    const a = audioEl;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => {
        /* ignore */
      });
    } else {
      a.pause();
    }
  }, [audioEl]);

  const stop = useCallback(() => {
    const a = audioEl;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
  }, [audioEl]);

  if (!audioEl) return null;

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      role="group"
      aria-label="Audiobook playback"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-soft transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={playing ? "Pause audiobook" : "Play audiobook"}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
          )}
        </button>
        <button
          type="button"
          onClick={stop}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink/80 transition hover:border-accent/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Stop audiobook"
        >
          <Square className="h-3 w-3" fill="currentColor" strokeWidth={0} />
        </button>
      </div>
      <label className="flex min-w-0 flex-1 items-center gap-2 text-[10px] text-muted sm:min-w-[12rem] sm:text-xs">
        <span className="shrink-0">Speed</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={speedSelectValue}
          onChange={(e) => applyRate(Number(e.target.value))}
          className="voice-player-seek h-2 min-w-0 flex-1 cursor-pointer accent-accent"
          aria-label="Playback speed"
          aria-valuenow={speedSelectValue}
        />
        <span className="w-8 shrink-0 text-right font-mono tabular-nums text-ink">
          {formatSpeedLabel(speedSelectValue)}
        </span>
      </label>
    </div>
  );
}
