"use client";

import type { JobStatus } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  active: boolean;
  status: JobStatus | null;
  message: string;
  progressPercent: number | null;
  etaSeconds: number | null;
  documentPageCount: number | null;
  progressPhase: string | null;
  currentPage: number | null;
  pagesInJob: number | null;
  pagesDone: number | null;
  wordsDone: number | null;
  wordsTotal: number | null;
  ttsChunkIndex: number | null;
  ttsChunksOnPage: number | null;
  onGenerate: () => void;
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

export function GenerateSection({
  active,
  status,
  message,
  progressPercent,
  etaSeconds,
  documentPageCount,
  progressPhase,
  currentPage,
  pagesInJob,
  pagesDone,
  wordsDone,
  wordsTotal,
  ttsChunkIndex,
  ttsChunksOnPage,
  onGenerate,
  disabled,
}: Props) {
  const showProgress =
    active &&
    status &&
    (status === "extracting" || status === "processing" || status === "pending");

  const pageLabel =
    currentPage != null && documentPageCount != null
      ? `Page ${currentPage.toLocaleString()} / ${documentPageCount.toLocaleString()}`
      : currentPage != null && pagesInJob != null
        ? `Page ${currentPage.toLocaleString()} (${pagesInJob.toLocaleString()} in this run)`
        : null;

  const selectionProgress =
    pagesInJob != null && pagesDone != null
      ? `${pagesDone.toLocaleString()} / ${pagesInJob.toLocaleString()} pages done in this audiobook`
      : null;

  const wordsLabel =
    wordsTotal != null && wordsTotal > 0
      ? `${formatCount(wordsDone)} / ${formatCount(wordsTotal)} words`
      : wordsDone != null && wordsDone > 0
        ? `${formatCount(wordsDone)} words read`
        : null;

  const partLabel =
    ttsChunkIndex != null &&
    ttsChunksOnPage != null &&
    ttsChunksOnPage > 1
      ? `Part ${ttsChunkIndex} / ${ttsChunksOnPage} on this page`
      : null;

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
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-sage transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(8, progressPercent ?? 12))}%`,
              }}
            />
          </div>
          <div className="space-y-1 text-[11px] text-muted sm:text-xs">
            {progressPhase && (
              <p className="font-medium capitalize text-ink/80">
                {progressPhase === "reading" && "Reading PDF"}
                {progressPhase === "synthesizing" && "Text-to-speech"}
                {progressPhase === "encoding" && "Encoding"}
                {!["reading", "synthesizing", "encoding"].includes(progressPhase) &&
                  progressPhase}
              </p>
            )}
            {pageLabel && <p>{pageLabel}</p>}
            {selectionProgress && <p>{selectionProgress}</p>}
            {wordsLabel && <p>{wordsLabel}</p>}
            {partLabel && <p>{partLabel}</p>}
            {status === "pending" && <p>Queued — starting shortly…</p>}
          </div>
        </div>
      )}
    </section>
  );
}
