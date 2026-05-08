"use client";

import type { JobStatus } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  active: boolean;
  status: JobStatus | null;
  message: string;
  progressPercent: number | null;
  etaSeconds: number | null;
  onGenerate: () => void;
  disabled: boolean;
};

function formatEta(s: number) {
  if (s < 60) return `~${s}s`;
  const m = Math.max(1, Math.round(s / 60));
  return `~${m} min`;
}

export function GenerateSection({
  active,
  status,
  message,
  progressPercent,
  etaSeconds,
  onGenerate,
  disabled,
}: Props) {
  const showProgress =
    active &&
    status &&
    (status === "extracting" || status === "processing" || status === "pending");

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
          <p className="text-[11px] text-muted sm:text-xs">
            {status === "extracting" && "Extracting text from your PDF…"}
            {status === "processing" && "Generating audio with Piper…"}
            {status === "pending" && "Queued — starting shortly…"}
          </p>
        </div>
      )}
    </section>
  );
}
