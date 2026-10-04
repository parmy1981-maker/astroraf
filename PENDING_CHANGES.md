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
| 7 | De foto&rsquo;s | &ldquo;Bekijk alle foto&rsquo;s&rdquo; hernoemd naar &ldquo;Ga naar alle albums&rdquo; (klopt beter met de bestemming); een foto sluiten die je vanaf de homepage opende brengt je nu terug naar de homepage i.p.v. onverwacht op de album-pagina te blijven staan &mdash; behalve als je eerst via de pijltjestoetsen door het album bladerde, dan blijf je bewust in dat album. | `d87e089` | In review |
| 8 | Supabase keep-alive automatisering | GitHub Action die elke 3 dagen een rij logt in Supabase (tabel `keep_alive_log`), zodat het gratis Supabase-project niet na 7 dagen inactiviteit pauzeert. **Let op:** vereist een GitHub-secret `SUPABASE_SERVICE_ROLE_KEY` (al toegevoegd) en wordt pas echt actief na het mergen naar `main` &mdash; GitHub evalueert geplande workflows enkel vanaf de default branch. | `a5ecc53` | In review |
| 9 | Database likes + automatische top 6 | Likes draaien nu via een echte Supabase-database (Postgres + RLS + anonieme sessie per bezoeker) i.p.v. enkel lokale browseropslag; naast het hartje staat het werkelijke totaal; de homepage-galerij toont automatisch de top 6 meest-gelikete foto&rsquo;s met een linkje naar hun album en het totaal aantal likes (foto&rsquo;s zonder likes worden niet getoond; zonder likes blijft de bestaande vaste selectie staan, nu ook met zichtbaar like-aantal). Extra beveiliging: max. 5 likes per IP-adres per foto (voorkomt misbruik via incognito-vensters, zonder gedeelde IP's zoals een gezin/kantoor helemaal te blokkeren); land van de bezoeker wordt mee gelogd (via Cloudflare, geen externe dienst nodig). Beide getest: na 5 likes vanaf hetzelfde IP met telkens een nieuwe anonieme sessie wordt de 6de terecht geweigerd; land ("BE") werd correct gelogd. **Let op:** vereist het Supabase-project `fqjlfonsdazjwgwchvko` (reeds opgezet, met GitHub-secret voor de keep-alive) &mdash; er staan nog test-rijen (1 like op Eclips_Start.jpg, 5 testlikes op een niet-bestaande foto &ldquo;TEST_IP_CAP.jpg&rdquo;) die opgeruimd mogen worden vóór een echte lancering. IP/land worden bijgehouden onder &ldquo;gerechtvaardigd belang&rdquo; (misbruik tegengaan) &mdash; de site heeft hiervoor nog geen privacyverklaring-pagina, dat staat nog open als afzonderlijk te bespreken item. Ook de 3 verhaal-foto's op de homepage (De bende, We staan paraat, De fysicus) zijn nu likebaar, maar komen bewust niet in aanmerking voor de top 6 (die blijft albums-only). | `e9509e4`, uitbreiding in `9358d35`, `46f2ea3` | In review |
