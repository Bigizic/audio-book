export type AudiobookWordSpan = {
  t0: number;
  t1: number;
  page: number;
  idx: number;
  word: string;
};

export type AudiobookAlignmentManifest = {
  version: 1;
  job_id: string;
  duration_ms: number;
  spans: AudiobookWordSpan[];
  pages: Record<string, { words: string[] }>;
};

export function findActiveSpanIndex(spans: AudiobookWordSpan[], tMs: number): number {
  if (spans.length === 0) return 0;
  if (tMs <= spans[0].t0) return 0;
  const last = spans[spans.length - 1]!;
  if (tMs >= last.t1) return spans.length - 1;
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = spans[mid]!;
    if (tMs < s.t0) hi = mid - 1;
    else if (tMs >= s.t1) lo = mid + 1;
    else return mid;
  }
  return Math.max(0, Math.min(spans.length - 1, lo));
}
