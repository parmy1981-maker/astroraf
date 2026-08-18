# AstroRaf.be — Voortgang

Laatste update: 2026-08-18

## Status: Under construction pagina live (in opbouw)

## Gedaan
- [x] GitHub CLI, Git en Node.js lokaal geïnstalleerd en geconfigureerd
- [x] Ingelogd op GitHub als `parmy1981-maker`
- [x] Statische "under construction" pagina gemaakt (`index.html`, sterrenhemel-look, geen externe afbeelding nodig)
- [x] GitHub-repo aangemaakt en gepusht: https://github.com/parmy1981-maker/astroraf
- [x] Vercel CLI geïnstalleerd + ingelogd (account: parmy1981-6326, team scope: woutp / "Wouter's projects" — bevestigd dat dit van de gebruiker is)
- [x] Project gedeployed op Vercel: https://astroraf.vercel.app (project `astroraf` onder team `woutp`)
- [x] Custom domains `astroraf.be` en `www.astroraf.be` toegevoegd in Vercel
- [ ] DNS-records ingesteld bij one.com — **wacht op gebruiker**, zie hieronder
- [ ] Domain-verificatie bevestigen zodra DNS live staat
- [ ] Supabase project aangemaakt (nog niet nodig voor under-construction pagina, later voor echte features)

## Volgende stap
DNS-records instellen bij one.com (registrar), user moet dit zelf doen daar Claude geen toegang heeft tot het one.com-account:

| Type | Naam/Host | Waarde |
|------|-----------|--------|
| A | `@` | `76.76.21.21` |
| A | `www` | `76.76.21.21` |

Verwijder eventuele bestaande one.com parkeerpagina A-records voor `@`/`www` eerst. Na het instellen: vraag Claude Code om `vercel domains inspect astroraf.be` te draaien om te verifiëren of DNS goed staat (propagatie kan uren duren).

## Belangrijke gegevens
- Domein: astroraf.be (aangekocht via one.com, DNS nog te configureren — zie boven)
- GitHub account: parmy1981-maker
- GitHub repo: https://github.com/parmy1981-maker/astroraf
- Vercel account: parmy1981-6326, team/scope: woutp ("Wouter's projects")
- Vercel project: astroraf → https://astroraf.vercel.app
- Database/backend (later): Supabase — nog niet opgezet

## Beslissingen
- Gestart met een simpele statische HTML-pagina (geen framework) voor snelheid. Kan later migreren naar Next.js wanneer er echte features (bv. met Supabase) bijkomen.
- Placeholder-foto is CSS-gegenereerde sterrenhemel, geen echte afbeelding — makkelijk later te vervangen door een echte astrofoto.
