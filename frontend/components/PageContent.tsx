"use client";

import { DownloadSection } from "@/components/DownloadSection";
import { Footer } from "@/components/Footer";
import { GenerateSection } from "@/components/GenerateSection";
import { Hero } from "@/components/Hero";
import { PageSelector } from "@/components/PageSelector";
import { UploadZone } from "@/components/UploadZone";
import { VoicePreview } from "@/components/VoicePreview";
import {
  downloadMp3Blob,
  downloadMp3Url,
  fetchFeatures,
  fetchStatus,
  fetchVoices,
  getApiBase,
  startConvert,
  statusStreamUrl,
  uploadPdf,
  type JobStatus,
  type StatusPayload,
  type VoiceItem,
} from "@/lib/api";
import { audiobookDownloadName } from "@/lib/audiobookFilename";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function PageContent() {
  const apiOk = useMemo(() => Boolean(getApiBase()), []);

  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [pageError, setPageError] = useState<string | null>(null);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [mp3Size, setMp3Size] = useState<number | null>(null);
  const [progressPhase, setProgressPhase] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [pagesInJob, setPagesInJob] = useState<number | null>(null);
  const [pagesDone, setPagesDone] = useState<number | null>(null);
  const [wordsDone, setWordsDone] = useState<number | null>(null);
  const [wordsTotal, setWordsTotal] = useState<number | null>(null);
  const [ttsChunkIndex, setTtsChunkIndex] = useState<number | null>(null);
  const [ttsChunksOnPage, setTtsChunksOnPage] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    "en_US-ryan-high",
  );
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voicesForLabels, setVoicesForLabels] = useState<VoiceItem[]>([]);

  const leftStackRef = useRef<HTMLDivElement>(null);
  const [voiceSectionHeightPx, setVoiceSectionHeightPx] = useState<number | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = leftStackRef.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px)");

    const sync = () => {
      if (!mq.matches) {
        setVoiceSectionHeightPx(null);
        return;
      }
      setVoiceSectionHeightPx(Math.round(el.getBoundingClientRect().height));
    };

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    mq.addEventListener("change", sync);
    sync();
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, [fileName, pageCount, pageError]);

  useEffect(() => {
    if (!apiOk) return;
    fetchVoices()
      .then(setVoicesForLabels)
      .catch(() => {
        /* VoicePreview shows voice load errors; download name falls back to voice_id */
      });
  }, [apiOk]);

  const voiceLabelForDownload = useMemo(() => {
    if (!selectedVoiceId) return "voice";
    const v = voicesForLabels.find((x) => x.voice_id === selectedVoiceId);
    return v?.label ?? selectedVoiceId;
  }, [voicesForLabels, selectedVoiceId]);

  const onFile = useCallback(async (file: File) => {
    if (!apiOk) {
      setToast("Set NEXT_PUBLIC_BACKEND_URL (your FastAPI URL).");
      return;
    }
    setUploadBusy(true);
    setToast(null);
    setPageError(null);
    try {
      const res = await uploadPdf(file);
      setJobId(res.job_id);
      setFileName(res.filename);
      setPageCount(res.page_count);
      setStartPage(1);
      setEndPage(res.page_count);
      setStatus("pending");
      setMessage("Uploaded. Ready when you are.");
      setProgressPercent(null);
      setEtaSeconds(null);
      setMp3Size(null);
      setProgressPhase(null);
      setCurrentPage(null);
      setPagesInJob(null);
      setPagesDone(null);
      setWordsDone(null);
      setWordsTotal(null);
      setTtsChunkIndex(null);
      setTtsChunksOnPage(null);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [apiOk]);

  const validatePages = useCallback(() => {
    if (!pageCount) return "Upload a PDF first.";
    if (startPage < 1 || endPage < 1) return "Pages must be at least 1.";
    if (startPage > endPage) return "Start page cannot be after end page.";
    if (endPage > pageCount) return `End page cannot exceed ${pageCount}.`;
    return null;
  }, [pageCount, startPage, endPage]);

  const onGenerate = useCallback(async () => {
    const err = validatePages();
    setPageError(err);
    if (err || !jobId || !apiOk || !selectedVoiceId) return;

    setGenBusy(true);
    setToast(null);
    try {
      await startConvert(jobId, selectedVoiceId, startPage, endPage);
      setStatus("extracting");
      setMessage("Starting…");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not start");
      setGenBusy(false);
    }
  }, [apiOk, jobId, selectedVoiceId, startPage, endPage, validatePages]);

  const applyStatus = useCallback((s: StatusPayload) => {
    setStatus(s.status);
    setMessage(s.message);
    setProgressPercent(s.progress_percent ?? null);
    setEtaSeconds(s.eta_seconds ?? null);
    if (s.mp3_size_bytes != null) setMp3Size(s.mp3_size_bytes);
    setProgressPhase(s.progress_phase ?? null);
    setCurrentPage(s.current_page ?? null);
    setPagesInJob(s.pages_in_job ?? null);
    setPagesDone(s.pages_done ?? null);
    setWordsDone(s.words_done ?? null);
    setWordsTotal(s.words_total ?? null);
    setTtsChunkIndex(s.tts_chunk_index ?? null);
    setTtsChunksOnPage(s.tts_chunks_on_page ?? null);
    if (s.status === "complete" || s.status === "failed") {
      setGenBusy(false);
    }
  }, []);

  const polling =
    genBusy &&
    status &&
    status !== "complete" &&
    status !== "failed" &&
    Boolean(jobId);

  useEffect(() => {
    if (!jobId || !polling) return;

    let cancelled = false;
    let es: EventSource | null = null;

    const poll = async () => {
      try {
        const s = await fetchStatus(jobId);
        if (cancelled) return;
        applyStatus(s);
      } catch {
        if (!cancelled) setToast("Lost connection to the studio. Try again.");
      }
    };

    void (async () => {
      const features = await fetchFeatures();
      if (cancelled || !features.job_sse_enabled) return;
      try {
        es = new EventSource(statusStreamUrl(jobId));
        es.onmessage = (ev) => {
          try {
            const s = JSON.parse(ev.data) as StatusPayload;
            applyStatus(s);
          } catch {
            /* ignore malformed */
          }
        };
      } catch {
        /* EventSource unsupported — polling only */
      }
    })();

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
      es?.close();
    };
  }, [jobId, polling, applyStatus]);

  const onDownload = useCallback(async () => {
    if (!jobId || !apiOk) return;
    try {
      const { blob } = await downloadMp3Blob(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = audiobookDownloadName(fileName, voiceLabelForDownload);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Download failed — the file may have expired.");
    }
  }, [apiOk, jobId, fileName, voiceLabelForDownload]);

  const downloadVisible = status === "complete";
  const mp3ListenSrc =
    downloadVisible && jobId && apiOk ? downloadMp3Url(jobId) : null;

  const generateDisabled =
    !apiOk ||
    !jobId ||
    !selectedVoiceId ||
    uploadBusy ||
    genBusy ||
    Boolean(validatePages());

  return (
    <>
      <Hero />
      <main className="mx-auto md:max-w-[90%] space-y-8 px-6 py-14">
        {!apiOk && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-pretty text-xs leading-relaxed text-amber-950 sm:px-4 sm:py-3 sm:text-sm">
            Point{" "}
            <code className="break-all rounded bg-white/80 px-1 py-0.5 text-[0.7rem] sm:text-sm">
              NEXT_PUBLIC_BACKEND_URL
            </code>{" "}
            at your FastAPI server (same value you use as{" "}
            <code className="break-all rounded bg-white/80 px-1 py-0.5 text-[0.7rem] sm:text-sm">
              BACKEND_URL
            </code>{" "}
            in docs).
          </p>
        )}
        {toast && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-pretty text-xs leading-relaxed text-red-900 sm:px-4 sm:py-3 sm:text-sm">
            {toast}
          </p>
        )}

        <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2">
          <div ref={leftStackRef} className="min-w-0 space-y-8">
            <UploadZone
              fileName={fileName}
              pageCount={pageCount}
              busy={uploadBusy}
              onFile={onFile}
            />
            <PageSelector
              pageCount={pageCount}
              startPage={startPage}
              endPage={endPage}
              onStart={setStartPage}
              onEnd={setEndPage}
              disabled={uploadBusy || genBusy}
              error={pageError}
            />
          </div>
          <div className="min-w-0 space-y-8 lg:min-h-0">
            <VoicePreview
              selectedVoiceId={selectedVoiceId}
              onSelectVoice={setSelectedVoiceId}
              fixedHeightPx={voiceSectionHeightPx}
              playingVoiceId={playingVoiceId}
              setPlayingVoiceId={setPlayingVoiceId}
            />
            <GenerateSection
              active={genBusy}
              status={status}
              message={message}
              progressPercent={progressPercent}
              etaSeconds={etaSeconds}
              documentPageCount={pageCount}
              progressPhase={progressPhase}
              currentPage={currentPage}
              pagesInJob={pagesInJob}
              pagesDone={pagesDone}
              wordsDone={wordsDone}
              wordsTotal={wordsTotal}
              ttsChunkIndex={ttsChunkIndex}
              ttsChunksOnPage={ttsChunksOnPage}
              onGenerate={onGenerate}
              disabled={generateDisabled}
            />
            <DownloadSection
              visible={downloadVisible}
              sizeBytes={mp3Size}
              onDownload={onDownload}
              busy={false}
              mp3Src={mp3ListenSrc}
              playingVoiceId={playingVoiceId}
              setPlayingVoiceId={setPlayingVoiceId}
            />
            {status === "failed" && (
              <p className="text-pretty text-xs leading-relaxed text-red-800 sm:text-sm">
                {message}
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
