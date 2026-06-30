import { SESSION_COOKIE } from "../../lib/config";
import { serializeCookie } from "../../lib/http";

export const config = { runtime: "edge" };

export default async function handler(_req: Request): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/api/auth/login",
      "set-cookie": serializeCookie(SESSION_COOKIE, "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax", path: "/" }),
    },
  });
}
