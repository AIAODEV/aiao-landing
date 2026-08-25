/**
 * Session-cookien skal gælde HELE `.aiao.dev`, ikke kun `www`.
 *
 * Hvorfor: POC'erne ligger på `<slug>-poc.aiao.dev` — andre VÆRTER i andre Vercel-projekter. En
 * vært-bundet cookie følger ikke med derhen, så control-planens SSO-bro kan ikke se at brugeren
 * allerede har et gyldigt AO-login. Med `Domain=.aiao.dev` rækker ét login på tværs.
 * Se aiao-control-plane/docs/spec-ao-sso-foran-alle-poc.md §6.1.
 *
 * To fælder testene findes for:
 *  1. **Logout skal rydde med SAMME domæne.** Et `Set-Cookie` uden `Domain` rammer en ANDEN cookie
 *     end den med `Domain=.aiao.dev` — så ville sessionen overleve et logout. Tavst.
 *  2. **Eksisterende brugere har den gamle, vært-bundne cookie.** Sætter vi kun den nye, ligger de
 *     to side om side med samme navn, og hvilken der vinder er ikke vores at bestemme. Begge
 *     ender skal rydde den gamle eksplicit.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { serializeCookie } from "../lib/http";
import { SESSION_COOKIE, SESSION_COOKIE_DOMAIN, STATE_COOKIE } from "../lib/config";
import logout from "../api/auth/logout";

beforeEach(() => {
  process.env.ENTRA_TENANT_ID = "TEN";
  process.env.ENTRA_CLIENT_ID = "CID";
  process.env.ENTRA_CLIENT_SECRET = "SEC";
  process.env.SESSION_SECRET = "kkkkkkkkkkkkkkkk";
});

/** Alle Set-Cookie-headere som en liste (der er flere pr. svar). */
function setCookies(res: Response): string[] {
  const getAll = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getAll === "function") return getAll.call(res.headers);
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(/,(?=[^;]+?=)/) : [];
}

describe("serializeCookie: domain", () => {
  it("skriver Domain når den er givet", () => {
    expect(serializeCookie("x", "1", { domain: ".aiao.dev" })).toContain("Domain=.aiao.dev");
  });

  it("skriver INTET Domain når den ikke er givet (uændret adfærd)", () => {
    // Vigtigt: den vært-bundne form skal stadig kunne laves — vi bruger den til at RYDDE
    // den gamle cookie hos folk der allerede er logget ind.
    expect(serializeCookie("x", "1", {})).not.toContain("Domain");
  });
});

describe("konfigurationen", () => {
  it("domænet er sat med et punktum foran, så alle underdomæner er med", () => {
    expect(SESSION_COOKIE_DOMAIN).toBe(".aiao.dev");
  });
});

describe("logout", () => {
  it("rydder sessionen på BEGGE former", async () => {
    const cookies = setCookies(await logout(new Request("https://www.aiao.dev/api/auth/logout")));
    const session = cookies.filter((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(session.length).toBe(2);

    const medDomain = session.find((c) => c.includes("Domain=.aiao.dev"));
    const udenDomain = session.find((c) => !c.includes("Domain="));
    expect(medDomain, "uden denne overlever sessionen på alle POC-værter").toBeTruthy();
    expect(udenDomain, "uden denne overlever den gamle vært-bundne cookie på www").toBeTruthy();
    for (const c of session) expect(c).toContain("Max-Age=0");
  });
});

describe("afgrænsning", () => {
  it("STATE-cookien bliver vært-bundet", () => {
    // `aiao_oauth_tx` lever i ti minutter og bruges KUN på www under selve login-hoppet. Den har
    // intet at gøre på en POC-vært, og det snævreste der virker er det rigtige.
    const c = serializeCookie(STATE_COOKIE, "tx", { maxAge: 600, path: "/" });
    expect(c).not.toContain("Domain");
  });
});

/**
 * Callbackens SUCCES-sti var utestet indtil nu — de to eksisterende callback-tests rammer kun de
 * tidlige afvisninger (manglende/uenig state). Det er netop dér cookien sættes, altså dér denne
 * ændring bor. En grøn suite der ikke rører den linje, beviser intet om den.
 */
describe("callback: succes-stien sætter cookien rigtigt", () => {
  it("sætter sessionen på .aiao.dev OG rydder den gamle vært-bundne", async () => {
    vi.resetModules();
    vi.doMock("../lib/oauth", () => ({
      exchangeCode: async () => ({ id_token: "dummy" }),
      validateIdToken: async () => ({ sub: "oid-1", email: "medarbejder@ao.dk" }),
    }));
    const { signJwt } = await import("../lib/jwt");
    const { STATE_AUD } = await import("../lib/config");
    const handler = (await import("../api/auth/callback")).default;

    const tx = await signJwt("kkkkkkkkkkkkkkkk",
      { state: "S", nonce: "n", verifier: "v", next: "/repos" }, 600, STATE_AUD);
    const res = await handler(new Request(
      "https://www.aiao.dev/api/auth/callback?code=abc&state=S",
      { headers: { cookie: `aiao_oauth_tx=${tx}` } }));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/repos");

    const session = setCookies(res).filter((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const sat = session.find((c) => c.includes("Domain=.aiao.dev"));
    const ryddet = session.find((c) => !c.includes("Domain="));

    expect(sat, "sessionen skal sættes på hele .aiao.dev").toBeTruthy();
    expect(sat).toContain("HttpOnly");
    expect(sat).toContain("Secure");
    expect(sat).toContain("SameSite=Lax");
    expect(sat).toContain("Max-Age=28800");
    expect(sat).not.toContain("Max-Age=0");

    expect(ryddet, "den gamle vært-bundne cookie skal ryddes").toBeTruthy();
    expect(ryddet).toContain("Max-Age=0");

    vi.doUnmock("../lib/oauth");
  });
});
