import { createRemoteJWKSet, jwtVerify } from "jose";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(p: {
  tenantId: string; clientId: string; redirectUri: string; state: string; nonce: string; codeChallenge: string;
}): string {
  const base = `https://login.microsoftonline.com/${p.tenantId}/oauth2/v2.0/authorize`;
  const q = new URLSearchParams({
    client_id: p.clientId,
    response_type: "code",
    redirect_uri: p.redirectUri,
    response_mode: "query",
    scope: "openid profile email",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${base}?${q.toString()}`;
}

export async function exchangeCode(p: {
  tenantId: string; clientId: string; clientSecret: string; code: string; redirectUri: string; codeVerifier: string;
}): Promise<{ id_token: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${p.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: p.clientId,
      client_secret: p.clientSecret,
      grant_type: "authorization_code",
      code: p.code,
      redirect_uri: p.redirectUri,
      code_verifier: p.codeVerifier,
      scope: "openid profile email",
    }),
  });
  if (!res.ok) throw new Error(`token-exchange fejlede: ${res.status}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("intet id_token i svar");
  return { id_token: data.id_token };
}

export async function validateIdToken(
  idToken: string,
  p: { tenantId: string; clientId: string; nonce: string },
): Promise<{ sub: string; email: string }> {
  const jwks = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${p.tenantId}/discovery/v2.0/keys`),
  );
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://login.microsoftonline.com/${p.tenantId}/v2.0`,
    audience: p.clientId,
    requiredClaims: ["sub"],
  });
  if (payload.nonce !== p.nonce) throw new Error("nonce mismatch");
  if (payload.tid !== p.tenantId) throw new Error("forkert tenant (tid)");
  const email = String(payload.preferred_username ?? payload.email ?? "");
  return { sub: String(payload.sub), email };
}
