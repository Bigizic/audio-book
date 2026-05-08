"use client";

import { VoiceSamplePlayer } from "@/components/VoiceSamplePlayer";
import { formatBytes } from "@/lib/format";
import { Clock, Download } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

export const AUDIOBOOK_RESULT_PLAYER_ID = "__audiobook_result__";

type Props = {
  visible: boolean;
  sizeBytes: number | null;
  onDownload: () => void;
  busy: boolean;
  mp3Src: string | null;
  playingVoiceId: string | null;
  setPlayingVoiceId: Dispatch<SetStateAction<string | null>>;
};

export function DownloadSection({
  visible,
  sizeBytes,
  onDownload,
  busy,
  mp3Src,
  playingVoiceId,
  setPlayingVoiceId,
}: Props) {
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const playUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mp3Src) {
      if (playUrlRef.current) {
        URL.revokeObjectURL(playUrlRef.current);
        playUrlRef.current = null;
      }
      setPlayUrl(null);
      setPreviewError(false);
      return;
    }
    let cancelled = false;
    setPreviewError(false);
    setPlayUrl(null);
    if (playUrlRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
      playUrlRef.current = null;
    }
    fetch(mp3Src)
      .then((r) => {
        if (!r.ok) throw new Error("preview fetch failed");
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        playUrlRef.current = u;
        setPlayUrl(u);
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true);
      });
    return () => {
      cancelled = true;
      if (playUrlRef.current) {
        URL.revokeObjectURL(playUrlRef.current);
        playUrlRef.current = null;
      }
      setPlayUrl(null);
    };
  }, [mp3Src]);

  if (!visible) return null;

  return (
    <section className="rounded-2xl border border-accent/25 bg-paper p-4 shadow-soft sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-ink sm:mb-4">
        <Download className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
        <h2 className="font-serif text-lg sm:text-xl">Your audiobook</h2>
      </div>
      <p className="mb-4 text-pretty text-xs text-muted sm:text-sm">
        {sizeBytes != null && (
          <span className="mr-2 font-medium text-ink">
            {formatBytes(sizeBytes)}
          </span>
        )}
        MP3 · 128 kbps
      </p>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-4">
        {previewError && (
          <p className="text-pretty text-xs text-muted sm:text-sm">
            In-browser preview failed (CORS or network). Download still works.
          </p>
        )}
        {playUrl ? (
          <div className="min-w-0 flex-1">
            <VoiceSamplePlayer
              src={playUrl}
              voiceId={AUDIOBOOK_RESULT_PLAYER_ID}
              playingVoiceId={playingVoiceId}
              setPlayingVoiceId={setPlayingVoiceId}
              groupAriaLabel="Audiobook playback"
              playLabel="Play audiobook"
              pauseLabel="Pause audiobook"
            />
          </div>
        ) : mp3Src && !previewError ? (
          <p className="flex flex-1 items-center text-pretty text-xs text-muted sm:text-sm">
            Loading preview…
          </p>
        ) : null}
        <div className="flex shrink-0 items-start sm:items-center">
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-xs font-medium text-ink shadow-card transition hover:border-accent/40 disabled:opacity-50 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
          >
            <Download className="h-4 w-4" />
            Download MP3
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-pretty text-xs text-muted sm:mt-4 sm:text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
        <span>
          This file is available for about <strong className="text-ink">30 minutes</strong>
          , then it leaves our servers for good.
        </span>
      </div>
    </section>
  );
}
