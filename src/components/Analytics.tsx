"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const VID_KEY = "gb.vid";

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Sends one anonymous page view per navigation to this site's own /api/hit. */
export function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const payload = JSON.stringify({
      path: pathname,
      vid: visitorId(),
      ref: first.current ? document.referrer : "",
    });
    first.current = false;
    try {
      void fetch("/api/hit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);

  return null;
}
