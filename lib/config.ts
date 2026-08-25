export const CANONICAL_HOST = "www.aiao.dev";
export const APEX_HOST = "aiao.dev";
export const REDIRECT_URI = `https://${CANONICAL_HOST}/api/auth/callback`;
export const SESSION_COOKIE = "aiao_session";
export const STATE_COOKIE = "aiao_oauth_tx";

// Session-cookien gælder HELE `.aiao.dev`, ikke kun `www`. POC'erne ligger på
// `<slug>-poc.aiao.dev` — andre værter i andre Vercel-projekter — og en vært-bundet cookie følger
// ikke med derhen. Med domænet rækker ét AO-login på tværs af alle POC'er, og control-planens
// SSO-bro kan veksle det til et platform-token.
// Se aiao-control-plane/docs/spec-ao-sso-foran-alle-poc.md §6.1.
//
// FØLGEN, sagt højt: cookien SENDES nu med hvert kald til enhver `*.aiao.dev`-vært, altså også til
// apps byggerne selv skriver. Den er `HttpOnly`, så deres JavaScript ikke kan læse den — men den
// er inden for rækkevidde af serveren i hver POC. Det er en bevidst udvidelse (ejer-beslutning
// JAW 2026-08-25), ikke en bivirkning.
//
// STATE-cookien (`aiao_oauth_tx`) får BEVIDST ikke domænet: den lever ti minutter og bruges kun på
// www under selve login-hoppet. Det snævreste der virker, er det rigtige.
export const SESSION_COOKIE_DOMAIN = ".aiao.dev";
export const SESSION_TTL_SECONDS = 28800; // 8 timer
export const STATE_TTL_SECONDS = 600; // 10 min

// Audience-adskillelse: session- og oauth-transaktions-tokens signeres med SAMME secret, så uden
// en `aud`-binding ville et (uautentificeret-udleveret) tx-token kunne bruges som session-token.
// Hver token-type får sin egen audience, som verifikatoren håndhæver.
export const SESSION_AUD = "aiao-session";
export const STATE_AUD = "aiao-oauth-tx";

export interface AppConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
}

export function getConfig(): AppConfig {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!tenantId || !clientId || !clientSecret || !sessionSecret) {
    throw new Error("Manglende env: ENTRA_TENANT_ID/ENTRA_CLIENT_ID/ENTRA_CLIENT_SECRET/SESSION_SECRET");
  }
  return { tenantId, clientId, clientSecret, sessionSecret };
}
