"use client";

import dynamic from "next/dynamic";
import { BookOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAudiobookAlignment } from "@/lib/api";
import type { AudiobookAlignmentManifest } from "@/lib/audiobookAlignment";

function LoadingBookSpinner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#ebe4d9]/85 text-xs text-muted"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-accent"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="font-medium tracking-wide">Loading book…</span>
    </div>
  );
}

const AudiobookBook3D = dynamic(
  () =>
    import("@/components/AudiobookBook3D").then((m) => ({
      default: m.AudiobookBook3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] max-h-[55vh] min-h-[280px] overflow-hidden rounded-xl">
        <LoadingBookSpinner />
      </div>
    ),
  },
);

const HIGHLIGHT_STORAGE = "audiobook:bookHighlight";
const TEXT_COLOR_STORAGE = "audiobook:bookTextColor";
const PAGE_COLOR_STORAGE = "audiobook:bookPageColor";
const ROOM_BG_STORAGE = "audiobook:readingRoomBg";
const BOOK_ZOOM_STORAGE = "audiobook:bookZoom";

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex shrink-0 flex-col items-start gap-1 text-[10px] text-muted sm:text-xs">
      <span className="truncate">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-12 cursor-pointer rounded border border-line bg-white p-0.5"
        title={label}
        aria-label={label}
      />
    </label>
  );
}

type Props = {
  jobId: string | null;
  /** Job finished — alignment file exists on server */
  isComplete: boolean;
  /** True while PDF still associated with the session */
  hasPdfContext: boolean;
  /** Wall-clock ms from HTMLAudioElement (slider / playback) */
  audioTimeMs: number;
  apiOk: boolean;
};

export function AudiobookBookPanel({
  jobId,
  isComplete,
  hasPdfContext,
  audioTimeMs,
  apiOk,
}: Props) {
  const [alignment, setAlignment] = useState<AudiobookAlignmentManifest | null>(
    null,
  );
  const [alignError, setAlignError] = useState<string | null>(null);
  const [highlightHex, setHighlightHex] = useState("#e8c4b3");
  const [textColor, setTextColor] = useState("#111111");
  const [pageColor, setPageColor] = useState("#fff7e7");
  const [roomBgColor, setRoomBgColor] = useState("#eadfce");
  const [bookZoom, setBookZoom] = useState(0.5);

  useEffect(() => {
    try {
      const s = localStorage.getItem(HIGHLIGHT_STORAGE);
      if (s?.startsWith("#")) setHighlightHex(s);
      const text = localStorage.getItem(TEXT_COLOR_STORAGE);
      if (text?.startsWith("#")) setTextColor(text);
      const page = localStorage.getItem(PAGE_COLOR_STORAGE);
      if (page?.startsWith("#")) setPageColor(page);
      const room = localStorage.getItem(ROOM_BG_STORAGE);
      if (room?.startsWith("#")) setRoomBgColor(room);
      const zoom = Number(localStorage.getItem(BOOK_ZOOM_STORAGE));
      if (Number.isFinite(zoom) && zoom >= 0.4 && zoom <= 1.2) setBookZoom(zoom);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HIGHLIGHT_STORAGE, highlightHex);
    } catch {
      /* ignore */
    }
  }, [highlightHex]);

  useEffect(() => {
    try {
      localStorage.setItem(TEXT_COLOR_STORAGE, textColor);
    } catch {
      /* ignore */
    }
  }, [textColor]);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_COLOR_STORAGE, pageColor);
    } catch {
      /* ignore */
    }
  }, [pageColor]);

  useEffect(() => {
    try {
      localStorage.setItem(ROOM_BG_STORAGE, roomBgColor);
    } catch {
      /* ignore */
    }
  }, [roomBgColor]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOK_ZOOM_STORAGE, String(bookZoom));
    } catch {
      /* ignore */
    }
  }, [bookZoom]);

  useEffect(() => {
    if (!apiOk || !jobId || !isComplete) {
      setAlignment(null);
      setAlignError(null);
      return;
    }
    let cancelled = false;
    setAlignError(null);
    void (async () => {
      try {
        const m = await fetchAudiobookAlignment(jobId);
        if (!cancelled) setAlignment(m);
      } catch (e) {
        if (!cancelled) {
          setAlignment(null);
          setAlignError(e instanceof Error ? e.message : "Could not load alignment");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOk, jobId, isComplete]);

  if (!hasPdfContext) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-white/70 shadow-card backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-ink">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
            <h2 className="font-serif text-base sm:text-lg">Reading room</h2>
          </div>
          <label className="flex w-full min-w-0 items-center gap-2 text-[10px] text-muted sm:w-auto sm:min-w-[9rem] sm:text-xs">
            <span>Zoom</span>
            <input
              type="range"
              min={0.4}
              max={1.2}
              step={0.05}
              value={bookZoom}
              onChange={(e) => setBookZoom(Number(e.target.value))}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-accent"
              aria-label="Book zoom"
            />
            <span className="w-8 text-right font-mono tabular-nums">
              {Math.round(bookZoom * 100)}%
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 justify-center sm:shrink-0 sm:justify-end">
          <ColorControl label="Highlight" value={highlightHex} onChange={setHighlightHex} />
          <ColorControl label="Text" value={textColor} onChange={setTextColor} />
          <ColorControl label="Pages" value={pageColor} onChange={setPageColor} />
          <ColorControl label="Room" value={roomBgColor} onChange={setRoomBgColor} />
        </div>
      </div>

      <div
        className={
          isComplete
            ? "relative h-[620px] max-h-[78vh] min-h-[460px] overflow-hidden rounded-b-2xl"
            : "relative h-[420px] max-h-[55vh] min-h-[280px] overflow-hidden rounded-b-2xl"
        }
      >
        {!isComplete && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-paper/85 px-4 text-center text-xs text-muted sm:text-sm">
            <p className="font-medium text-ink/80">3D open book &amp; word sync</p>
            <p className="max-w-xs text-pretty">
              When your audiobook is ready, this view follows playback, highlights words, and
              turns the page when audio moves to the next PDF page.
            </p>
          </div>
        )}
        {isComplete && alignError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/90 px-4 text-center text-xs text-muted">
            {alignError}
          </div>
        )}
        {isComplete && !alignment && !alignError && (
          <div className="absolute inset-0 z-[5]">
            <LoadingBookSpinner />
          </div>
        )}
        {isComplete && alignment && (
          <AudiobookBook3D
            alignment={alignment}
            timeMs={audioTimeMs}
            highlightHex={highlightHex}
            textColor={textColor}
            pageColor={pageColor}
            roomBgColor={roomBgColor}
            zoomScale={bookZoom}
          />
        )}
      </div>
    </section>
  );
}
