"use client";

import type { JobStatus } from "@/lib/api";
import { Loader2, Sparkles, XCircle } from "lucide-react";

type Props = {
  active: boolean;
  status: JobStatus | null;
  message: string;
  progressPercent: number | null;
  etaSeconds: number | null;
  documentPageCount: number | null;
  /** First page included in this audiobook (for “page N of M” in run). */
  jobStartPage: number | null;
  progressPhase: string | null;
  currentPage: number | null;
  pagesInJob: number | null;
  pagesDone: number | null;
  wordsDone: number | null;
  wordsTotal: number | null;
  ttsChunkIndex: number | null;
  ttsChunksOnPage: number | null;
  onGenerate: () => void;
  onCancelJob?: () => void;
  disabled: boolean;
};

function formatEta(s: number) {
  if (s < 60) return `~${s}s`;
  const m = Math.max(1, Math.round(s / 60));
  return `~${m} min`;
}

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

/** 0–1 progress through TTS chunks on the current page (backend updates per chunk). */
function chunkSubProgress(
  progressPhase: string | null,
  ttsChunkIndex: number | null,
  ttsChunksOnPage: number | null,
): number {
  if (
    progressPhase !== "synthesizing" ||
    ttsChunksOnPage == null ||
    ttsChunksOnPage <= 0 ||
    ttsChunkIndex == null
  ) {
    return 0;
  }
  return Math.min(1, Math.max(0, ttsChunkIndex / ttsChunksOnPage));
}

/** Progress through the full PDF (page + chunk slice), so the bar moves during long TTS. */
function documentProgressFraction(
  currentPage: number | null,
  documentPageCount: number | null,
  progressPhase: string | null,
  ttsChunkIndex: number | null,
  ttsChunksOnPage: number | null,
): number | null {
  if (
    documentPageCount == null ||
    documentPageCount <= 0 ||
    currentPage == null ||
    !Number.isFinite(currentPage)
  ) {
    return null;
  }
  const sub = chunkSubProgress(
    progressPhase,
    ttsChunkIndex,
    ttsChunksOnPage,
  );
  return Math.min(
    1,
    Math.max(0, (currentPage - 1 + sub) / documentPageCount),
  );
}

/** Progress through pages selected for this job (increments smoothly across chunks). */
function runProgressFraction(
  pagesDone: number | null,
  pagesInJob: number | null,
  progressPhase: string | null,
  ttsChunkIndex: number | null,
  ttsChunksOnPage: number | null,
): number | null {
  if (pagesInJob == null || pagesInJob <= 0) return null;
  const done = pagesDone ?? 0;
  const sub = chunkSubProgress(
    progressPhase,
    ttsChunkIndex,
    ttsChunksOnPage,
  );
  return Math.min(1, Math.max(0, (done + sub) / pagesInJob));
}

function HorizontalPageTrack({
  label,
  fraction,
  caption,
}: {
  label: string;
  fraction: number | null;
  caption: string | null;
}) {
  const determinate = fraction != null;
  const widthPct = determinate ? Math.round(fraction * 1000) / 10 : 0;

  return (
    <div className="flex min-w-0 w-full flex-col gap-1.5">
      <p className="text-[11px] font-medium leading-tight text-ink/75 sm:text-xs">
        {label}
      </p>
      <div
        className="audiobook-page-progress-track w-full"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? Math.round(widthPct) : undefined}
        aria-valuetext={
          determinate
            ? caption
              ? `${caption} (${Math.round(widthPct)}%)`
              : `${Math.round(widthPct)} percent`
            : "In progress"
        }
      >
        {determinate ? (
          <div
            className="audiobook-page-progress-fill transition-[width] duration-300 ease-out"
            style={{ width: `${widthPct}%` }}
          />
        ) : (
          <div className="audiobook-page-progress-indeterminate-bar" />
        )}
      </div>
      {caption ? (
        <p className="font-mono text-[11px] tabular-nums text-muted sm:text-xs">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function GenerateSection({
  active,
  status,
  message,
  progressPercent,
  etaSeconds,
  documentPageCount,
  jobStartPage,
  progressPhase,
  currentPage,
  pagesInJob,
  pagesDone,
  wordsDone,
  wordsTotal,
  ttsChunkIndex,
  ttsChunksOnPage,
  onGenerate,
  onCancelJob,
  disabled,
}: Props) {
  const showProgress =
    active &&
    status &&
    (status === "extracting" || status === "processing" || status === "pending");

  const isEncoding = progressPhase === "encoding";

  const docPageFractionRaw = documentProgressFraction(
    currentPage,
    documentPageCount,
    progressPhase,
    ttsChunkIndex,
    ttsChunksOnPage,
  );
  const runPagesFractionRaw = runProgressFraction(
    pagesDone,
    pagesInJob,
    progressPhase,
    ttsChunkIndex,
    ttsChunksOnPage,
  );

  const docPageFraction =
    isEncoding && documentPageCount != null && documentPageCount > 0
      ? 1
      : docPageFractionRaw;
  const runPagesFraction =
    isEncoding && pagesInJob != null && pagesInJob > 0 ? 1 : runPagesFractionRaw;

  const documentCaption =
    currentPage != null &&
    documentPageCount != null &&
    documentPageCount > 0
      ? `${currentPage} / ${documentPageCount}`
      : null;

  const runCaption =
    pagesInJob != null &&
    pagesInJob > 0 &&
    currentPage != null &&
    jobStartPage != null
      ? `${currentPage - jobStartPage + 1} / ${pagesInJob}`
      : pagesInJob != null && pagesInJob > 0
        ? `${pagesDone ?? 0} / ${pagesInJob}`
        : null;

  const wordsRatioCaption =
    wordsTotal != null && wordsTotal > 0
      ? `${formatCount(wordsDone ?? 0)} / ${formatCount(wordsTotal)}`
      : wordsDone != null && wordsDone >= 0
        ? `${formatCount(wordsDone)} / …`
        : null;

  const wordsFraction =
    wordsTotal != null &&
    wordsTotal > 0 &&
    Number.isFinite(wordsDone ?? 0)
      ? Math.min(1, Math.max(0, (wordsDone ?? 0) / wordsTotal))
      : null;

  const partLabel =
    ttsChunkIndex != null &&
    ttsChunksOnPage != null &&
    ttsChunksOnPage > 1
      ? `Part ${ttsChunkIndex} / ${ttsChunksOnPage} on this page`
      : null;

  const overallPct =
    progressPercent != null
      ? Math.min(100, Math.max(0, progressPercent))
      : status === "pending"
        ? 0
        : 0;

  return (
    <section className="rounded-2xl border border-line bg-white/70 p-4 shadow-card backdrop-blur-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-ink sm:mb-4">
        <Sparkles className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
        <h2 className="font-serif text-lg sm:text-xl">Make the audiobook</h2>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-medium text-white shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
      >
        {showProgress ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Working…
          </>
        ) : (
          "Generate audiobook"
        )}
      </button>

      {showProgress && (
        <div className="mt-5 space-y-3 sm:mt-6">
          <div className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:text-sm">
            <span className="flex min-w-0 items-start gap-2 text-ink">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />
              <span className="min-w-0 break-words">{message || "Working…"}</span>
            </span>
            {etaSeconds != null && etaSeconds > 0 && (
              <span className="shrink-0 sm:text-right">{formatEta(etaSeconds)} left</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-sage transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="space-y-3 text-[11px] text-muted sm:text-xs">
            {progressPhase && (
              <p className="font-medium capitalize text-ink/80">
                {progressPhase === "reading" && "Reading PDF"}
                {progressPhase === "synthesizing" && "Text-to-speech"}
                {progressPhase === "encoding" && "Encoding"}
                {!["reading", "synthesizing", "encoding"].includes(progressPhase) &&
                  progressPhase}
              </p>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between sm:gap-4">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <HorizontalPageTrack
                  label="Place in document"
                  fraction={docPageFraction}
                  caption={documentCaption}
                />
                <HorizontalPageTrack
                  label="Pages in this audiobook"
                  fraction={runPagesFraction}
                  caption={runCaption}
                />
              </div>
              {onCancelJob && active ? (
                <button
                  type="button"
                  onClick={onCancelJob}
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink/70 shadow-card transition hover:border-red-200 hover:bg-red-50/80 hover:text-red-900 sm:self-start sm:py-2.5 sm:text-sm"
                  aria-label="Cancel generation"
                >
                  <XCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Cancel
                </button>
              ) : null}
            </div>

            {wordsRatioCaption ? (
              <div className="space-y-1.5 border-t border-line/70 pt-3">
                <p className="text-[11px] font-medium text-ink/75 sm:text-xs">
                  Words in audiobook
                </p>
                <div
                  className="audiobook-page-progress-track w-full max-w-md"
                  role="progressbar"
                  aria-label="Words progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    wordsFraction != null
                      ? Math.round(wordsFraction * 100)
                      : undefined
                  }
                  aria-valuetext={wordsRatioCaption}
                >
                  {wordsFraction != null ? (
                    <div
                      className="audiobook-page-progress-fill transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.round(wordsFraction * 1000) / 10}%` }}
                    />
                  ) : (
                    <div className="audiobook-page-progress-indeterminate-bar" />
                  )}
                </div>
                <p className="font-mono text-[11px] tabular-nums text-muted sm:text-xs">
                  {wordsRatioCaption}
                </p>
              </div>
            ) : null}

            {partLabel && <p className="text-muted">{partLabel}</p>}
            {status === "pending" && <p>Queued — starting shortly…</p>}
          </div>
        </div>
      )}
    </section>
  );
}
