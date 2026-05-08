"use client";

import { BookMarked } from "lucide-react";

type Props = {
  pageCount: number | null;
  startPage: number;
  endPage: number;
  onStart: (n: number) => void;
  onEnd: (n: number) => void;
  disabled: boolean;
  error: string | null;
};

export function PageSelector({
  pageCount,
  startPage,
  endPage,
  onStart,
  onEnd,
  disabled,
  error,
}: Props) {
  return (
    <section className="rounded-2xl border border-line bg-white/70 p-4 shadow-card backdrop-blur-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-ink sm:mb-4">
        <BookMarked className="h-5 w-5 shrink-0 text-sage" strokeWidth={1.75} />
        <h2 className="font-serif text-lg sm:text-xl">Pages to narrate</h2>
      </div>
      <p className="mb-4 text-pretty text-xs text-muted sm:text-sm">
        Choose a range (1{pageCount ? `–${pageCount}` : ""}). We only read what
        you select.
      </p>
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs sm:text-sm">
          <span className="text-muted">Start page</span>
          <input
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={startPage}
            disabled={disabled || !pageCount}
            onChange={(e) => onStart(Math.max(1, Number(e.target.value) || 1))}
            className="w-full max-w-[7.5rem] rounded-lg border border-line bg-paper px-3 py-2 text-base text-ink outline-none ring-accent/30 focus:ring-2 sm:w-28 sm:text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs sm:text-sm">
          <span className="text-muted">End page</span>
          <input
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={endPage}
            disabled={disabled || !pageCount}
            onChange={(e) =>
              onEnd(Math.max(1, Number(e.target.value) || 1))
            }
            className="w-full max-w-[7.5rem] rounded-lg border border-line bg-paper px-3 py-2 text-base text-ink outline-none ring-accent/30 focus:ring-2 sm:w-28 sm:text-sm"
          />
        </label>
      </div>
      {error && (
        <p className="mt-3 text-pretty text-xs text-red-700/90 sm:text-sm">{error}</p>
      )}
    </section>
  );
}
