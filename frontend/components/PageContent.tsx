"use client";

import { DownloadSection } from "@/components/DownloadSection";
import { AudiobookBookPanel } from "@/components/AudiobookBookPanel";
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
  requestCancelJob,
  startConvert,
  statusStreamUrl,
  uploadPdf,
  type JobStatus,
  type StatusPayload,
  type VoiceItem,
} from "@/lib/api";
import { audiobookDownloadName } from "@/lib/audiobookFilename";
import {
  clearAllJobPersistence,
  clearAllJobPersistenceAndPreviewTimeline,
  patchLastJob,
  readLastJob,
  writeLastJob,
} from "@/lib/lastJobStorage";
import {
  clearLastStatusSnapshot,
  readLastStatusSnapshot,
  writeLastStatusSnapshot,
} from "@/lib/lastStatusSnapshot";
import { useAppNotifications } from "@/components/AppProviders";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

function subscribeMdUp(callback: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getMdUpSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}
function getMdUpServerSnapshot() {
  return false;
}
function useMdUp() {
  return useSyncExternalStore(subscribeMdUp, getMdUpSnapshot, getMdUpServerSnapshot);
}

export function PageContent() {
  const apiOk = useMemo(() => Boolean(getApiBase()), []);
  const { success: notifySuccess, error: notifyError } = useAppNotifications();

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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    "en_GB-cori-medium",
  );
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audiobookAudioEl, setAudiobookAudioEl] = useState<HTMLAudioElement | null>(
    null,
  );
  const [audiobookTimeMs, setAudiobookTimeMs] = useState(0);
  const [voicesForLabels, setVoicesForLabels] = useState<VoiceItem[]>([]);
  const [partialWavBytes, setPartialWavBytes] = useState<number | null>(null);
  const [ttsAppendWav, setTtsAppendWav] = useState(true);
  const [savedVoiceLabel, setSavedVoiceLabel] = useState<string | null>(null);

  const mdUp = useMdUp();

  const cancelHydrateRef = useRef(false);
  const didHydrateRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const persistExpiresAtRef = useRef<number | null>(null);

  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);

  useEffect(() => {
    if (!audiobookAudioEl) {
      setAudiobookTimeMs(0);
      return;
    }
    let raf = 0;
    const loop = () => {
      setAudiobookTimeMs(audiobookAudioEl.currentTime * 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audiobookAudioEl]);

  useEffect(() => {
    if (!apiOk) return;
    fetchFeatures()
      .then((f) => {
        setTtsAppendWav(f.tts_append_wav_to_output);
      })
      .catch(() => {
        setTtsAppendWav(true);
      });
  }, [apiOk]);

  useEffect(() => {
    if (!apiOk) return;
    fetchVoices()
      .then(setVoicesForLabels)
      .catch(() => {
        /* VoicePreview shows voice load errors; download name falls back to voice_id */
      });
  }, [apiOk]);

  const voiceLabelForDownload = useMemo(() => {
    if (!selectedVoiceId) return savedVoiceLabel ?? "voice";
    const v = voicesForLabels.find((x) => x.voice_id === selectedVoiceId);
    return v?.label ?? savedVoiceLabel ?? selectedVoiceId;
  }, [voicesForLabels, selectedVoiceId, savedVoiceLabel]);

  const onFile = useCallback(async (file: File) => {
    if (!apiOk) {
      notifyError("Set NEXT_PUBLIC_BACKEND_URL (your FastAPI URL).");
      return;
    }
    cancelHydrateRef.current = true;
    clearAllJobPersistenceAndPreviewTimeline();
    setSavedVoiceLabel(null);
    setUploadBusy(true);
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
      setPartialWavBytes(null);
      notifySuccess("PDF uploaded. Choose pages and generate when you’re ready.");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [apiOk, notifyError, notifySuccess]);

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
    try {
      const { job_ttl_seconds } = await startConvert(
        jobId,
        selectedVoiceId,
        startPage,
        endPage,
      );
      const label =
        voicesForLabels.find((x) => x.voice_id === selectedVoiceId)?.label ??
        selectedVoiceId;
      setSavedVoiceLabel(label);
      writeLastJob({
        v: 2,
        jobId,
        expiresAt: Date.now() + job_ttl_seconds * 1000,
        filename: fileName,
        pageCount,
        voiceId: selectedVoiceId,
        voiceLabel: label,
        hasPdf: true,
      });
      persistExpiresAtRef.current = Date.now() + job_ttl_seconds * 1000;
      setStatus("extracting");
      setMessage("Starting…");
      setPartialWavBytes(null);
      notifySuccess("Generation started.");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not start");
      setGenBusy(false);
    }
  }, [
    apiOk,
    jobId,
    selectedVoiceId,
    startPage,
    endPage,
    validatePages,
    fileName,
    pageCount,
    voicesForLabels,
    notifyError,
    notifySuccess,
  ]);

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
    setPartialWavBytes(s.partial_wav_bytes ?? null);

    if (s.status === "complete") {
      clearLastStatusSnapshot();
    } else if (s.status === "failed" || s.status === "cancelled") {
      clearAllJobPersistenceAndPreviewTimeline();
      setSavedVoiceLabel(null);
    }

    const jid = jobIdRef.current;
    if (
      jid &&
      (s.status === "extracting" ||
        s.status === "processing" ||
        s.status === "pending")
    ) {
      const exp = persistExpiresAtRef.current ?? readLastJob()?.expiresAt ?? 0;
      if (exp > Date.now()) {
        writeLastStatusSnapshot({
          v: 1,
          jobId: jid,
          expiresAt: exp,
          payload: s,
        });
      }
    }

    if (s.status === "complete" || s.status === "failed" || s.status === "cancelled") {
      setGenBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!apiOk || didHydrateRef.current) return;
    const data = readLastJob();
    if (!data || data.expiresAt <= Date.now()) {
      if (data && data.expiresAt <= Date.now()) {
        clearAllJobPersistenceAndPreviewTimeline();
      }
      didHydrateRef.current = true;
      return;
    }
    didHydrateRef.current = true;
    void (async () => {
      try {
        jobIdRef.current = data.jobId;
        persistExpiresAtRef.current = data.expiresAt;
        const snap = readLastStatusSnapshot();
        if (
          snap &&
          snap.jobId === data.jobId &&
          snap.expiresAt > Date.now() &&
          (snap.payload.status === "extracting" ||
            snap.payload.status === "processing" ||
            snap.payload.status === "pending")
        ) {
          applyStatus(snap.payload);
        }
        const st = await fetchStatus(data.jobId);
        if (cancelHydrateRef.current) return;
        if (st.status === "failed") {
          clearAllJobPersistenceAndPreviewTimeline();
          return;
        }
        if (st.status === "cancelled") {
          clearAllJobPersistenceAndPreviewTimeline();
          setJobId(null);
          setFileName(null);
          setPageCount(null);
          setSavedVoiceLabel(null);
          setStatus("cancelled");
          setMessage(st.message || "Cancelled.");
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
          setPartialWavBytes(null);
          setGenBusy(false);
          return;
        }
        setJobId(data.jobId);
        setSavedVoiceLabel(data.voiceLabel);
        if (data.hasPdf && data.filename) {
          setFileName(data.filename);
          if (data.pageCount != null) setPageCount(data.pageCount);
        } else {
          setFileName(null);
          setPageCount(null);
        }
        setSelectedVoiceId(data.voiceId);
        applyStatus(st);
        if (st.status === "extracting" || st.status === "processing") {
          setGenBusy(true);
        }
      } catch {
        if (!cancelHydrateRef.current) clearAllJobPersistence();
      }
    })();
  }, [apiOk, applyStatus]);

  useEffect(() => {
    if (status !== "complete" || !jobId || !selectedVoiceId) return;
    patchLastJob({
      voiceLabel: voiceLabelForDownload,
      voiceId: selectedVoiceId,
    });
  }, [status, jobId, selectedVoiceId, voiceLabelForDownload]);

  const polling =
    genBusy &&
    status &&
    status !== "complete" &&
    status !== "failed" &&
    status !== "cancelled" &&
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
        if (!cancelled) notifyError("Lost connection to the studio. Try again.");
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
  }, [jobId, polling, applyStatus, notifyError]);

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
      notifySuccess("Download started — check your downloads folder.");
    } catch {
      notifyError("Download failed — the file may have expired.");
    }
  }, [apiOk, jobId, fileName, voiceLabelForDownload, notifyError, notifySuccess]);

  const onCancelJob = useCallback(async () => {
    if (!jobId || !apiOk) return;
    if (
      status !== "extracting" &&
      status !== "processing" &&
      status !== "pending"
    ) {
      return;
    }
    try {
      await requestCancelJob(jobId);
      clearAllJobPersistenceAndPreviewTimeline();
      setSavedVoiceLabel(null);
      setPartialWavBytes(null);
      try {
        const st = await fetchStatus(jobId);
        applyStatus(st);
      } catch {
        setStatus("cancelled");
        setMessage("Cancelled.");
        setGenBusy(false);
      }
    } catch {
      notifyError("Could not cancel.");
    }
  }, [jobId, apiOk, status, applyStatus, notifyError]);

  const canRemovePdf =
    Boolean(fileName) &&
    !uploadBusy &&
    !genBusy &&
    (status === "complete" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "pending");

  const onRemovePdf = useCallback(() => {
    if (!canRemovePdf) return;
    if (status === "complete" && jobId) {
      setFileName(null);
      setPageCount(null);
      setPageError(null);
      patchLastJob({ hasPdf: false, filename: null, pageCount: null });
      return;
    }
    clearAllJobPersistenceAndPreviewTimeline();
    setSavedVoiceLabel(null);
    setJobId(null);
    setFileName(null);
    setPageCount(null);
    setPageError(null);
    setStatus(null);
    setMessage("");
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
    setPartialWavBytes(null);
    setGenBusy(false);
  }, [canRemovePdf, status, jobId]);

  const downloadComplete = status === "complete";
  const finalMp3Src =
    downloadComplete && jobId && apiOk ? downloadMp3Url(jobId) : null;

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
        <div className="flex min-w-0 flex-col gap-8 md:grid md:grid-cols-2 md:items-start md:gap-8">
          <div
            className={`order-1 relative flex w-full min-w-0 flex-col gap-8 md:col-start-1 md:row-start-1 md:self-start ${
              jobId && mdUp ? "md:pb-[min(32rem,58vh)]" : ""
            }`}
          >
            <UploadZone
              fileName={fileName}
              pageCount={pageCount}
              busy={uploadBusy}
              onFile={onFile}
              onRemovePdf={onRemovePdf}
              removePdfDisabled={!canRemovePdf}
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
            {jobId && mdUp ? (
              <div className="pointer-events-auto absolute left-0 right-0 top-[55%] z-10 mt-8 min-w-0">
                <AudiobookBookPanel
                  jobId={jobId}
                  isComplete={downloadComplete}
                  hasPdfContext={Boolean(jobId)}
                  audioTimeMs={audiobookTimeMs}
                  apiOk={apiOk}
                />
              </div>
            ) : null}
          </div>
          <div className="order-2 flex min-w-0 flex-col gap-8 md:col-start-2 md:row-start-1 md:min-h-0">
            <VoicePreview
              selectedVoiceId={selectedVoiceId}
              onSelectVoice={setSelectedVoiceId}
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
              jobStartPage={startPage}
              progressPhase={progressPhase}
              currentPage={currentPage}
              pagesInJob={pagesInJob}
              pagesDone={pagesDone}
              wordsDone={wordsDone}
              wordsTotal={wordsTotal}
              ttsChunkIndex={ttsChunkIndex}
              ttsChunksOnPage={ttsChunksOnPage}
              onGenerate={onGenerate}
              onCancelJob={onCancelJob}
              disabled={generateDisabled}
            />
            <DownloadSection
              complete={downloadComplete}
              generating={genBusy}
              livePreviewSupported={ttsAppendWav}
              jobId={jobId}
              partialWavBytes={partialWavBytes}
              sizeBytes={mp3Size}
              onDownload={onDownload}
              busy={false}
              finalMp3Src={finalMp3Src}
              playingVoiceId={playingVoiceId}
              setPlayingVoiceId={setPlayingVoiceId}
              onAudiobookAudioElement={setAudiobookAudioEl}
            />
            {status === "failed" && (
              <p className="text-pretty text-xs leading-relaxed text-red-800 sm:text-sm">
                {message}
              </p>
            )}
            {status === "cancelled" && (
              <p className="text-pretty text-xs leading-relaxed text-muted sm:text-sm">
                {message || "This run was cancelled."}
              </p>
            )}
          </div>
          {jobId && !mdUp ? (
            <div className="order-3 min-w-0">
              <AudiobookBookPanel
                jobId={jobId}
                isComplete={downloadComplete}
                hasPdfContext={Boolean(jobId)}
                audioTimeMs={audiobookTimeMs}
                apiOk={apiOk}
              />
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
