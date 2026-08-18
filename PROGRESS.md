# AstroRaf.be — Voortgang

Laatste update: 2026-08-18 (avond)

## Status: v1.2 lokaal klaar, NOG NIET online gezet (wacht op akkoord gebruiker)

**BELANGRIJK — workflow-ontdekking:** Vercel's GitHub-integratie deployt automatisch naar productie bij elke `git push` naar `main`. Dus: lokaal werken/testen = geen `git push` doen. Pas na expliciet akkoord van de gebruiker pushen (en/of `vercel deploy --prod`) om live te gaan. Tot dan enkel lokaal committen.

## Gedaan
- [x] GitHub CLI, Git en Node.js lokaal geïnstalleerd en geconfigureerd
- [x] Ingelogd op GitHub als `parmy1981-maker`
- [x] Statische "under construction" pagina gemaakt (`index.html`, sterrenhemel-look, geen externe afbeelding nodig)
- [x] GitHub-repo aangemaakt en gepusht: https://github.com/parmy1981-maker/astroraf
- [x] Vercel CLI geïnstalleerd + ingelogd (account: parmy1981-6326, team scope: woutp / "Wouter's projects" — bevestigd dat dit van de gebruiker is)
- [x] Project gedeployed op Vercel: https://astroraf.vercel.app (project `astroraf` onder team `woutp`)
- [x] Custom domains `astroraf.be` en `www.astroraf.be` toegevoegd in Vercel
- [x] DNS-records ingesteld bij one.com voor astroraf.be — **live en geverifieerd** (2026-08-18)
- [x] Custom domains `astroraf.com` en `www.astroraf.com` toegevoegd in Vercel
- [x] DNS-records ingesteld bij one.com voor astroraf.com (2026-08-18) — nog niet gepropageerd, werkt nog niet onmiddellijk
- [ ] Supabase project aangemaakt (nog niet nodig voor under-construction pagina, later voor echte features)

## Volgende stap
Wachten op DNS-propagatie voor **astroraf.com** (records staan al sinds 2026-08-18, kan tot enkele uren duren). Gebruiker checkt morgen (2026-08-19) opnieuw. Als het dan nog niet werkt: vraag Claude Code om `vercel domains inspect astroraf.com` te draaien om te verifiëren wat er misloopt.

(Zelfde recept werd al succesvol toegepast voor astroraf.be, zie hierboven — dat propageerde wel snel.)

## Belangrijke gegevens
- Domeinen: astroraf.be (live) en astroraf.com (DNS nog te configureren — zie boven), beide via one.com
- GitHub account: parmy1981-maker
- GitHub repo: https://github.com/parmy1981-maker/astroraf
- Vercel account: parmy1981-6326, team/scope: woutp ("Wouter's projects")
- Vercel project: astroraf → https://astroraf.vercel.app
- Database/backend (later): Supabase — nog niet opgezet

## Versiegeschiedenis
- v1.2 (2026-08-18, lokaal — nog niet live) — volledige home page opgebouwd: sticky header met logo + menu (Home/Foto's/Shop), grote hero met sterrenhemel + eclips-foto (Eclips_Corona.jpg, cirkelvormig bijgesneden met vervagende rand + backdrop-gat tegen doorschijnende sterren), verhaal-sectie (placeholder tekst), fotogrid (placeholders), footer-balk met social-iconen (placeholder links). Foto's/Shop als "binnenkort"-pagina's.
- v1.1 (2026-08-18) — versienummer toegevoegd in de footer van de pagina
- v1.0 (2026-08-18) — initiële under-construction pagina live op astroraf.be

## Beslissingen
- Gestart met een simpele statische HTML-pagina (geen framework) voor snelheid. Kan later migreren naar Next.js wanneer er echte features (bv. met Supabase) bijkomen.
- Placeholder-foto is CSS-gegenereerde sterrenhemel, geen echte afbeelding — makkelijk later te vervangen door een echte astrofoto.
