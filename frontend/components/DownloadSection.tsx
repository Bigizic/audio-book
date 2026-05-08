"use client";

import { formatBytes } from "@/lib/format";
import { Clock, Download } from "lucide-react";

type Props = {
  visible: boolean;
  sizeBytes: number | null;
  onDownload: () => void;
  busy: boolean;
};

export function DownloadSection({ visible, sizeBytes, onDownload, busy }: Props) {
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
      <button
        type="button"
        onClick={onDownload}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-xs font-medium text-ink shadow-card transition hover:border-accent/40 disabled:opacity-50 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
      >
        <Download className="h-4 w-4" />
        Download MP3
      </button>
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
