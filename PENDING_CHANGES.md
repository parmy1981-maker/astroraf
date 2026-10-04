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
| 1 | Opstart local-host Bat-bestand | Portabel `.bat`-bestand (`start-local-server.bat`) om de lokale server handmatig te starten; dubbelklikken opent automatisch `http://localhost:8080/AstroRaf/`. Kopieerbaar naar een andere pc — enkel de `PROJECT_PATH`-regel bovenaan moet daar aangepast worden. | `a00e473` | In review |
