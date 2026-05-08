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
  fetchStatus,
  getApiBase,
  startConvert,
  uploadPdf,
  type JobStatus,
} from "@/lib/api";
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
  const [toast, setToast] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    "en_US-lessac-medium",
  );

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

  const polling =
    genBusy &&
    status &&
    status !== "complete" &&
    status !== "failed" &&
    Boolean(jobId);

  useEffect(() => {
    if (!jobId || !polling) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const s = await fetchStatus(jobId);
        if (cancelled) return;
        setStatus(s.status);
        setMessage(s.message);
        setProgressPercent(s.progress_percent ?? null);
        setEtaSeconds(s.eta_seconds ?? null);
        if (s.mp3_size_bytes != null) setMp3Size(s.mp3_size_bytes);
        if (s.status === "complete" || s.status === "failed") {
          setGenBusy(false);
        }
      } catch {
        if (!cancelled) setToast("Lost connection to the studio. Try again.");
      }
    };

    tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, polling]);

  const onDownload = useCallback(async () => {
    if (!jobId || !apiOk) return;
    try {
      const { blob, filename } = await downloadMp3Blob(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Download failed — the file may have expired.");
    }
  }, [apiOk, jobId]);

  const downloadVisible = status === "complete";
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
            />
            <GenerateSection
              active={genBusy}
              status={status}
              message={message}
              progressPercent={progressPercent}
              etaSeconds={etaSeconds}
              onGenerate={onGenerate}
              disabled={generateDisabled}
            />
            <DownloadSection
              visible={downloadVisible}
              sizeBytes={mp3Size}
              onDownload={onDownload}
              busy={false}
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
