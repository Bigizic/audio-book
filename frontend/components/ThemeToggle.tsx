"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "audiobook-theme";

export type ThemeMode = "system" | "light" | "dark";

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyDom(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "light") {
    root.classList.remove("dark");
  } else if (mode === "dark") {
    root.classList.add("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

/** Call once on app load (before paint) to avoid flash — run from layout inline script or this component's useLayoutEffect. */
export function syncThemeFromStorage() {
  if (typeof document === "undefined") return;
  applyDom(readStored());
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useLayoutEffect(() => {
    setMode(readStored());
    applyDom(readStored());
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const go = () => applyDom("system");
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode =
        prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyDom(next);
      return next;
    });
  }, []);

  const label =
    mode === "system"
      ? "Theme: system (click for light)"
      : mode === "light"
        ? "Theme: light (click for dark)"
        : "Theme: dark (click for system)";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface/90 p-2 text-muted transition hover:border-accent/40 hover:text-ink"
    >
      {mode === "system" ? (
        <Monitor className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      ) : mode === "light" ? (
        <Sun className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
