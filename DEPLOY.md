# aiao.dev — deploy

Selvstændige, statiske HTML-filer. Hver fil har logo, fonte, CSS og
komponent-bundle indlejret — ingen build, ingen afhængigheder at installere.

| Fil | Rute (Vercel) |
| --- | --- |
| `index.html` | `/` |
| `flow.html` | `/flow` |
| `repos.html` | `/repos` |
| `byg.html` | `/byg` |
| `ledelse.html` | `/ledelse` |
| `arkitektur.html` | `/arkitektur` |

`vercel.json` sætter `cleanUrls` → `flow.html` serveres på `/flow`,
`repos.html` på `/repos`, `byg.html` på `/byg`, `ledelse.html` på `/ledelse`. Intern navigation linker mellem siderne.

> **NB:** `/ledelse` ("Til ledelsen — sikkerhed og governance") er bevidst **ikke** i topmenuen — et delbart link, men stadig en del af sitet (klon af flow.html med ny `LedelsePage`-komponent + `active="ledelse"`, ingen menu-tilføjelse).

> **NB:** `/arkitektur` ("Arkitektur — fra bruger til POC i produktion") er ligeledes bevidst **ikke** i topmenuen — et delbart, teknisk link (vugge-til-grav-gennemgang). Lavet som klon af `ledelse.html`: kun manifest-entry `9804da45` (side-JSX) byttet + synlig `<title>` opdateret. Funktionsnavnet beholdt som `LedelsePage`, så template'ens `App()` virker uændret; ingen menu-/Topbar-ændring. Round-trip + Babel-valideret; de 16 øvrige bundle-entries er byte-identiske med `ledelse.html`.

> **NB:** `byg.html` ("Hvad kan jeg bygge?") er en HÅND-skrevet standalone-side
> (ikke en kompileret bundle), så den kan redigeres direkte. Topmenuen i de
> kompilerede sider (`index/flow/repos`) linker nu OGSÅ til `/byg` — tilføjet via
> bundle-kirurgi (2026-06-22): nav-linket blev indsat i både Topbar-entryens rå
> JSX og den transpilerede mega-entry, valid/round-trip-verificeret. Fremtidige
> menu-ændringer skal samme vej (eller via kilden `ui_kits/aiao-dev/` hvis den dukker op).

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

Rediger **ikke** disse filer direkte — de er kompilerede. Lav ændringer i
design-system-projektet (`ui_kits/aiao-dev/`) og gen-kompiler.
