import { getConfig, REDIRECT_URI, SESSION_COOKIE, SESSION_TTL_SECONDS, STATE_COOKIE } from "../../lib/config";
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

  const tx = await verifyJwt<Tx>(sessionSecret, txToken);
  if (!tx || tx.state !== state) return toLogin();

  let user: { sub: string; email: string };
  try {
    const { id_token } = await exchangeCode({
      tenantId, clientId, clientSecret, code, redirectUri: REDIRECT_URI, codeVerifier: tx.verifier,
    });
    user = await validateIdToken(id_token, { tenantId, clientId, nonce: tx.nonce });
  } catch (err) {
    // Midlertidig diagnostik: den oprindelige catch var tavs+generisk og skjulte hvilket
    // trin (token-exchange vs id_token-validering) der fejlede. console.error beholdes
    // permanent; diagnose-teksten i svaret fjernes igen når rod-årsagen er fundet.
    const reason = err instanceof Error ? err.message : String(err);
    console.error("auth callback fejl:", reason);
    return new Response(`Login mislykkedes (diagnose: ${reason})`, { status: 403 });
  }

  const session = await signJwt(sessionSecret, { sub: user.sub, email: user.email }, SESSION_TTL_SECONDS);
  const next = safeNextPath(tx.next);

  const headers = new Headers({ location: next });
  headers.append("set-cookie", serializeCookie(SESSION_COOKIE, session, {
    maxAge: SESSION_TTL_SECONDS, httpOnly: true, secure: true, sameSite: "Lax", path: "/",
  }));
  headers.append("set-cookie", serializeCookie(STATE_COOKIE, "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax", path: "/" }));
  return new Response(null, { status: 302, headers });
}
