/**
 * `/api/poc-login` — vekslér et AO-login til et platform-token for én POC.
 *
 * Dette er vejen der sætter POC'erne bag AO SSO. POC'ens middleware sender brugeren hertil
 * (`PLATFORM_LOGIN_URL`), og herfra:
 *
 *   1. mangler der en `aiao_session`? → send gennem www's Entra-flow og kom tilbage hertil,
 *   2. veksl sessionen til et platform-token hos control-planen,
 *   3. redirect til POC'ens `/auth/aiao?pt=<token>`.
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
import { SESSION_COOKIE } from "../lib/config";
import { parseCookies } from "../lib/http";

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

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
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
  if (!api) {
    return side("Login er ikke sat op endnu",
      "Appen kan ikke nå platformens login-tjeneste. Kontakt en administrator.", 503);
  }

  let svar: Response;
  try {
    svar = await fetch(`${api.replace(/\/$/, "")}/platform/session-from-sso`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session, app: maal.hostname }),
    });
  } catch (err) {
    console.error("poc-login: kunne ikke naa control-planen:", err instanceof Error ? err.message : String(err));
    return side("Login-tjenesten svarer ikke",
      "Prøv igen om lidt. Varer det ved, så kontakt en administrator.", 503);
  }

  if (svar.status === 401) {
    // Sessionen er udløbet eller ugyldig. Ét forsøg gennem Entra igen — men kun ét (`f=1`).
    if (forsoegt) {
      return side("Login lykkedes ikke",
        "Vi kunne ikke bekræfte dit AO-login. Prøv igen, eller kontakt en administrator.", 401);
    }
    const tilbage = `/api/poc-login?returnTo=${encodeURIComponent(maal.toString())}&f=1`;
    return Response.redirect(
      new URL(`/api/auth/login?next=${encodeURIComponent(tilbage)}`, url.origin), 302);
  }

  if (!svar.ok) {
    console.error("poc-login: broen svarede", svar.status);
    return side("Login-tjenesten svarer ikke",
      "Prøv igen om lidt. Varer det ved, så kontakt en administrator.", 503);
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
    console.error("poc-login: intet token i svaret");
    return side("Login-tjenesten svarer ikke",
      "Prøv igen om lidt. Varer det ved, så kontakt en administrator.", 503);
  }

  const dest = new URL(maal.toString());
  dest.searchParams.set("pt", krop.token);
  return Response.redirect(dest.toString(), 302);
}
