"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
};

export function VoiceSamplePlayer({
  src,
  voiceId,
  playingVoiceId,
  setPlayingVoiceId,
  groupAriaLabel = "Voice sample playback",
  playLabel = "Play sample",
  pauseLabel = "Pause sample",
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

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

    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => {
      setPlaying(true);
      setPlayingVoiceId(voiceId);
    };
    const onPause = () => {
      setPlaying(false);
      setPlayingVoiceId((prev) => (prev === voiceId ? null : prev));
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      setPlayingVoiceId((prev) => (prev === voiceId ? null : prev));
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [src, voiceId, setPlayingVoiceId]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    a.load();
  }, [src]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(voiceId);
      void a.play().catch(() => {
        setPlayingVoiceId(null);
      });
    }
  }, [playing, voiceId, setPlayingVoiceId]);

  const seek = useCallback(
    (value: number) => {
      const a = audioRef.current;
      if (!a || !duration) return;
      a.currentTime = value;
      setCurrent(value);
    },
    [duration],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const onVolumeInput = useCallback((v: number) => {
    setVolume(v);
    if (v > 0) setMuted(false);
  }, []);

  const maxDur = duration > 0 ? duration : 1;

  return (
    <div
      className="voice-player w-full min-w-0 overflow-hidden rounded-xl border border-line bg-paper px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:px-4"
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
      </div>
    </div>
  );
}
