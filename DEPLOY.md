# aiao.dev — deploy

Selvstændige, statiske HTML-filer. Hver fil har logo, fonte, CSS og
komponent-bundle indlejret — ingen build, ingen afhængigheder at installere.

| Fil | Rute (Vercel) |
| --- | --- |
| `index.html` | `/` |
| `flow.html` | `/flow` |
| `repos.html` | `/repos` |
| `byg.html` | `/byg` |
| `start.html` | `/start` |
| `ledelse.html` | `/ledelse` |
| `arkitektur.html` | `/arkitektur` |

`vercel.json` sætter `cleanUrls` → `flow.html` serveres på `/flow`,
`repos.html` på `/repos`, `byg.html` på `/byg`, `ledelse.html` på `/ledelse`. Intern navigation linker mellem siderne.

> **NB:** `/ledelse` ("Til ledelsen — sikkerhed og governance") er bevidst **ikke** i topmenuen — et delbart link, men stadig en del af sitet (klon af flow.html med ny `LedelsePage`-komponent + `active="ledelse"`, ingen menu-tilføjelse).

> **NB:** `/arkitektur` ("Arkitektur — fra bruger til POC i produktion") er ligeledes bevidst **ikke** i topmenuen — et delbart, teknisk link (vugge-til-grav-gennemgang). Lavet som klon af `ledelse.html`: kun manifest-entry `9804da45` (side-JSX) byttet + synlig `<title>` opdateret. Funktionsnavnet beholdt som `LedelsePage`, så template'ens `App()` virker uændret; ingen menu-/Topbar-ændring. Round-trip + Babel-valideret; de 16 øvrige bundle-entries er byte-identiske med `ledelse.html`.

> **NB (2026-07-08):** `repos.html` har nu — ud over "Åbn brugerguide/løsningsbeskrivelse"-knapperne —
> også en ejer-handling **"Anmod om test"** (`POST /pocs/{poc}/promote` via samme inline-login-mønster
> som doc-generering; serveren håndhæver ejer/admin). Da `repos.html` er hånd-skrevet, redigeres den
> direkte — ingen bundle-kirurgi.

> **NB (2026-07-26) — `repos.html` har nu TRE ejer-slidere i provider-rækken:** **Login**
> (`adgang` — appens sider bag AIAO-login) · **API** (`api_adgang` — appens egen backend, skive 3) ·
> **Privat** (`synlighed` — listning). Alle tre kun på egne kort (`r.is_mine`). To regler der er
> nemme at bryde:
> 1. **Layout:** den FØRSTE slider bærer rækkens `margin-left:auto`; de øvrige sætter
>    `margin-left:0` inline. Ellers deler flere `.cp-privtoggle` friarealet ligeligt og strander
>    midt i rækken. Samme regel gælder en evt. fjerde slider.
> 2. **API-slideren rendres ALTID** (for egne kort) men med `display:none` når siderne er åbne —
>    den kræver side-loginet (serveren afviser kombinationen med 400). En betinget render ville få
>    slideren til at "forsvinde" indtil et reload, fordi `toggleAdgang` bevidst ikke gentegner
>    kortet. `toggleAdgang` viser/skjuler den i stedet lokalt og nulstiller den til "Åben" når
>    siderne åbnes (serveren frigiver samtidig API-låsen — spejl den, ellers lyver slideren).
>
> **Sådan verificeres slider-TILSTANDE før push** (Entra-gaten blokerer maskin-tjek af det live
> site, og et screenshot alene er ikke nok — det viser kun de øverste kort, og sammenklappede kort
> skjuler hele `.cp-card__details` hvor sliderne bor):
> 1. `node --check` på det inline-script (klip det ud af HTML'en først).
> 2. Lav en kopi hvor `window.fetch` er stubbet med kort der dækker ALLE kombinationer
>    (egen/andens · sider låst/åben · API låst/åben), plus et lille script der kører
>    `document.querySelectorAll('.cp-card').forEach(c => c.classList.add('open'))`.
> 3. `msedge --headless --disable-gpu --virtual-time-budget=9000 --dump-dom file:///…` → tæl
>    `data-adg` / `data-apiadg` / `data-vis` pr. kort og læs `display` på `#apitog-<poc>`.
> 4. Evt. `--screenshot` til et visuelt tjek af at rækken ikke ombryder.
>
> ⚠️ **Klip ALDRIG kortene ud af DOM'en med regex** (fx "fra `vscode-<poc>` til næste kort") —
> udsnittet løber ind i nabokortet og giver falske fund. Det skete 2026-07-26: en assertion
> "meldte" slidere på et kort der ikke havde nogen. Tæl `data-`attributter, eller brug
> `closest('.cp-card')` inde i siden.

> **NB (status pr. 2026-07-02):** `repos.html` og `start.html` er de eneste HÅND-skrevne
> standalone-sider (vedligeholdelig kilde — kan redigeres direkte); `byg.html` er
> siden blevet en kompileret bundle som `index/flow`. Menu-ændringer i de
> kompilerede sider sker via bundle-kirurgi: nav-linket indsættes i BÅDE
> Topbar-entryens rå JSX og den transpilerede mega-entry (begge sætter
> `window.Topbar`), syntaks-valideres (esbuild/`node --check`), re-encodes
> (gzip+base64) og round-trip-verificeres. Præcedens: `/byg`-linket (2026-06-22)
> og `/start`-linket (2026-07-02, i `index/flow/byg`). Fremtidige menu-ændringer
> skal samme vej (eller via kilden `ui_kits/aiao-dev/` hvis den dukker op).

> **NB:** `start.html` ("Start din POC her") er hånd-skrevet som `repos.html`
> (topbar/footer klonet derfra) og indlejrer interview-botten `poc37.aiao.dev`
> i en iframe. Fallback-link "Åbn interviewet i ny fane" vises altid under iframen.
> Forudsætter at poc37 tillader framing fra `www.aiao.dev` (styres i poc37, ikke her).
>
> **iframe `allow` (2026-07-20):** `allow="microphone; clipboard-write; fullscreen"` +
> `allowfullscreen`. Hver rettighed SKAL delegeres til den cross-origin iframe, ellers
> blokerer browseren funktionen indefra i poc37: `microphone` = tale, `clipboard-write`
> = bottens "Kopiér"-knap (uden den fejlede den tavst), `fullscreen` = fuldskærm.
>
> **Layout (2026-07-20):** app-shell — `body` er en flex-kolonne på `100dvh`, `main` er
> `flex:1` med `min-height:0` hele vejen, så bot-iframen fylder al resterende højde og
> KUN scroller internt. Overskrift, en vejlednings-boks ("Når du har din prompt …"),
> en `⤢ Fuld skærm`-knap og en kompakt footer er altid synlige uden at scrolle siden.
> Fuldskærm-knappen fuldskærmer `.bot-frame`-*containeren* (ikke bare iframen), så en
> `✕ Luk fuld skærm`-chip kan ligge oven på (vises kun i fuldskærm; Esc virker også).
>
> **Verifikation:** `www.aiao.dev` er Entra-gated → kan ikke curl-render-tjekkes. Render i
> stedet lokalt headless (Edge `--headless=new --virtual-time-budget=2500 --screenshot`,
> med iframe-src stubbet til en tall placeholder) for at bekræfte layout uden at scrolle.
> Bekræft altid visuelt efter deploy (git-reversibelt).

> **NB (2026-07-28) — OPLÆG-rækken på `/repos`:** kortenes Dokumentation-panel har nu en
> **Præsentation**-række: **LAV PRÆSENTATION** første gang, derefter grøn **HENT** (PowerPoint-filen,
> `GET /pocs/{poc}/praesentation.pptx`) + hvid **GENGENERÉR**. Genereringen spørger først om længden
> i en dialog (`#praesBg`) og sender `{"laengde":"kort"|"fuld"}` til
> `POST /pocs/{poc}/docs/praesentation`.
>
> ⚠️ **Rækkefølge: rækken forudsætter at CONTROL-PLANEN er deployet FØRST** — den læser feltet
> `praesentation_opdateret` på `/public/repos`. Pushes denne side før backenden, mangler feltet, og
> hvert af byggerens EGNE kort viser "endnu ikke genereret" + **LAV PRÆSENTATION** — også for POC'er
> der HAR et oplæg; klikker han LAV, overskrives det `docs/praesentation.md` han eventuelt har
> hånd-rettet. Den omvendte rækkefølge (backend først, Landing senere) er derimod **uskadelig** —
> feltet ligger blot ubrugt i JSON'en. NB: repoet har ingen grenkonvention — alt ligger på `main`, så
> et hastefix på fx `byg.html` trækker ALLE tidligere `main`-commits med ud (også denne række).
> Kør `git log origin/main..main` før du pusher, så du ved hvad der følger med.
>
> To invarianter der er nemme at bryde:
> 1. **Der må ALDRIG være en ÅBN-knap (`data-view="praesentation"`) på denne side.** Manuskriptet
>    indeholder talepapir og ligger bevidst UDEN for den login-frie `/public/docs`-vej → et ÅBN her
>    ville svare 404. Derfor har `HJAELP.praesentation` ingen `aabn`-nøgle, og `openCellHtml()`
>    sætter HENT i kolonnen hvor de øvrige dokumenter har ÅBN. ÅBN af manuskriptet findes på
>    `admin.aiao.dev` (dér er kaldet autentificeret).
> 2. **Rækken rendres kun ved `r.is_mine`** (`praesRow2` returnerer "" ellers): backenden sender kun
>    `praesentation_opdateret` for kalderens EGNE POC'er, så `null` betyder både "intet oplæg" og
>    "ikke dit kort" — klienten kan ikke skelne, og rækken ville stå tom og forvirrende for andre.
>
> Præsentationen er BEVIDST ikke med i forfremmelses-gaten (`promoMissing`) — den ville ellers
> blokere "Anmod om test" for alle POC'er uden oplæg. Længde-dialogens tekster (overskrift,
> forklaring, de to knap-labels + tooltips) er ordret admin-dashboardets
> `PresentationLengthDialog.tsx` — **hold de to i sync**, som med kort-designet og
> forfremmelses-loggen. HENT er desuden erstattet af vente-pladsholderen mens der genereres
> (`putWait` er altid sand for denne kind): stod den klikbar, ville man tavst hente det GAMLE
> oplæg og tro at succes-kvitteringen bagefter gjaldt filen man lige fik.

> React + Babel hentes fra unpkg-CDN ved runtime (kræver internet — fint for et
> live site). Alt andet er indlejret.

## Sådan får I det live

**1) Push til repoet** (fx `AIAODEV/aiao-landing`):

```bash
# fra denne deploy-mappe
git init
git add .
git commit -m "aiao.dev landing: forside, flow, POC-oversigt"
git branch -M main
git remote add origin git@github.com:AIAODEV/aiao-landing.git
git push -u origin main
```

**2) Forbind til Vercel:** opret et projekt fra repoet (Framework preset:
*Other* / statisk — ingen build-kommando), eller kør `vercel` i mappen.

**3) Domæne:** sæt `aiao.dev` på projektet. Så er forsiden på `aiao.dev`,
flowet på `aiao.dev/flow`, oversigten på `aiao.dev/repos`.

## Ændringer

**To slags sider — vær sikker på hvilken du redigerer:**

- **Hånd-skrevne (redigeres DIREKTE):** `repos.html` og `start.html`. Der findes ingen kilde
  bag dem; filen ER kilden. Alle NB-blokkene ovenfor om `/repos` gælder her.
- **Kompilerede bundles (redigér IKKE direkte):** `index.html`, `flow.html`, `byg.html`,
  `ledelse.html`, `arkitektur.html`. De består af en JSON-manifest med gzip+base64-entries.
  Lav ændringer i design-system-projektet (`ui_kits/aiao-dev/`) og gen-kompilér — eller, hvis
  kilden ikke er ved hånden, via bundle-kirurgi (gunzip → redigér BÅDE den rå JSX-entry og dens
  transpilerede tvilling → esbuild-validér → re-encode → round-trip-verificér), se NB'en om
  menu-ændringer ovenfor.

## Favicon

`/favicon.ico` i roden er sidens ikon for **alle** sider, og hver side har en eksplicit
`<link rel="icon" href="/favicon.ico" sizes="any">` i sin `<head>` (indsat i den ALMINDELIGE
tekst-head — ingen bundle-kirurgi).

Baggrund: de kompilerede sider (index/flow/byg/ledelse/arkitektur) bar allerede et ikon *inde i*
bundlen som en UUID-asset, mens de håndskrevne sider (`start.html`, `repos.html`) ikke gjorde —
derfor manglede `/start` et faneblads-ikon, og `/favicon.ico` svarede 404.

Ikonet er **det samme logo som topbaren viser**: `favicon.ico` er genereret ud af den base64-PNG
der står i topbar-markup'en (256×256, pakket i en ægte ICO-container med PNG-payload). Skal det
skiftes, så skift logoet og gen-generér ikonet ud fra det — så kan de to ikke komme ud af sync.
`favicon.ico` er bevidst undtaget fra Entra-gaten i `middleware.ts` (matcheren), så ikonet også
kan hentes uden session.
