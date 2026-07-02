import { getConfig, REDIRECT_URI, SESSION_COOKIE, SESSION_TTL_SECONDS, STATE_COOKIE, SESSION_AUD, STATE_AUD } from "../../lib/config";
import { signJwt, verifyJwt } from "../../lib/jwt";
import { exchangeCode, validateIdToken } from "../../lib/oauth";
import { parseCookies, serializeCookie, safeNextPath } from "../../lib/http";

export const config = { runtime: "edge" };

interface Tx { state: string; nonce: string; verifier: string; next: string }

function toLogin(): Response {
  return new Response(null, { status: 302, headers: { location: "/api/auth/login" } });
}

export default async function handler(req: Request): Promise<Response> {
  const { tenantId, clientId, clientSecret, sessionSecret } = getConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const txToken = parseCookies(req.headers.get("cookie"))[STATE_COOKIE];
  if (!code || !state || !txToken) return toLogin();

  const tx = await verifyJwt<Tx>(sessionSecret, txToken, { audience: STATE_AUD });
  if (!tx || tx.state !== state) return toLogin();

  let user: { sub: string; email: string };
  try {
    const { id_token } = await exchangeCode({
      tenantId, clientId, clientSecret, code, redirectUri: REDIRECT_URI, codeVerifier: tx.verifier,
    });
    user = await validateIdToken(id_token, { tenantId, clientId, nonce: tx.nonce });
  } catch (err) {
    // console.error beholdes permanent: gør fremtidige fejl (fx udløbet client secret →
    // token-exchange 401) synlige i Vercel-logs i stedet for at skulle gætte. Selve
    // bruger-beskeden holdes generisk (lækker ikke intern fejl-detalje).
    const msg = err instanceof Error ? err.message : String(err);
    console.error("auth callback fejl:", msg);
    // Skel server-side/config-fejl (fx udløbet client secret → token-exchange 401, eller manglende
    // id_token) fra reelt access-denied. Appen er single-tenant → en ikke-AO-konto når aldrig hertil,
    // så en token-exchange-fejl er PRAKTISK TALT altid en config-fejl, ikke en afvist bruger. Vis da
    // 503 + "prøv igen/kontakt admin" i stedet for den vildledende "kun AO-konti"-besked.
    const serverside = msg.includes("token-exchange fejlede") || msg.includes("intet id_token");
    return serverside
      ? new Response("Midlertidig loginfejl — prøv igen om lidt, eller kontakt en admin hvis det varer ved.", { status: 503 })
      : new Response("Login mislykkedes — kun AO-konti har adgang.", { status: 403 });
  }

  const session = await signJwt(sessionSecret, { sub: user.sub, email: user.email }, SESSION_TTL_SECONDS, SESSION_AUD);
  const next = safeNextPath(tx.next);

  const headers = new Headers({ location: next });
  headers.append("set-cookie", serializeCookie(SESSION_COOKIE, session, {
    maxAge: SESSION_TTL_SECONDS, httpOnly: true, secure: true, sameSite: "Lax", path: "/",
  }));
  headers.append("set-cookie", serializeCookie(STATE_COOKIE, "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax", path: "/" }));
  return new Response(null, { status: 302, headers });
}
