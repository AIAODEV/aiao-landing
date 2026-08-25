/**
 * `/api/poc-login` — vejen der sætter POC'erne bag AO SSO.
 *
 * **`returnTo`-allowlisten er sikkerhedsgrænsen.** Platform-tokenet rejser i URL'en til den adresse
 * `returnTo` peger på, og tokenets audience er i dag den brede `aiao-poc` — et lækket token virker
 * derfor på HVER POC. Angrebs-tilfældene står først af den grund.
 *
 * Den anden halvdel er løkke-værnet: en bruger uden platform-konto på en LÅST POC ville ellers
 * hoppe i ring mellem POC-gaten og login uden en eneste besked (spec §5).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import handler, { gyldigReturnTo } from "../api/poc-login";
import { signJwt } from "../lib/jwt";
import { SESSION_AUD } from "../lib/config";

const HEMMELIGHED = "kkkkkkkkkkkkkkkk";
const POC = "https://jawtest-poc.aiao.dev/auth/aiao";

beforeEach(() => {
  process.env.SESSION_SECRET = HEMMELIGHED;
  process.env.CONTROL_PLANE_API_URL = "https://cp.example";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function session(): Promise<string> {
  return signJwt(HEMMELIGHED, { sub: "oid-1", email: "a@ao.dk" }, 3600, SESSION_AUD);
}

function kald(url: string, cookie?: string): Promise<Response> {
  return handler(new Request(url, cookie ? { headers: { cookie } } : undefined));
}

function broSvarer(krop: unknown, status = 200) {
  const spy = vi.fn(async () => new Response(JSON.stringify(krop), {
    status, headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

// ── Allowlisten: hvem må modtage et platform-token? ─────────────────────────

describe("gyldigReturnTo", () => {
  it("accepterer en POC på aiao.dev og en på aiao.work", () => {
    expect(gyldigReturnTo("https://jawtest-poc.aiao.dev/auth/aiao")?.hostname)
      .toBe("jawtest-poc.aiao.dev");
    expect(gyldigReturnTo("https://poc42.aiao.work/auth/aiao")?.hostname).toBe("poc42.aiao.work");
  });

  it.each([
    ["null", null],
    ["tom", ""],
    ["fremmed vært", "https://ondsindet.example.com/auth/aiao"],
    ["ligner vores", "https://aiao.dev.ondsindet.example.com/auth/aiao"],
    ["suffiks-snyd", "https://ondsindet-aiao.dev/auth/aiao"],
    ["under-underdomæne", "https://a.b.aiao.dev/auth/aiao"],
    ["http, ikke https", "http://jawtest-poc.aiao.dev/auth/aiao"],
    ["forkert sti", "https://jawtest-poc.aiao.dev/andet"],
    ["sti-traversering", "https://jawtest-poc.aiao.dev/auth/aiao/../videre"],
    ["javascript-skema", "javascript:alert(1)"],
    ["data-skema", "data:text/html,<script>"],
    ["ikke en URL", "//jawtest-poc.aiao.dev/auth/aiao"],
    ["user-info-snyd", "https://jawtest-poc.aiao.dev@ondsindet.example.com/auth/aiao"],
  ])("afviser %s", (_navn, raw) => {
    expect(gyldigReturnTo(raw as string | null)).toBeNull();
  });
});

describe("ugyldigt mål", () => {
  it("redirecter IKKE videre — den svarer 400", async () => {
    const res = await kald("https://www.aiao.dev/api/poc-login?returnTo=https://ondsindet.example.com/auth/aiao");
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });

  it("afviser også helt uden returnTo", async () => {
    expect((await kald("https://www.aiao.dev/api/poc-login")).status).toBe(400);
  });
});

// ── Uden session: gennem Entra, og KUN én gang ─────────────────────────────

describe("uden AO-session", () => {
  it("sender gennem www's eget login med en LOKAL next-sti", async () => {
    const res = await kald(`https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/api/auth/login");
    // `next` SKAL være en lokal sti — ellers ville vi skulle pille ved safeNextPath, som er
    // hærdet tre gange mod open redirects.
    const next = loc.searchParams.get("next")!;
    expect(next.startsWith("/api/poc-login?")).toBe(true);
    expect(next).toContain("f=1");
  });

  it("hopper KUN én gang — anden gang er det en besked, ikke en løkke", async () => {
    const res = await kald(`https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}&f=1`);
    expect(res.status).toBe(503);
    expect(res.headers.get("location")).toBeNull();
  });
});

// ── Med session: veksl og send videre ──────────────────────────────────────

describe("med AO-session", () => {
  it("veksler til et platform-token og sender til POC'ens callback", async () => {
    const spy = broSvarer({ token: "PT123", tier: "basis", kraever_konto: false });
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);

    expect(res.status).toBe(302);
    const dest = new URL(res.headers.get("location")!);
    expect(dest.origin + dest.pathname).toBe(POC);
    expect(dest.searchParams.get("pt")).toBe("PT123");

    // Og broen fik at vide HVILKEN app — det er dét der afgør niveauet.
    const kaldt = spy.mock.calls[0] as unknown as [string, RequestInit];
    const krop = JSON.parse(kaldt[1].body as string);
    expect(krop.app).toBe("jawtest-poc.aiao.dev");
    expect(typeof krop.session).toBe("string");
  });

  it("LÅST POC uden konto: en forklaring, ALDRIG et redirect", async () => {
    broSvarer({ token: "PT123", tier: "basis", kraever_konto: true });
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toContain("konto på platformen");
  });

  it("udløbet session giver ét nyt Entra-hop, og så en besked", async () => {
    broSvarer({ detail: "nej" }, 401);
    const et = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);
    expect(et.status).toBe(302);

    broSvarer({ detail: "nej" }, 401);
    const to = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}&f=1`,
      `aiao_session=${await session()}`);
    expect(to.status).toBe(401);
    expect(to.headers.get("location")).toBeNull();
  });

  it("bro nede (503) sender ikke brugeren videre uden token", async () => {
    broSvarer({}, 503);
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);
    expect(res.status).toBe(503);
    expect(res.headers.get("location")).toBeNull();
  });

  it("svar uden token behandles som en fejl, ikke som et tomt pt", async () => {
    broSvarer({ tier: "basis" });
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);
    expect(res.status).toBe(503);
  });

  it("uden CONTROL_PLANE_API_URL kaldes der slet ikke ud", async () => {
    delete process.env.CONTROL_PLANE_API_URL;
    const spy = broSvarer({ token: "x" });
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}`,
      `aiao_session=${await session()}`);
    expect(res.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── Hvad svaret aldrig må røbe ─────────────────────────────────────────────

describe("lækager", () => {
  it("fejlsiderne indeholder ikke sessionen", async () => {
    const s = await session();
    broSvarer({ detail: "nej" }, 401);
    const res = await kald(
      `https://www.aiao.dev/api/poc-login?returnTo=${encodeURIComponent(POC)}&f=1`,
      `aiao_session=${s}`);
    expect(await res.text()).not.toContain(s);
  });
});
