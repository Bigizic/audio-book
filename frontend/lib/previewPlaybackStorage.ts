const KEY = "audiobook:previewPlayback";
const SESSION_META_KEY = "audiobook:previewSessionBinding";

type SessionBinding = { fingerprint: string; previewId: string };

export type PreviewPlaybackStored = {
  v: 1;
  previewId: string;
  currentTime: number;
  duration: number;
  /** Last playback speed from the range control (clamped to player min/max when applied). */
  playbackRate: number;
};

function parse(raw: unknown): PreviewPlaybackStored | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const previewId = typeof o.previewId === "string" ? o.previewId : null;
  const currentTime = typeof o.currentTime === "number" ? o.currentTime : null;
  const duration = typeof o.duration === "number" ? o.duration : null;
  if (!previewId || currentTime == null || duration == null) return null;
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) return null;
  const playbackRateRaw = o.playbackRate;
  const playbackRate =
    typeof playbackRateRaw === "number" &&
    Number.isFinite(playbackRateRaw) &&
    playbackRateRaw > 0
      ? playbackRateRaw
      : 1;
  return { v: 1, previewId, currentTime, duration, playbackRate };
}

export function readPreviewPlayback(): PreviewPlaybackStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return parse(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}

export function writePreviewPlayback(data: PreviewPlaybackStored): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearPreviewPlayback(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Stable fingerprint → same random UUID after refresh until fingerprint changes. */
export function getOrCreatePreviewSessionId(fingerprint: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SESSION_META_KEY);
    const b: SessionBinding | null = raw ? JSON.parse(raw) : null;
    if (
      b &&
      typeof b.fingerprint === "string" &&
      typeof b.previewId === "string" &&
      b.fingerprint === fingerprint
    ) {
      return b.previewId;
    }
  } catch {
    window.localStorage.removeItem(SESSION_META_KEY);
  }
  const previewId = crypto.randomUUID();
  try {
    window.localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({ fingerprint, previewId } satisfies SessionBinding),
    );
  } catch {
    /* ignore */
  }
  return previewId;
}

export function clearPreviewSessionBinding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_META_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop stored timeline if it does not belong to this preview session. */
export function ensurePreviewPlaybackMatches(previewId: string | null): void {
  if (!previewId) return;
  const s = readPreviewPlayback();
  if (s && s.previewId !== previewId) {
    clearPreviewPlayback();
  }
}
