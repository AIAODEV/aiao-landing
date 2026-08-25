export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: "Lax" | "Strict" | "None"; domain?: string } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  // Uden `Domain` er cookien VÆRT-bundet (kun www.aiao.dev). Med `Domain=.aiao.dev` gælder den
  // alle underdomæner. De to er FORSKELLIGE cookies for browseren, også med samme navn — derfor
  // skal en rydning bruge samme form som sætningen, ellers rammer den ved siden af.
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join("; ");
}

export function safeNextPath(raw: string | null | undefined): string {
  // Kun lokale (samme-origin) stier tillades. Et naivt prefix-tjek (`!startsWith("//")`) er
  // utilstrækkeligt: browsere normaliserer "\" → "/", så "/\evil.com" bliver til "//evil.com"
  // = protokol-relativ open redirect. Vi opløser derfor mod en dummy-origin og afviser alt der
  // resolver til en ANDEN origin (fanger "//", "/\", "https://…", "\\…" m.fl. i ét greb).
  if (!raw || !raw.startsWith("/")) return "/";
  try {
    const u = new URL(raw, "https://x.invalid");
    if (u.origin !== "https://x.invalid") return "/";
    return u.pathname + u.search;
  } catch {
    return "/";
  }
}
