/** Safe path segment for filenames (no slashes, etc.). */
export function sanitizeForFilename(segment: string): string {
  const trimmed = segment
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s*·\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
  return trimmed || "";
}

/** `{book}_{voice}.mp3` from upload basename (no extension) and narrator label. */
export function audiobookDownloadName(
  uploadedFilename: string | null,
  voiceLabel: string,
): string {
  const raw = uploadedFilename ?? "audiobook";
  const withoutExt = raw.replace(/\.[^/.]+$/, "");
  const book = sanitizeForFilename(withoutExt) || "audiobook";
  const voice = sanitizeForFilename(voiceLabel) || "voice";
  return `${book}_${voice}.mp3`;
}
