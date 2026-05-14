import type { StatusPayload } from "@/lib/api";

const STATUS_KEY = "audiobook:lastStatusSnapshot";

export type LastStatusSnapshot = {
  v: 1;
  jobId: string;
  expiresAt: number;
  payload: StatusPayload;
};

export function readLastStatusSnapshot(): LastStatusSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as LastStatusSnapshot;
    if (o.v !== 1 || typeof o.jobId !== "string" || typeof o.expiresAt !== "number") {
      window.localStorage.removeItem(STATUS_KEY);
      return null;
    }
    if (!o.payload || typeof o.payload !== "object") {
      window.localStorage.removeItem(STATUS_KEY);
      return null;
    }
    return o;
  } catch {
    window.localStorage.removeItem(STATUS_KEY);
    return null;
  }
}

export function writeLastStatusSnapshot(data: LastStatusSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearLastStatusSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STATUS_KEY);
  } catch {
    /* ignore */
  }
}
