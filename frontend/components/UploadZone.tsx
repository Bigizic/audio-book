"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

type Props = {
  fileName: string | null;
  pageCount: number | null;
  busy: boolean;
  onFile: (file: File) => void;
  /** Clear uploaded PDF from UI (enabled when idle / job finished). */
  onRemovePdf?: () => void;
  removePdfDisabled?: boolean;
};

export function UploadZone({
  fileName,
  pageCount,
  busy,
  onFile,
  onRemovePdf,
  removePdfDisabled = true,
}: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const f = accepted[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: busy,
  });

  const showRemove = Boolean(fileName && onRemovePdf);

  return (
    <section className="rounded-2xl border border-line bg-surface/75 p-4 shadow-card backdrop-blur-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-ink sm:mb-4">
        <Upload className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
        <h2 className="font-serif text-lg sm:text-xl">Your book</h2>
      </div>
      <div
        {...getRootProps()}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-6 text-center transition-colors sm:min-h-[160px] sm:px-4 sm:py-8 ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-line hover:border-accent/40 hover:bg-paper"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        <FileText className="mb-2 h-9 w-9 text-muted sm:mb-3 sm:h-10 sm:w-10" strokeWidth={1.25} />
        <p className="max-w-[20rem] text-pretty font-medium text-ink text-sm sm:text-base">
          Drop a PDF here, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted sm:text-sm">One file at a time · we read it gently</p>
      </div>
      {fileName && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-paper px-3 py-2.5 shadow-inner sm:mt-4 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1 text-xs text-ink sm:text-sm">
            <p className="break-all font-medium sm:break-words">{fileName}</p>
            {pageCount != null && (
              <p className="mt-1 text-muted">{pageCount} pages detected</p>
            )}
          </div>
          {showRemove ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePdf?.();
              }}
              disabled={removePdfDisabled}
              title={
                removePdfDisabled
                  ? "Wait until generation finishes or fails"
                  : "Remove this PDF from the studio"
              }
              className="shrink-0 rounded-lg border border-line bg-surface/90 p-2 text-ink/45 transition hover:border-accent/35 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Remove uploaded PDF"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
