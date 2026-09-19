"use client";

import { useEffect } from "react";

/** Service worker registration. Any failure is swallowed by design. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return;
    }
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA is progressive enhancement only */
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
