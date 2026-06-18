# aiao.dev — deploy

Tre selvstændige, statiske HTML-filer. Hver fil har logo, fonte, CSS og
komponent-bundle indlejret — ingen build, ingen afhængigheder at installere.

| Fil | Rute (Vercel) |
| --- | --- |
| `index.html` | `/` |
| `flow.html` | `/flow` |
| `repos.html` | `/repos` |

`vercel.json` sætter `cleanUrls` → `flow.html` serveres på `/flow`,
`repos.html` på `/repos`. Intern navigation linker mellem siderne.

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
