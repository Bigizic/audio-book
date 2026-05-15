import type { AudiobookAlignmentManifest } from "@/lib/audiobookAlignment";
import { errorMessageFromResponse } from "@/lib/apiErrorText";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_BACKEND_URL === "string"
    ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")
    : "";

export function getApiBase(): string {
  return API_BASE;
}

export type JobStatus =
  | "pending"
  | "extracting"
  | "processing"
  | "complete"
  | "failed"
  | "cancelled";

export type StatusPayload = {
  status: JobStatus;
  message: string;
  progress_percent?: number | null;
  eta_seconds?: number | null;
  mp3_size_bytes?: number | null;
  partial_wav_bytes?: number | null;
  progress_phase?: string | null;
  current_page?: number | null;
  pages_in_job?: number | null;
  pages_done?: number | null;
  words_done?: number | null;
  words_total?: number | null;
  tts_chunk_index?: number | null;
  tts_chunks_on_page?: number | null;
};

export type VoiceItem = {
  voice_id: string;
  language_code: string;
  language_label: string;
  label: string;
  sample_url: string;
};

export async function fetchFeatures(): Promise<{
  job_sse_enabled: boolean;
  tts_append_wav_to_output: boolean;
  job_ttl_seconds: number;
}> {
  const res = await fetch(`${API_BASE}/features`, { cache: "no-store" });
  if (!res.ok)
    return { job_sse_enabled: false, tts_append_wav_to_output: true, job_ttl_seconds: 1800 };
  const j = (await res.json()) as {
    job_sse_enabled?: boolean;
    tts_append_wav_to_output?: boolean;
    job_ttl_seconds?: number;
  };
  return {
    job_sse_enabled: Boolean(j.job_sse_enabled),
    tts_append_wav_to_output: j.tts_append_wav_to_output !== false,
    job_ttl_seconds: typeof j.job_ttl_seconds === "number" ? j.job_ttl_seconds : 1800,
  };
}

export async function fetchVoices(): Promise<VoiceItem[]> {
  const res = await fetch(`${API_BASE}/voices`, { cache: "no-store" });
  if (!res.ok) throw new Error("Voices unavailable");
  return res.json();
}

/** sample_url from API is relative, e.g. /voices/.../sample */
export function voiceSampleFullUrl(sampleUrl: string): string {
  return `${API_BASE}${sampleUrl}`;
}

export async function uploadPdf(file: File): Promise<{
  job_id: string;
  page_count: number;
  filename: string;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(await errorMessageFromResponse(res));
  }
  return res.json();
}

export async function startConvert(
  jobId: string,
  voiceId: string,
  startPage: number,
  endPage: number,
): Promise<{ job_id: string; job_ttl_seconds: number }> {
  const res = await fetch(`${API_BASE}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      voice_id: voiceId,
      start_page: startPage,
      end_page: endPage,
    }),
  });
  if (!res.ok) {
    throw new Error(await errorMessageFromResponse(res));
  }
  return res.json() as Promise<{ job_id: string; job_ttl_seconds: number }>;
}

export async function fetchStatus(jobId: string): Promise<StatusPayload> {
  const res = await fetch(`${API_BASE}/status/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await errorMessageFromResponse(res));
  }
  return res.json();
}

export function statusStreamUrl(jobId: string): string {
  return `${API_BASE}/status/${jobId}/stream`;
}

/** Always resolves on 200; missing job is OK. */
export async function requestCancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await errorMessageFromResponse(res));
  }
}

export function downloadMp3Url(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}

/** Streams via the browser download manager (no full-file fetch into JS memory). */
export function triggerNativeMp3Download(jobId: string, suggestedFilename: string): void {
  const a = document.createElement("a");
  a.href = downloadMp3Url(jobId);
  a.download = suggestedFilename;
  a.rel = "noopener noreferrer";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function audiobookAlignmentUrl(jobId: string): string {
  return `${API_BASE}/audiobook-alignment/${jobId}`;
}

export async function fetchAudiobookAlignment(
  jobId: string,
): Promise<AudiobookAlignmentManifest> {
  const res = await fetch(audiobookAlignmentUrl(jobId), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await errorMessageFromResponse(res));
  }
  return res.json() as Promise<AudiobookAlignmentManifest>;
}

/** Cache-busting query matches server ``partial_wav_bytes`` so the browser refetches when the WAV grows. */
export function previewAudioUrl(jobId: string, byteLength: number): string {
  return `${API_BASE}/preview-audio/${jobId}?v=${byteLength}`;
}
