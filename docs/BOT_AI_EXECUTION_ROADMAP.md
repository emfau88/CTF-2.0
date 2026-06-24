# Bot AI Execution Roadmap

Stand: 2026-06-23

## Ziel

Bots sollen in `TDM`, `Classic CTF` und `One Flag` sichtbar passend zum
jeweiligen Spielmodus handeln und von `1v1` bis `4v4` stabil funktionieren.

Wichtig: Diese Roadmap ist bewusst auf kleine, messbare Arbeitspakete
geschnitten. Keine grosse Bot-Architektur wird eingefuehrt, bevor Verhalten
reproduzierbar gemessen werden kann.

## Arbeitsregeln

- Keine V1-Dateien anfassen, ausser explizit beauftragt.
- Keine neue dritte Architektur.
- Bot-Probleme zuerst reproduzieren, dann lokal fixen.
- Keine Bot-Entscheidungslogik ohne Szenariotest oder Diagnosebeleg aendern.
- Vor Push mindestens:
  - `npm.cmd test`
  - `npm.cmd run build`
  - bei Bot-Arbeit zusaetzlich `npm.cmd run bot:diagnostics`

## Bulk 1: Szenariotests und Diagnose-Basis

Ziel: Pro Modus mindestens einen konkreten, reproduzierbaren Verhaltensanker
haben.

### Status

- [x] Bot-Diagnoseartefakte schreiben:
  - `diagnostics/bots/latest.json`
  - `diagnostics/bots/latest.md`
  - `diagnostics/bots/history/<timestamp>.json`
- [x] One Flag / Grand Archive / Escort-Carrier-Hotzone Szenariotest.
- [x] Classic CTF / Flank Switch / Own Flag Stolen Szenariotest.
- [x] TDM / Training Crossing / Low Health vs Enemy Szenariotest.

### Aktueller Befund

#### One Flag / Grand Archive / Escort-Carrier

Der isolierte Test reproduziert ein blocked raw escort goal, aber der
Controller projiziert auf ein nutzbares Ziel und erzeugt Fortschritt.

Interpretation:

- Kein belegter harter Pathfinder-Fehler.
- Zielprojektion wirkt in diesem Fall als funktionierende Kompensation.
- Combat-Standoff ist in diesem isolierten Fall nicht als Problem belegt.

#### Classic CTF / Flank Switch / Own Flag Stolen

Der isolierte Test zeigt, dass ein Red-Bot bei gestohlener Red-Flag
durchgehend `recover-own-flag` waehlt und Distanz zum Blue-Carrier reduziert.

Interpretation:

- Zielwahl fuer diesen Recovery-Fall ist belegt korrekt.
- Navigation ist in diesem Szenario nicht auffaellig.
- Rollenlogik ist in diesem Szenario nicht als Problem belegt.

#### TDM / Training Crossing / Low Health vs Enemy

Der isolierte Test zeigt, dass ein Low-Health-Bot ein erreichbares
Health-Pickup gegenueber einem sichtbaren Gegner priorisiert, es einsammelt
und danach wieder zum Gegner wechseln darf.

Interpretation:

- Health-Pickup-Priorisierung ist in diesem kontrollierten Fall belegt.
- Ein spaeterer Wechsel zum Gegner nach Pickup ist erwartetes Verhalten.
- 4v4-Qualitaet und Pickup-Konflikte sind dadurch noch nicht belegt.

## Bulk 2: Diagnose-Report um Szenarien erweitern

Ziel: Die isolierten Szenariotests sollen nicht nur in `npm.cmd test` laufen,
sondern auch als kompakte Baseline im Bot-Diagnose-Report sichtbar werden.

Tasks:

- [x] One Flag Escort/Carrier Szenario in `latest.json` und `latest.md`
      zusammenfassen.
- [x] Classic CTF Own-Flag-Stolen Szenario in `latest.json` und `latest.md`
      zusammenfassen.
- [x] TDM Low-Health-vs-Enemy Szenario in `latest.json` und `latest.md`
      zusammenfassen.
- [x] Markdown-Kurzurteil je Szenario ausgeben.

### Status

Die Bot-Diagnoseartefakte enthalten jetzt neben Matrix und One-Flag-Detail
einen eigenen `scenarioBaselines`-Block:

- One Flag / Grand Archive / Escort-Carrier-Hotzone.
- Classic CTF / Flank Switch / Own Flag Stolen.
- TDM / Training Crossing / Low Health vs Enemy.

Damit sind die drei isolierten Verhaltenstests sowohl in `npm.cmd test` als
auch in `npm.cmd run bot:diagnostics` sichtbar.

## Bulk 3: Intent-Sichtbarkeit

Ziel: Jeder Bot soll im Test und in der Diagnose erklaerbar machen, was er
gerade tun will.

Tasks:

- [x] Gemeinsames Diagnoseformat fuer Bot-Intents definieren.
- [x] TDM-Intent sichtbar machen:
  - `fight-enemy`
  - `seek-health`
  - `seek-armor` noch nicht gemessen
  - `seek-weapon` noch nicht gemessen
  - `hold-standoff` noch nicht gemessen
- [x] Classic-CTF-Intent sichtbar machen:
  - `recover-own-flag`
  - `attack-flag`
  - `escort-carrier` in Szenario-Baseline aktuell nicht ausgeloest
  - `defend-base` in Szenario-Baseline aktuell nicht ausgeloest
  - `patrol-base` in Szenario-Baseline aktuell nicht ausgeloest
  - `support-mid` in Szenario-Baseline aktuell nicht ausgeloest
- [x] One-Flag-Intent auf dasselbe Format bringen:
  - `take-center-flag`
  - `capture-flag`
  - `escort-carrier`
  - `chase-enemy-carrier`
  - `control-mid` noch nicht gemessen

### Status

Die Szenario-Baselines im Diagnose-Report enthalten jetzt pro relevanten Bot
einen normalisierten `intent`-Block:

- `actorId`
- `mode`
- `framesByIntent`
- `primaryIntent`
- `totalMeasuredFrames`
- `unmeasured`

Wichtig: Das ist Diagnose-Instrumentierung, keine neue Bot-Entscheidung.
TDM nutzt jetzt Controller-Debug-Intents als Intent-Quelle. Classic CTF und
One Flag nutzen vorhandene Goal-Frames als Intent-Quelle.

## Bulk 4: 1v1 bis 4v4 Modus-Matrix

Ziel: Jeder Modus soll in jeder Teamgroesse technisch stabil und mit
messbarem Fortschritt laufen.

Tasks:

- [x] TDM `1v1`, `2v2`, `3v3`, `4v4` Matrix pruefen.
- [x] Classic CTF `1v1`, `2v2`, `3v3`, `4v4` Matrix pruefen.
- [x] One Flag `1v1`, `2v2`, `3v3`, `4v4` Matrix pruefen.
- [x] Matrix-Output in Diagnoseartefakte aufnehmen.

### Status

Die Bot-Simulationsmatrix umfasst jetzt alle drei Modi in allen Teamgroessen:

- TDM / Training Crossing: `1v1`, `2v2`, `3v3`, `4v4`
- Classic CTF / Flank Switch: `1v1`, `2v2`, `3v3`, `4v4`
- One Flag / Grand Archive: `1v1`, `2v2`, `3v3`, `4v4`

Die bestehenden Aktivitaets-, Bewegungs-, Pickup-, Combat- und Objective-
Checks laufen auf der erweiterten Matrix gruen. Das belegt technische
Stabilitaet und messbaren Fortschritt, aber noch keine finale Gameplay-
Qualitaet fuer jede Teamgroesse.

## Bulk 5: TDM-Verhalten verbessern

Voraussetzung: Bulk 1 und Intent-Sichtbarkeit fuer TDM.

Tasks:

- [x] TDM Utility-Mini-Slice planen.
- [x] Fight / Seek Health / Seek Armor / Seek Weapon als vergleichbare
      Kandidaten bewerten.
- [x] Zielbindung einfuehren, damit Bots nicht zu schnell umschalten.
- [ ] Pickup-Konflikte messen, bevor Claims eingefuehrt werden.

### Status

Erster kleiner TDM-Slice ist umgesetzt:

- TDM-Bots schreiben jetzt einen Debug-Intent:
  - `seek-health`
  - `seek-armor`
  - `seek-weapon`
  - `hold-standoff`
  - `fight-enemy`
  - `idle`
- Der Low-Health-Szenariotest prueft jetzt explizit, dass `seek-health`
  gegenueber `fight-enemy` dominiert.
- Ein Armor-/Weapon-Szenariotest prueft jetzt explizit:
  - Slot-4-Bot waehlt `seek-armor` und sammelt Armor ein.
  - Slot-2-Bot waehlt `seek-weapon` und sammelt Rail ein.
- TDM-Pickup-Ziele haben eine kurze Zielbindung. Wenn ein Bot ein passendes
  Pickup anlaeuft, bleibt er fuer ein kurzes Zeitfenster bei diesem Ziel,
  solange es noch aktiv und sinnvoll ist.

Erwarteter Spieleffekt:

- Weniger nervoeses Umschalten zwischen Pickup- und Kampfziel.
- Pickup-Routen wirken stabiler.
- Das Verhalten bleibt weiterhin lokal und klein; es ist noch keine grosse
  Utility-AI.

Noch offen:

- `hold-standoff` gezielt als Szenario messen.
- Pickup-Konflikte in `3v3/4v4` sichtbar machen, bevor Team-Claims gebaut
  werden.

## Bulk 6: Objective-Modi absichern

Tasks:

- [ ] Classic CTF: Bot traegt gegnerische Flagge.
- [ ] Classic CTF: beide Flaggen gestohlen.
- [ ] One Flag: Chaser blocked carrier target.
- [ ] One Flag: Carrier path to capture base.
- [ ] One Flag: mehrere Bots konkurrieren um Center Flag.

## Bulk 7: Minimales Team-Blackboard

Voraussetzung: Intents sind sichtbar und mehrere 4v4-Probleme sind belegt.

Tasks:

- [ ] Pickup Claims.
- [ ] Carrier Chase Claims.
- [ ] Carrier Escort Claims.
- [ ] Base Presence Count.
- [ ] Last Known Carrier Position.

## Bulk 8: Bot-Persoenlichkeiten

Voraussetzung: Grundverhalten und Teamkoordination sind stabil.

Erste Persoenlichkeiten:

- [ ] Objective Nerd.
- [ ] Duelist.
- [ ] Scavenger.
- [ ] Bodyguard.

Persoenlichkeiten sollen nur Gewichtungen veraendern, keine Aktionen
verbieten.

## Naechster empfohlener Schritt

Als naechstes sollte Bulk 4 vorbereitet werden:

1. Die vorhandene Matrix von `2v2` und `4v4` auf `1v1`, `2v2`, `3v3`,
   `4v4` erweitern.
2. Die Matrix-Ergebnisse in den Diagnoseartefakten sichtbar machen.
3. Danach erst konkrete Bot-Verhaltensfixes planen, wenn ein Modus oder eine
   Teamgroesse messbar auffaellig ist.

Damit bleiben kommende Bot-Verbesserungen vergleichbar und nachvollziehbar.
