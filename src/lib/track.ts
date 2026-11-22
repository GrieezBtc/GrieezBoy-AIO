const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export function deviceFromUA(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(userAgent)) return "mobile";
  return "desktop";
}

export type RequestContext = { country: string | null; device: string };

/** Country comes from Vercel's edge header; nothing identifying (no IP) is stored. */
export function requestContext(request: Request): RequestContext {
  const ua = request.headers.get("user-agent") ?? "";
  const country = request.headers.get("x-vercel-ip-country");
  return { country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null, device: deviceFromUA(ua) };
}

export function referrerHost(value: unknown, ownHost: string | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (!host || host === ownHost?.replace(/^www\./, "")) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}
