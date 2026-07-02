import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export async function signJwt(
  secret: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
  audience?: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds);
  if (audience) builder = builder.setAudience(audience);
  return await builder.sign(encoder.encode(secret));
}

export async function verifyJwt<T = Record<string, unknown>>(
  secret: string,
  token: string,
  opts?: { audience?: string },
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
      // Håndhæv audience når den er angivet: et token uden (eller med forkert) `aud` afvises →
      // et oauth-tx-token kan ikke passere som session-token og omvendt.
      ...(opts?.audience ? { audience: opts.audience } : {}),
    });
    return payload as T;
  } catch {
    return null;
  }
}
