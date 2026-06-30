import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export async function signJwt(
  secret: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(encoder.encode(secret));
}

export async function verifyJwt<T = Record<string, unknown>>(
  secret: string,
  token: string,
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}
