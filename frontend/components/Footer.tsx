import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line/80 bg-paper py-8 sm:py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 text-xs leading-relaxed text-muted sm:gap-6 sm:px-6 sm:text-sm md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-lg min-w-0 items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.5} />
          <p>
            Audio is synthesized with{" "}
            <a
              href="https://github.com/OHF-Voice/piper1-gpl"
              className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
            >
              Piper
            </a>
            , an open, local-friendly TTS engine. We do not train on your books.
          </p>
        </div>
        <p className="max-w-xs text-pretty md:text-right">
          Files auto-delete after thirty minutes. Nothing lingers on the shelf.
        </p>
      </div>
    </footer>
  );
}
