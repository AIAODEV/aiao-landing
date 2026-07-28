# Changelog — AIAO-Landing (`www.aiao.dev`)

Nævneværdige ændringer i landing-sitet. Startet 2026-07-28; ældre ændringer står i git-historikken
og i `DEPLOY.md` (som fortsat holder deploy-mekanikken og bundle-kirurgi-noterne).

## [Unreleased]

### Tilføjet — OPLÆG-rækken på `/repos` (POC-præsentation, skive 2)
- Nyt **OPLÆG**-felt i kortets Dokumentation-panel (`repos.html`): **LAV PRÆSENTATION** første gang,
  derefter grøn **HENT** (PowerPoint-filen) + hvid **GENGENERÉR**. Byggeren kan dermed lave og hente
  sit oplæg dér hvor han i forvejen arbejder — samme flade som brugerguide/løsningsbeskrivelse/Snyk.
- **Længde-valget** ("Hvor langt skal oplægget være?" → *Kort oplæg (5 min)* / *Fuldt oplæg* /
  *Annullér*) i sidens eksisterende modal-mønster. Valget sendes som `{"laengde":…}` til
  `POST /pocs/{poc}/docs/praesentation`. Spørgsmålet handler bevidst om MØDET, ikke om POC'ens
  størrelse: omfanget følger indholdet, men hvor lang tid man har, ved kun byggeren.
- **HENT** kalder `GET /pocs/{poc}/praesentation.pptx` (kræver login, alle roller) og gemmer filen
  som `<slug>-praesentation.pptx` via et midlertidigt objekt-URL på et skjult `<a download>`.
- Rækken vises **KUN på egne kort** (`is_mine`): tidsstemplet `praesentation_opdateret` sendes kun
  for kalderens egne POC'er, så rækken ville være tom og forvirrende for alle andre.
- **Ingen ÅBN-knap her** — manuskriptet er talepapir og ligger bevidst uden for den login-frie
  `/public/docs`-vej (ÅBN findes på `admin.aiao.dev`, hvor kaldet er autentificeret).
- **Forfremmelses-gaten er urørt:** et oplæg er IKKE et krav for "Anmod om test" (ville ellers
  blokere forfremmelse for alle POC'er uden oplæg).
- `runDoc` fik en valgfri `body`-parameter (de øvrige dokument-typer kalder uændret), og
  ÅBN/HENT-kolonnen bygges nu ét sted (`openCellHtml`) — både ved render og efter en generering.
