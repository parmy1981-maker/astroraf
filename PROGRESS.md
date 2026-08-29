# AstroRaf.be — Voortgang

Laatste update: 2026-08-29

## Status: v1.4 lokaal klaar, NOG NIET online gezet (wacht op akkoord gebruiker)

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
- v1.4 (2026-08-29, lokaal — nog niet live) — Shop-pagina ingevuld: intro-tekst, twee kaarten (Posters en T-shirts) met icoon, korte beschrijving en "Binnenkort"-badge, en een afsluitend tekstblokje over de opbouw van de shop; alles vertaalbaar via de bestaande taalknop; ongebruikte `.stub-page`-stijl opgeruimd. Daarna uitgebreid met een echte poster-bestelflow: klik op de "Posters"-kaart opent een menu met de 3 eclips-foto's, per foto een aantal-kiezer (+/-) en een "Toevoegen aan winkelmandje"-knop; winkelmandje-icoontje rechtsboven in de header (onder het menu, op alle pagina's), met een afgerond balkje dat het aantal items toont; klik erop opent een paneel waar je items kan bijstellen of verwijderen (nieuw bestand `cart.js`, data zit in localStorage, geen echte afrekenflow — dat komt later met Supabase)
- v1.3.1 (2026-08-29, lokaal — nog niet live) — echt logo (handschrift "AstroRaf") toegevoegd i.p.v. tekst: uit de door gebruiker aangeleverde foto (zwarte achtergrond) een transparante PNG uitgeknipt (`foto's/Logo_AstroRaf.png`, via lokaal Node/Jimp-scriptje, luminantie-drempel als alphakanaal + autocrop); header herschikt naar taalkeuze links / logo gecentreerd / menu rechts (grid-layout, met mobiele fallback die stapelt); grote "AstroRaf"-tekst in de hero op de homepage vervangen door hetzelfde logo (met gloei-effect), gewikkeld in een `<h1>` zodat de pagina een geldige hoofdheading behoudt
- v1.3 (2026-08-24, lokaal — nog niet live) — Foto's-pagina herbouwd als klikbare albums (`gallery.js`): tegel "Zonsverduistering" opent de 3 eclips-foto's, klik op een foto opent een lightbox (vergroot, sluiten via kruisje/buiten klikken/Escape); bugfix waarbij het `hidden`-attribuut werd overschreven door `display:grid` (globale `[hidden]{display:none!important}`-regel toegevoegd); albumtegels vergroot zodat er net 3 naast elkaar passen; titel "Foto's" hernoemd naar "Albums", hoger geplaatst met meer ruimte tot de albums; foto's op de homepage linken nu naar het juiste album op de Foto's-pagina én openen daar automatisch dezelfde foto vergroot (via URL-hash `#album:bestandsnaam`); albums vertaalbaar via bestaande taalknop
- v1.2.1 (2026-08-24, lokaal — nog niet live) — echt verhaal van AstroRaf toegevoegd in de verhaal-sectie (spelling/zinsbouw gecorrigeerd, inhoud van gebruiker), bedankingsparagraaf toegevoegd, "Under construction"-badge en scroll-cue-balkje uit de hero verwijderd, hero-tagline aangepast naar "De sterrenhemel is er speciaal voor jou.", echte eclips-foto's (Start/Corona/Einde) in de fotogrid gezet, kaders van de fotogrid aangepast naar 16:9 (echte fotoverhouding), zoom-in hover-animatie op de foto's toegevoegd, taalknop (NL/EN/FR/DE) toegevoegd in de header met volledige vertaling van alle site-tekst (`i18n.js`), keuze wordt onthouden via localStorage
- v1.2 (2026-08-18, lokaal — nog niet live) — volledige home page opgebouwd: sticky header met logo + menu (Home/Foto's/Shop), grote hero met sterrenhemel + eclips-foto (Eclips_Corona.jpg, cirkelvormig bijgesneden met vervagende rand + backdrop-gat tegen doorschijnende sterren), verhaal-sectie (placeholder tekst), fotogrid (placeholders), footer-balk met social-iconen (placeholder links). Foto's/Shop als "binnenkort"-pagina's.
- v1.1 (2026-08-18) — versienummer toegevoegd in de footer van de pagina
- v1.0 (2026-08-18) — initiële under-construction pagina live op astroraf.be

## Beslissingen
- Gestart met een simpele statische HTML-pagina (geen framework) voor snelheid. Kan later migreren naar Next.js wanneer er echte features (bv. met Supabase) bijkomen.
- Placeholder-foto is CSS-gegenereerde sterrenhemel, geen echte afbeelding — makkelijk later te vervangen door een echte astrofoto.
