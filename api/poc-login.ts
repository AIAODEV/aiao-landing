/**
 * `/api/poc-login` — vekslér et AO-login til et platform-token for én POC.
 *
 * Dette er vejen der sætter POC'erne bag AO SSO. POC'ens middleware sender brugeren hertil
 * (`PLATFORM_LOGIN_URL`), og herfra:
 *
 *   1. mangler der en `aiao_session`? → send gennem www's Entra-flow og kom tilbage hertil,
 *   2. verificér sessionen HER, og send kun en kortlivet påstand `{sub, email}` til control-planen,
 *   3. redirect til POC'ens `/auth/aiao?pt=<token>`.
 *
 * **HVORFOR VI VERIFICERER SELV.** `SESSION_SECRET` forlader aldrig www. Delte vi den med
 * control-planen, kunne en kompromitteret control-plane forfalske et www-login — og en rotation
 * ville logge ALLE ud af www.aiao.dev, fordi de 8-timers sessioner er signeret med den. I stedet
 * underskrives en påstand med en SEPARAT nøgle (`POC_LOGIN_KEY`), 60 sekunders levetid, egen
 * audience. Det der krydser ledningen har dermed ét formål og er værdiløst i morgen.
 *
 * **HVORFOR HER OG IKKE PÅ admin.aiao.dev.** www's login-flow accepterer kun LOKALE stier som
 * `next` (`safeNextPath`), og det værn er hærdet tre gange mod open redirects (`//`, `/\`, `%09`).
 * Ved at lægge endpointet på www er `next` en almindelig lokal sti, og vi behøver ikke pille ved
 * det. Se aiao-control-plane/docs/spec-ao-sso-foran-alle-poc.md.
 *
 * **`returnTo`-ALLOWLISTEN ER SIKKERHEDSGRÆNSEN.** Platform-tokenet rejser i URL'en til den
 * adresse `returnTo` peger på. Peger den på en fremmed vært, forærer vi tokenet væk — og fordi
 * tokenets audience i dag er den brede `aiao-poc`, ville det virke på HVER POC. Reglen er derfor
 * identisk med control-plane-frontendens (`validReturnTo` i `app/adgang/page.tsx`): https, ét
 * label under `aiao.dev`/`aiao.work`, og præcis stien `/auth/aiao`. **Løsn den aldrig uden at
 * spørge hvad et lækket token kan nå.**
 */
import { getConfig, SESSION_AUD, SESSION_COOKIE } from "../lib/config";
import { parseCookies } from "../lib/http";
import { signJwt, verifyJwt } from "../lib/jwt";

/** Audience på påstanden til control-planen. Skal matche `sso_bro.BRO_AUD` dér. */
const BRO_AUD = "aiao-bro";
/** Levetid på påstanden. Den bruges i samme kald den laves — sekunder er rigeligt. */
const BRO_TTL_SECONDS = 60;

export const config = { runtime: "edge" };

/** Samme regel som control-plane-frontendens `validReturnTo`. Ét label — `a.b.aiao.dev` er ikke os. */
const HOST_RE = /^[a-z0-9-]+\.aiao\.(dev|work)$/;

export function gyldigReturnTo(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (!HOST_RE.test(u.hostname)) return null;
  if (u.pathname !== "/auth/aiao") return null;
  return u;
}

function side(titel: string, tekst: string, status: number): Response {
  // Ren HTML uden afhængigheder: dette svar skal virke også når alt andet er nede.
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(titel)}</title>` +
    `<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:20vh auto;padding:0 1.5rem;line-height:1.6">` +
    `<h1 style="font-size:1.25rem;margin:0 0 .75rem">${esc(titel)}</h1>` +
    `<p style="margin:0;color:#444">${esc(tekst)}</p></div>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** De første 8 hex-tegn af SHA-256 over en værdi. Se `fingeraftryk`-endpointet nedenfor. */
async function aftrykAf(vaerdi: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(vaerdi));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0"))
    .join("").slice(0, 8);
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Fingeraftryk af bro-nøglen — modstykke til control-planens `/platform/bro-fingeraftryk`.
  // En delt hemmelighed mellem to systemer fejler oftest ved at de to sider IKKE har samme værdi,
  // og uden en måde at se det på bliver fejlsøgningen "prøv igen og håb". Aftrykket røber ingen ny
  // evne: enhver kan i forvejen afprøve et gæt ved at signere en påstand og kalde broen.
  if (url.searchParams.get("fingeraftryk") === "1") {
    const n = process.env.POC_LOGIN_KEY;
    return new Response(JSON.stringify({
      fingeraftryk: n ? await aftrykAf(n) : null,
      aud: BRO_AUD,
      ttl: BRO_TTL_SECONDS,
      control_plane_url: process.env.CONTROL_PLANE_API_URL ? "sat" : null,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const maal = gyldigReturnTo(url.searchParams.get("returnTo"));
  if (!maal) {
    // Redirect ALDRIG videre på et ugyldigt mål — så ville værnet være en formalitet.
    return side("Ugyldigt link",
      "Adressen mangler eller peger et sted vi ikke må sende dig hen. Åbn appen forfra fra dens "
      + "egen adresse.", 400);
  }

  const session = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  const forsoegt = url.searchParams.get("f") === "1";

  if (!session) {
    if (forsoegt) {
      // Vi har lige været gennem Entra og har STADIG ingen cookie. At sende igen ville være en
      // uendelig løkke; her stopper vi med en besked et menneske kan handle på.
      return side("Login lykkedes ikke",
        "Dit AO-login blev ikke gemt i browseren. Prøv i et almindeligt vindue (ikke privat "
        + "browsing), eller kontakt en administrator.", 503);
    }
    const tilbage = `/api/poc-login?returnTo=${encodeURIComponent(maal.toString())}&f=1`;
    return Response.redirect(
      new URL(`/api/auth/login?next=${encodeURIComponent(tilbage)}`, url.origin), 302);
  }

  const api = process.env.CONTROL_PLANE_API_URL;
  const broNoegle = process.env.POC_LOGIN_KEY;
  if (!api || !broNoegle) {
    console.error("poc-login: mangler", !api ? "CONTROL_PLANE_API_URL" : "POC_LOGIN_KEY");
    return side("Login er ikke sat op endnu",
      "Appen kan ikke nå platformens login-tjeneste. Kontakt en administrator.", 503);
  }

  // VI verificerer sessionen — control-planen ser den aldrig. `SESSION_SECRET` forlader dermed
  // ikke www: en kompromitteret control-plane kan ikke forfalske et www-login, og en rotation af
  // bro-nøglen logger ingen ud herfra. Det der krydser ledningen er en 60-sekunders påstand med
  // ét formål, ikke en 8-timers session der åbner hele www.
  const { sessionSecret } = getConfig();
  const bruger = await verifyJwt<{ sub: string; email: string }>(sessionSecret, session,
    { audience: SESSION_AUD });
  if (!bruger?.email || !bruger?.sub) {
    // Cookien er væk, udløbet eller forfalsket. Ét nyt Entra-hop — men kun ét (`f=1`).
    if (forsoegt) {
      console.error("poc-login: www kunne ikke verificere sin EGEN session-cookie");
      // Teksten SKAL skille sig fra bro-fejlen nedenfor. De to har vidt forskellige årsager —
      // her er det www's egen cookie, dér er det nøglerne mellem de to systemer — og en fælles
      // tekst gør fejlsøgningen til gætteri. (Ét tegn må ikke bære to betydninger.)
      return side("Dit AO-login kunne ikke læses",
        "Sessionen i din browser kunne ikke bekræftes her. Log ud på www.aiao.dev og ind igen, "
        + "eller prøv et almindeligt vindue (ikke privat browsing). [kode: SESSION]", 401);
    }
    const tilbage = `/api/poc-login?returnTo=${encodeURIComponent(maal.toString())}&f=1`;
    return Response.redirect(
      new URL(`/api/auth/login?next=${encodeURIComponent(tilbage)}`, url.origin), 302);
  }

  const paastand = await signJwt(broNoegle, { sub: bruger.sub, email: bruger.email },
    BRO_TTL_SECONDS, BRO_AUD);

  let svar: Response;
  try {
    svar = await fetch(`${api.replace(/\/$/, "")}/platform/session-from-sso`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: paastand, app: maal.hostname }),
    });
  } catch (err) {
    console.error("poc-login: kunne ikke NAA control-planen:", err instanceof Error ? err.message : String(err));
    return side("Kunne ikke få fat i platformen",
      "Login-tjenesten svarede slet ikke. Prøv igen om lidt; varer det ved, så kontakt en "
      + "administrator. [kode: NET]", 503);
  }

  if (svar.status === 401) {
    // Ét forsøg gennem Entra igen — men kun ét (`f=1`).
    if (forsoegt) {
      console.error("poc-login: control-planen AFVISTE vores paastand (401) — "
        + "POC_LOGIN_KEY her og SSO_BRO_KEY dér er sandsynligvis ikke samme vaerdi");
      // Den HYPPIGSTE aarsag staar foerst: to nøgler der skulle være ens, er det ikke. Beskeden
      // siger det uden at røbe noget — en administrator ved med det samme hvor han skal kigge.
      return side("Platformen godtog ikke dit login",
        "Dit AO-login er i orden, men platformen kunne ikke bekræfte det. Det skyldes næsten "
        + "altid at to nøgler ikke er ens. Kontakt en administrator. [kode: BRO]", 401);
    }
    const tilbage = `/api/poc-login?returnTo=${encodeURIComponent(maal.toString())}&f=1`;
    return Response.redirect(
      new URL(`/api/auth/login?next=${encodeURIComponent(tilbage)}`, url.origin), 302);
  }

  if (!svar.ok) {
    // Statuskoden MED i beskeden: en 500 fra broen og en 404 på en forkert URL har vidt
    // forskellige rettelser, og uden tallet er de umulige at skelne udefra.
    console.error("poc-login: broen svarede", svar.status);
    return side("Platformen svarede med en fejl",
      `Login-tjenesten svarede ${svar.status}. Prøv igen om lidt; varer det ved, så kontakt en `
      + `administrator. [kode: BRO${svar.status}]`, 503);
  }

  const krop = await svar.json() as { token?: string; kraever_konto?: boolean };

  if (krop.kraever_konto) {
    // **Løkke-værnet.** Appen er låst til inviterede, og brugeren har intet at komme med. Sendte vi
    // hende videre med tokenet, ville POC'ens gate afvise det (andet nøglesæt) og sende hende
    // hertil igen — i ring, uden en eneste besked. Se spec §5.
    return side("Denne app kræver en konto på platformen",
      `Du er logget ind som AO-medarbejder, men ${maal.hostname} er låst til udvalgte brugere. `
      + "Bed appens ejer eller en platform-administrator om adgang.", 403);
  }

  if (!krop.token) {
    console.error("poc-login: broen svarede OK, men uden token");
    return side("Platformen svarede uden et login",
      "Login-tjenesten godtog dig, men sendte ingen adgang tilbage. Kontakt en administrator. "
      + "[kode: TOMT]", 503);
  }

  const dest = new URL(maal.toString());
  dest.searchParams.set("pt", krop.token);
  return Response.redirect(dest.toString(), 302);
}
