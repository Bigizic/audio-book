import { IllustrationBooks, IllustrationReader } from "@/components/Illustrations";

export function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-line/80 bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <div className="max-w-xl min-w-0 space-y-4 sm:space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted sm:text-sm sm:tracking-[0.2em]">
            Shelf Audio
          </p>
          <h1 className="font-serif text-[clamp(1.75rem,5.5vw+0.4rem,3.15rem)] leading-[1.12] text-ink sm:leading-tight">
            Turn Any Book Into an Audiobook
          </h1>
          <p className="text-base leading-relaxed text-muted sm:text-lg">
            Natural-sounding voices, gentle pacing, and pages you actually want
            to hear — built for readers who live with headphones on.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 md:items-end">
          <IllustrationBooks />
          <IllustrationReader />
        </div>
      </div>
    </header>
  );
}
