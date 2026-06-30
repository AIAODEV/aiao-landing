export const CANONICAL_HOST = "www.aiao.dev";
export const APEX_HOST = "aiao.dev";
export const REDIRECT_URI = `https://${CANONICAL_HOST}/api/auth/callback`;
export const SESSION_COOKIE = "aiao_session";
export const STATE_COOKIE = "aiao_oauth_tx";
export const SESSION_TTL_SECONDS = 28800; // 8 timer
export const STATE_TTL_SECONDS = 600; // 10 min

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
