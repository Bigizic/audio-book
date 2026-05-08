"use client";

import { FileText, Upload } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

type Props = {
  fileName: string | null;
  pageCount: number | null;
  busy: boolean;
  onFile: (file: File) => void;
};

export function UploadZone({ fileName, pageCount, busy, onFile }: Props) {
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

  return (
    <section className="rounded-2xl border border-line bg-white/70 p-4 shadow-card backdrop-blur-sm sm:p-6">
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
        <div className="mt-3 rounded-lg bg-paper px-3 py-2.5 text-xs text-ink shadow-inner sm:mt-4 sm:px-4 sm:py-3 sm:text-sm">
          <p className="break-all font-medium sm:break-words">{fileName}</p>
          {pageCount != null && (
            <p className="mt-1 text-muted">{pageCount} pages detected</p>
          )}
        </div>
      )}
    </section>
  );
}
