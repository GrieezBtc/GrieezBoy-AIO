"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "ok" | "error" | "info";

type ToastItem = { id: number; title: string; body?: string; tone: ToastTone };

type ToastContextValue = {
  push: (toast: { title: string; body?: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLE: Record<ToastTone, { color: string; glyph: string; label: string }> = {
  ok: { color: "var(--accent)", glyph: "[✓]", label: "Success" },
  error: { color: "var(--danger)", glyph: "[!]", label: "Error" },
  info: { color: "var(--violet)", glyph: "[i]", label: "Notice" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    ({ title, body, tone = "info" }) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-2), { id, title, body, tone }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="toast-in panel pointer-events-auto flex w-full max-w-sm items-start gap-3 px-3.5 py-3"
            style={{ borderColor: TONE_STYLE[toast.tone].color }}
          >
            <span
              aria-hidden
              className="mt-[1px] text-xs font-bold"
              style={{ color: TONE_STYLE[toast.tone].color }}
            >
              {TONE_STYLE[toast.tone].glyph}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase">
                <span className="sr-only">{TONE_STYLE[toast.tone].label}: </span>
                {toast.title}
              </p>
              {toast.body ? (
                <p className="mt-1 text-[0.72rem] leading-relaxed break-words text-dim">
                  {toast.body}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="-m-1 shrink-0 p-1 text-faint transition-colors hover:text-ink"
              aria-label="Dismiss notification"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
