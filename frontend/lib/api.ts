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
  | "failed";

export type StatusPayload = {
  status: JobStatus;
  message: string;
  progress_percent?: number | null;
  eta_seconds?: number | null;
  mp3_size_bytes?: number | null;
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

export async function fetchFeatures(): Promise<{ job_sse_enabled: boolean }> {
  const res = await fetch(`${API_BASE}/features`, { cache: "no-store" });
  if (!res.ok) return { job_sse_enabled: false };
  return res.json();
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
    const t = await res.text();
    throw new Error(t || "Upload failed");
  }
  return res.json();
}

export async function startConvert(
  jobId: string,
  voiceId: string,
  startPage: number,
  endPage: number,
): Promise<void> {
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
    const t = await res.text();
    throw new Error(t || "Could not start conversion");
  }
}

export async function fetchStatus(jobId: string): Promise<StatusPayload> {
  const res = await fetch(`${API_BASE}/status/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Status unavailable");
  return res.json();
}

export function statusStreamUrl(jobId: string): string {
  return `${API_BASE}/status/${jobId}/stream`;
}

export function downloadMp3Url(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}

export async function downloadMp3Blob(
  jobId: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(downloadMp3Url(jobId));
  if (!res.ok) throw new Error("Download failed");
  const cd = res.headers.get("Content-Disposition");
  let filename = "audiobook.mp3";
  if (cd?.includes("filename=")) {
    const m = cd.match(/filename="?([^";]+)"?/);
    if (m) filename = m[1];
  }
  const blob = await res.blob();
  return { blob, filename };
}
