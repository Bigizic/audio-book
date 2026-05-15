"use client";

import { VoiceSamplePlayer } from "@/components/VoiceSamplePlayer";
import { formatBytes } from "@/lib/format";
import { previewAudioUrl } from "@/lib/api";
import { Clock, Download, Loader2, RefreshCw } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getOrCreatePreviewSessionId } from "@/lib/previewPlaybackStorage";

export const AUDIOBOOK_RESULT_PLAYER_ID = "__audiobook_result__";
export const AUDIOBOOK_LIVE_PLAYER_ID = "__audiobook_live__";

type PreviewKind = "none" | "mp3" | "wav";

type Props = {
  complete: boolean;
  generating: boolean;
  livePreviewSupported: boolean;
  jobId: string | null;
  /** From job status (SSE / poll) — when this grows, “Load latest” enables. */
  partialWavBytes: number | null;
  sizeBytes: number | null;
  onDownload: () => void;
  /** True while native download is being triggered (spinner on MP3 button). */
  downloadBusy: boolean;
  finalMp3Src: string | null;
  playingVoiceId: string | null;
  setPlayingVoiceId: Dispatch<SetStateAction<string | null>>;
  onAudiobookAudioElement?: (element: HTMLAudioElement | null) => void;
};

export function DownloadSection({
  complete,
  generating,
  livePreviewSupported,
  jobId,
  partialWavBytes,
  sizeBytes,
  onDownload,
  downloadBusy,
  finalMp3Src,
  playingVoiceId,
  setPlayingVoiceId,
  onAudiobookAudioElement,
}: Props) {
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("none");
  const [previewError, setPreviewError] = useState(false);
  const playUrlRef = useRef<string | null>(null);
  const [liveLoadedBytes, setLiveLoadedBytes] = useState<number | null>(null);
  const [liveReloadNonce, setLiveReloadNonce] = useState(0);
  const partialRef = useRef(partialWavBytes);
  partialRef.current = partialWavBytes;
  const liveInitialFetchedRef = useRef(false);
  const initialWavLoadStartedRef = useRef(false);

  const liveActive =
    Boolean(
      generating &&
        livePreviewSupported &&
        jobId &&
        partialWavBytes != null &&
        partialWavBytes > 0,
    );

  const visible = complete || liveActive;

  const previewFingerprint = useMemo(() => {
    if (!visible || !jobId) return null;
    /** One session for live WAV + final MP3 so timeline & speed survive encode completion. */
    return `job:${jobId}:audiobook-preview`;
  }, [visible, jobId]);

  const [previewPlaybackId, setPreviewPlaybackId] = useState<string | null>(null);

  useEffect(() => {
    if (!previewFingerprint) {
      setPreviewPlaybackId(null);
      return;
    }
    setPreviewPlaybackId(getOrCreatePreviewSessionId(previewFingerprint));
  }, [previewFingerprint]);

  const staleLive =
    liveLoadedBytes !== null &&
    partialWavBytes != null &&
    partialWavBytes > liveLoadedBytes;

  const fetchToBlobUrl = useCallback(
    async (url: string, kind: PreviewKind) => {
      setPreviewError(false);
      setPlayUrl(null);
      if (playUrlRef.current) {
        URL.revokeObjectURL(playUrlRef.current);
        playUrlRef.current = null;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("preview fetch failed");
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      playUrlRef.current = u;
      setPlayUrl(u);
      setPreviewKind(kind);
    },
    [],
  );

  useEffect(() => {
    if (!complete || !finalMp3Src) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await fetchToBlobUrl(finalMp3Src, "mp3");
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (playUrlRef.current) {
        URL.revokeObjectURL(playUrlRef.current);
        playUrlRef.current = null;
      }
      setPlayUrl(null);
      setPreviewKind("none");
    };
  }, [complete, finalMp3Src, fetchToBlobUrl]);

  useEffect(() => {
    if (complete || !liveActive || !jobId) {
      return;
    }
    if (partialWavBytes == null || partialWavBytes <= 0) {
      return;
    }
    if (liveInitialFetchedRef.current || initialWavLoadStartedRef.current) {
      return;
    }

    initialWavLoadStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const bytes = partialRef.current ?? partialWavBytes;
        if (bytes == null || bytes <= 0) return;
        const url = previewAudioUrl(jobId, bytes);
        await fetchToBlobUrl(url, "wav");
        if (!cancelled) {
          setLiveLoadedBytes(bytes);
          liveInitialFetchedRef.current = true;
        }
      } catch {
        if (!cancelled) setPreviewError(true);
      } finally {
        initialWavLoadStartedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [complete, liveActive, jobId, partialWavBytes, fetchToBlobUrl]);

  useEffect(() => {
    if (liveReloadNonce === 0) return;
    if (complete || !liveActive || !jobId) return;
    const bytes = partialRef.current;
    if (bytes == null || bytes <= 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const url = previewAudioUrl(jobId, bytes);
        await fetchToBlobUrl(url, "wav");
        if (!cancelled) setLiveLoadedBytes(bytes);
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveReloadNonce, complete, liveActive, jobId, fetchToBlobUrl]);

  useEffect(() => {
    if (!jobId) {
      setLiveLoadedBytes(null);
      setLiveReloadNonce(0);
      liveInitialFetchedRef.current = false;
      initialWavLoadStartedRef.current = false;
    }
  }, [jobId]);

  useEffect(() => {
    if (!generating) {
      setLiveLoadedBytes(null);
      liveInitialFetchedRef.current = false;
      initialWavLoadStartedRef.current = false;
    }
  }, [generating]);

  const reloadLive = useCallback(() => {
    const j = jobId;
    const bytes = partialRef.current;
    if (!j || bytes == null || bytes <= 0) return;
    setLiveReloadNonce((n) => n + 1);
  }, [jobId]);

  if (!visible) return null;

  const showLiveRefreshSlot =
    liveActive && previewKind === "wav" && playUrl && liveLoadedBytes !== null;

  return (
    <section className="rounded-2xl border border-accent/25 bg-surface/85 p-4 shadow-soft backdrop-blur-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-ink sm:mb-4">
        <Download className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
        <h2 className="font-serif text-lg sm:text-xl">
          {complete ? "Your audiobook" : "Your audiobook (in progress)"}
        </h2>
      </div>
      <p className="mb-4 text-pretty text-xs text-muted sm:text-sm">
        {complete && sizeBytes != null && (
          <span className="mr-2 font-medium text-ink">{formatBytes(sizeBytes)}</span>
        )}
        {complete
          ? "MP3"
          : "WAV preview — status updates enable “Load latest” when more audio is saved."}
      </p>

      <div className="flex min-w-0 flex-col gap-4 sm:items-stretch sm:gap-4">
        {previewError && (
          <p className="text-pretty text-xs text-muted sm:text-sm">
            In-browser preview failed (CORS or network). Download still works when ready.
          </p>
        )}
        {playUrl ? (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <div className="min-w-0 flex-1">
              <VoiceSamplePlayer
                src={playUrl}
                voiceId={
                  previewKind === "wav"
                    ? AUDIOBOOK_LIVE_PLAYER_ID
                    : AUDIOBOOK_RESULT_PLAYER_ID
                }
                playingVoiceId={playingVoiceId}
                setPlayingVoiceId={setPlayingVoiceId}
                groupAriaLabel={
                  previewKind === "wav" ? "Live audiobook preview" : "Audiobook playback"
                }
                playLabel={previewKind === "wav" ? "Play preview" : "Play audiobook"}
                pauseLabel={previewKind === "wav" ? "Pause preview" : "Pause audiobook"}
                showPlaybackSpeed
                playbackPersistenceId={previewPlaybackId}
                onAudioElement={onAudiobookAudioElement}
              />
            </div>
            {showLiveRefreshSlot ? (
              <button
                type="button"
                onClick={reloadLive}
                disabled={!staleLive}
                title={
                  staleLive
                    ? "Fetch the longer preview from the server"
                    : "Wait for a status update with more audio"
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-full border border-line bg-surface px-4 py-2.5 text-xs font-medium text-ink shadow-card transition hover:border-accent/40 enabled:hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 sm:self-start sm:py-3 sm:text-sm"
                aria-label={
                  staleLive
                    ? "Load latest preview audio"
                    : "Load latest preview audio (no update yet)"
                }
              >
                <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Load latest
              </button>
            ) : null}
          </div>
        ) : (complete && finalMp3Src && !previewError) ||
          (liveActive && !previewError) ? (
          <p className="flex flex-1 items-center text-pretty text-xs text-muted sm:text-sm">
            Loading preview…
          </p>
        ) : null}
        {complete ? (
          <div className="flex shrink-0 items-start sm:items-center">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloadBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-xs font-medium text-ink shadow-card transition hover:border-accent/40 disabled:cursor-wait disabled:opacity-90 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
            >
              {downloadBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
              ) : (
                <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              )}
              {downloadBusy ? "Starting download…" : "Download MP3"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-paper/80 px-3 py-2 text-pretty text-xs text-muted sm:mt-4 sm:text-sm dark:bg-paper/40">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
        <span>
          This file is available for about <strong className="text-ink">30 minutes</strong>
          , then it leaves our servers for good.
        </span>
      </div>
    </section>
  );
}
