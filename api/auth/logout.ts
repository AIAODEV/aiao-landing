import { SESSION_COOKIE, SESSION_COOKIE_DOMAIN } from "../../lib/config";
import { serializeCookie } from "../../lib/http";

export const config = { runtime: "edge" };

export default async function handler(_req: Request): Promise<Response> {
  const headers = new Headers({ location: "/api/auth/login" });
  // Ryd BEGGE former. En cookie med `Domain=.aiao.dev` og en vært-bundet cookie med samme navn er
  // TO forskellige cookies for browseren, og et `Set-Cookie` rammer kun den ene. Ryddede vi kun
  // den nye, ville den gamle (fra før 2026-08-25) overleve et logout på www — tavst, og præcis
  // hos de brugere der har været her længst.
  headers.append("set-cookie", serializeCookie(SESSION_COOKIE, "", {
    maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax", path: "/",
    domain: SESSION_COOKIE_DOMAIN,
  }));
  headers.append("set-cookie", serializeCookie(SESSION_COOKIE, "", {
    maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax", path: "/",
  }));
  return new Response(null, { status: 302, headers });
}
