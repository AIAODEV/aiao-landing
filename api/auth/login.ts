import { getConfig, REDIRECT_URI, STATE_COOKIE, STATE_TTL_SECONDS, STATE_AUD } from "../../lib/config";
import { signJwt } from "../../lib/jwt";
import { buildAuthorizeUrl, randomToken, sha256Base64Url } from "../../lib/oauth";
import { serializeCookie, safeNextPath } from "../../lib/http";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const { tenantId, clientId, sessionSecret } = getConfig();
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"));

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(verifier);

  const tx = await signJwt(sessionSecret, { state, nonce, verifier, next }, STATE_TTL_SECONDS, STATE_AUD);
  const authorizeUrl = buildAuthorizeUrl({ tenantId, clientId, redirectUri: REDIRECT_URI, state, nonce, codeChallenge });

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl,
      "set-cookie": serializeCookie(STATE_COOKIE, tx, {
        maxAge: STATE_TTL_SECONDS, httpOnly: true, secure: true, sameSite: "Lax", path: "/",
      }),
    },
  });
}
