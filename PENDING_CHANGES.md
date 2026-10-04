# Pending changes — ter review

Vertrekpunt: **v1.5.4** (commit `4e8b08f`, dit is ook de laatste versie op `main`).

Dit bestand houdt alle losse wijzigingen bij die Wouter lokaal test op deze pc, op de branch
`pending-changes`. Elke regel hieronder staat voor één afgeronde, afzonderlijke wijziging, met
de commit waarin ze zit. De andere gebruiker overloopt dit lijstje samen met Claude op zijn eigen
pc/local-host en beslist per wijziging: aanvaarden (gaat mee naar de volgende versie) of
verwerpen (blijft achterwege).

Zolang wijzigingen enkel op deze branch staan, raken ze **main niet** en wordt er dus niets
automatisch live gezet door Vercel.

## Hoe dit werkt
1. Wouter test een wijziging lokaal op `http://localhost:8080/AstroRaf/`.
2. Wanneer die ene wijziging klaar is, zegt Wouter dit tegen Claude en geeft er een korte naam
   (label) aan.
3. Claude committeert die wijziging apart op de `pending-changes`-branch en voegt een rij toe
   aan de tabel hieronder.
4. Claude pusht de branch naar GitHub (`origin/pending-changes`) zodat de andere gebruiker ze
   kan ophalen.
5. De andere gebruiker overloopt de tabel + commits met zijn eigen Claude, en beslist per item.
   Aanvaarde wijzigingen worden samengevoegd in een nieuwe versie op `main`.

## Wijzigingen

| # | Label | Beschrijving | Commit | Status |
|---|-------|--------------|--------|--------|
| 1 | Opstart local-host Bat-bestand | Portabel `.bat`-bestand (`start-local-server.bat`) om de lokale server handmatig te starten; dubbelklikken opent automatisch `http://localhost:8080/AstroRaf/`. Kopieerbaar naar een andere pc — enkel de `PROJECT_PATH`-regel bovenaan moet daar aangepast worden. Later gefixt: gebruikt nu een eigen map/poort-check zodat het niet botst met een eventuele autostart-service op dezelfde pc. | `a00e473`, fix in `20cb6f3` | In review |
| 2 | Intro tekst/foto uitbreiding | In de verhaal-intro: &ldquo;Astrolab IRIS&rdquo; gelinkt naar astrolab.be/bezoek; nieuwe foto + onderschrift van de campinggroep (&ldquo;De Bende&rdquo;, licht ingezoomd); nieuwe foto + onderschrift &ldquo;We staan paraat&rdquo;; nieuwe foto + onderschrift &ldquo;De fysicus&rdquo; (zin verplaatst van lopende tekst naar onderschrift); slotzin aangevuld tot &ldquo;En zo is het ontstaan van AstroRaf begonnen.&rdquo;; officieel logo toegevoegd onder de tekst, gecentreerd, 50% vergroot. | `6e2abd3` | In review |
| 3 | Het verhaal | Scroll-hint onderaan de hero (pijl omlaag, &ldquo;Lees het verhaal&rdquo;, pijl omlaag), klikbaar en scrollt vloeiend naar de verhaal-sectie; subtiel gehouden zodat de startpagina niet verdoezeld wordt. | `f768361` | In review |
| 4 | De Eclips | De eclips-foto rechtsonder in de hero wordt niet langer hard afgesneden; bij het scrollen loopt de foto door (incl. het stukje handtekening dat voorheen verborgen bleef), met genoeg ruimte zodat dit de verhaal-titel niet overlapt. | `8aa7a83` | In review |
| 5 | Het logo | Echte logo links in de menubalk i.p.v. de signatuur (die blijft in het midden van de startpagina); nav naar het midden, taalknoppen naar rechts; menubalk/voettekst-achtergrond gebaseerd op de kleur uit het logo (`#001534`); logo bijgesneden en groter weergegeven zonder dat de menubalk hoger wordt. | `6190735` | In review |
| 6 | Crash site | De &ldquo;Home&rdquo;-link en het logo verwezen naar `index.html`, wat op de lokale dev-server via dubbele redirect naar een pad zonder slash leidde en daardoor alle css/js/foto&rsquo;s liet breken. Links aangepast naar `./` (relatief), werkt correct met of zonder `/AstroRaf`-submap, op elke pc en op de live site. | `adf365d` | In review |
