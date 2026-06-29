import { next } from "@vercel/edge";
import { getConfig, SESSION_COOKIE } from "./lib/config";
import { verifyJwt } from "./lib/jwt";
import { parseCookies } from "./lib/http";
import { gateDecision } from "./lib/gate";

export const config = {
  matcher: ["/((?!api/|_vercel/|favicon\\.ico|robots\\.txt).*)"],
};

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { sessionSecret } = getConfig();

  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  const sessionValid = token ? (await verifyJwt(sessionSecret, token)) !== null : false;

  const decision = gateDecision({
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    sessionValid,
  });

  if (decision.action === "next") return next();
  return new Response(null, { status: decision.status, headers: { location: decision.location } });
}
