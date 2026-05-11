"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Kind = "success" | "error";

type Item = { id: number; kind: Kind; message: string };

const NotificationContext = createContext<{
  notify: (kind: Kind, message: string) => void;
} | null>(null);

const TOAST_MS = 6000;

export function AppProviders({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((kind: Kind, message: string) => {
    const id = ++nextId.current;
    setItems((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, TOAST_MS);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <ol
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100%-2rem,22rem)] list-none flex-col gap-2 p-0 sm:bottom-6 sm:right-6"
        aria-live="polite"
      >
        {items.map((t) => (
          <li
            key={t.id}
            role="status"
            className={
              t.kind === "success"
                ? "pointer-events-auto rounded-xl border border-sage/40 bg-white px-4 py-3 text-pretty text-sm leading-snug text-ink shadow-soft"
                : "pointer-events-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-pretty text-sm leading-snug text-red-950 shadow-soft"
            }
          >
            {t.message}
          </li>
        ))}
      </ol>
    </NotificationContext.Provider>
  );
}

export function useAppNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useAppNotifications must be used within AppProviders");
  }
  const { notify } = ctx;
  return {
    success: (message: string) => notify("success", message),
    error: (message: string) => notify("error", message),
  };
}
