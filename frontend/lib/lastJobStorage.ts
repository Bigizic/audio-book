import { clearLastStatusSnapshot } from "@/lib/lastStatusSnapshot";
import {
  clearPreviewPlayback,
  clearPreviewSessionBinding,
} from "@/lib/previewPlaybackStorage";

const KEY = "audiobook:lastJob";

export type LastJobPersisted = {
  v: 2;
  jobId: string;
  /** Unix ms — aligned with server job TTL from convert response */
  expiresAt: number;
  filename: string | null;
  pageCount: number | null;
  voiceId: string;
  voiceLabel: string;
  hasPdf: boolean;
};

function normalize(raw: unknown): LastJobPersisted | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 2 && o.v !== 1) return null;
  const jobId = typeof o.jobId === "string" ? o.jobId : null;
  const expiresAt = typeof o.expiresAt === "number" ? o.expiresAt : null;
  if (!jobId || expiresAt == null) return null;
  const hasPdf =
    typeof o.hasPdf === "boolean"
      ? o.hasPdf
      : true;
  return {
    v: 2,
    jobId,
    expiresAt,
    filename: typeof o.filename === "string" ? o.filename : null,
    pageCount: typeof o.pageCount === "number" ? o.pageCount : null,
    voiceId: typeof o.voiceId === "string" ? o.voiceId : "voice",
    voiceLabel: typeof o.voiceLabel === "string" ? o.voiceLabel : "voice",
    hasPdf,
  };
}

export function readLastJob(): LastJobPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}

export function writeLastJob(data: LastJobPersisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function patchLastJob(partial: Partial<LastJobPersisted>): void {
  const cur = readLastJob();
  if (!cur) return;
  writeLastJob({ ...cur, ...partial, v: 2 });
}

export function clearLastJob(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Last job + status snapshot only (keeps `audiobook:previewPlayback` for refresh / retry). */
export function clearAllJobPersistence(): void {
  clearLastJob();
  clearLastStatusSnapshot();
}

export function clearAudiobookPreviewTimeline(): void {
  clearPreviewPlayback();
  clearPreviewSessionBinding();
}

/** Full reset: job state + in-browser preview timeline (new book, job dead, etc.). */
export function clearAllJobPersistenceAndPreviewTimeline(): void {
  clearAllJobPersistence();
  clearAudiobookPreviewTimeline();
}
