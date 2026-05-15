"use client";

import { IllustrationHeadphones } from "@/components/Illustrations";
import { VoiceSamplePlayer } from "@/components/VoiceSamplePlayer";
import {
  fetchVoices,
  getApiBase,
  voiceSampleFullUrl,
  type VoiceItem,
} from "@/lib/api";
import { Headphones } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

type Props = {
  selectedVoiceId: string | null;
  onSelectVoice: (voiceId: string) => void;
  playingVoiceId: string | null;
  setPlayingVoiceId: Dispatch<SetStateAction<string | null>>;
};

export function VoicePreview({
  selectedVoiceId,
  onSelectVoice,
  playingVoiceId,
  setPlayingVoiceId,
}: Props) {
  const base = getApiBase();
  let [voices, setVoices] = useState<VoiceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    fetchVoices()
      .then(setVoices)
      .catch(() => setLoadError("Could not load voices."));
  }, [base]);

  const byLanguage = useMemo(() => {
    const m = new Map<string, VoiceItem[]>();
    for (const v of voices) {
      const k = v.language_label;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    }
    return m;
  }, [voices]);

  const languageKeys = useMemo(() => {
    const keys = Array.from(byLanguage.keys());
    const rank = (label: string) => {
      const code = byLanguage.get(label)?.[0]?.language_code ?? "";
      if (code === "en_GB") return 0;
      if (code === "en_US") return 1;
      return 50;
    };
    return keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [byLanguage]);

  if (!base) {
    return (
      <section className="rounded-2xl border border-line bg-surface/75 p-4 shadow-card backdrop-blur-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-ink sm:mb-4">
          <Headphones className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
          <h2 className="font-serif text-base text-ink sm:text-lg md:text-xl">Voice &amp; language</h2>
        </div>
        <p className="text-pretty text-xs text-muted sm:text-sm">
          Set <code className="break-all rounded bg-paper px-1 py-0.5 text-[0.7rem] sm:text-sm">NEXT_PUBLIC_BACKEND_URL</code>{" "}
          to load voices.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface/75 p-4 shadow-card backdrop-blur-sm sm:p-6 lg:p-8">
      <header className="mb-5 flex shrink-0 flex-col gap-2 border-b border-line/80 pb-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 sm:pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <Headphones className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
          <h2 className="font-serif text-base text-ink sm:text-lg md:text-xl">Voice &amp; language</h2>
        </div>
        <p className="min-w-0 text-pretty text-xs leading-relaxed text-muted sm:max-w-sm sm:text-right sm:text-sm">
          Pick a narrator, preview, then generate.
        </p>
      </header>

      {/*<div className="mb-6 flex flex-col items-center gap-4 sm:mb-8 sm:flex-row sm:items-start sm:gap-6">
        <div className="shrink-0 text-accent/90 sm:pt-1">
          <IllustrationHeadphones />
        </div>
        <p className="max-w-2xl text-center text-xs leading-relaxed text-muted text-pretty sm:text-left sm:text-sm">
          English (US) and English (GB) — two voices each, with a preview player per voice (play,
          seek, volume). Only one sample plays at a time.
        </p>
      </div>*/}

      {loadError && (
        <p className="mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-pretty text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 sm:text-sm">
          {loadError}
        </p>
      )}

      <div className="voices-scroll space-y-6 overflow-x-hidden sm:space-y-8">
        {languageKeys.map((lang) => (
          <div key={lang} className="min-w-0">
            <h3 className="mb-3 font-serif text-sm text-ink sm:mb-4 sm:text-base md:text-lg">
              {lang}
            </h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
              {(byLanguage.get(lang) ?? []).map((v) => {
                const checked = selectedVoiceId === v.voice_id;
                const audioSrc = voiceSampleFullUrl(v.sample_url);
                return (
                  <li
                    key={v.voice_id}
                    className={`min-w-0 rounded-2xl border p-4 transition-colors sm:p-5 ${
                      checked
                        ? "border-accent/45 bg-paper shadow-soft"
                        : "border-line bg-surface/55 shadow-card"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                      <label className="flex min-w-0 cursor-pointer items-start gap-3">
                        <input
                          type="radio"
                          name="narrator-voice"
                          value={v.voice_id}
                          checked={checked}
                          onChange={() => onSelectVoice(v.voice_id)}
                          className="mt-1 h-4 w-4 shrink-0 border-line text-accent focus:ring-accent"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-sans text-xs font-semibold leading-snug text-ink sm:text-sm md:text-base">
                            {v.label}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-ink/55 sm:text-[11px] md:text-xs">
                            {v.voice_id}
                          </span>
                        </span>
                      </label>
                      <div className="min-w-0 w-full">
                        <VoiceSamplePlayer
                          src={audioSrc}
                          voiceId={v.voice_id}
                          playingVoiceId={playingVoiceId}
                          setPlayingVoiceId={setPlayingVoiceId}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!loadError && voices.length === 0 && base && (
        <p className="mt-4 shrink-0 text-center text-xs text-muted sm:text-sm">Loading voices…</p>
      )}
    </section>
  );
}
