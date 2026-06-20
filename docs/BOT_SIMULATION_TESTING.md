# Bot Simulation Testing

## Zweck

Dieses Testprogramm prueft die V2-Bots headless im echten
`GameplayCoreRuntime`-Loop, ohne Browser, Renderer oder HUD.

Ziel ist nicht Balancing, sondern fruehe technische Evidenz:

- laufen Bots ueberhaupt stabil durch den Runtime-Loop
- machen sie in verschiedenen Modi messbaren Fortschritt
- entstehen offensichtliche Stalls oder Totalausfaelle
- gibt es Navigationsprobleme bei echten Zielpunkten

## Aktueller Ort

- Testdatei: `tests/bot-simulation.test.ts`
- Navigator-Diagnostik: `src/core/bots/GridBotNavigator.ts`

## Was aktuell getestet wird

### 1. Kleine Modus-Matrix

Folgende Szenarien laufen im Headless-Simulationsmodus:

- `Team Deathmatch` auf `Training Crossing` in `2v2`
- `Team Deathmatch` auf `Training Crossing` in `4v4`
- `Classic CTF` auf `Flank Switch` in `2v2`
- `Classic CTF` auf `Flank Switch` in `4v4`
- `One Flag` auf `Grand Archive` in `2v2`
- `One Flag` auf `Grand Archive` in `4v4`

Dabei werden unter anderem beobachtet:

- Frames ohne Bot-Actions
- invalide Positionen
- gesamte Laufstrecke pro Bot
- laengste Stationaerphase pro Bot
- modusspezifischer Fortschritt zum naechsten sinnvollen Ziel
- Flag-Pickups, Flag-Captures und Score-Events

### 2. Enge One-Flag-Diagnostik

Fuer `One Flag x Grand Archive x 2v2` gibt es zusaetzlich einen gezielten
Diagnoselauf mit echten `OneFlagBotController`-Instanzen und eigenen
`GridBotNavigator`-Instanzen.

Zusatzmetriken:

- `repathCount`
- `repathReason`
- `pathLength`
- `pathFound`
- `pathMissCount`
- `longestPathMissStreak`
- `goalBlocked`
- Start-/Zielzelle
- Jump-Link-Aktivitaet

Zusatzanalyse fuer Zieltypen:

- bei welchem `OneFlagBotGoalKind` blockierte Zielpunkte auftreten
- in welchen Zielzellen das passiert
- ob `take-center-flag` blockiert wird
- ob `chase-enemy-carrier` blockiert wird

## Aktuelle Parameter

- Framedelta: `34 ms`
- Simulationsdauer:
  - meist `18 s` fuer `TDM` und `One Flag`
  - `22 s` fuer `Classic CTF`

Diese Werte sind absichtlich pragmatisch:

- kurz genug fuer schnelle Testlaeufe
- lang genug fuer Repaths, erste Objective-Wechsel und erkennbare Stalls

## Warum die Gates pro Modus unterschiedlich sind

Die Gates sind bewusst nicht in allen Modi gleich.

### TDM

`TDM` wird aktuell nicht hart ueber Kills oder Score gegatet.

Grund:

- Combat-Standoff ist dort legitimes aktuelles Verhalten
- dadurch sind reine Score-Gates fuer Headless-Sims zu fragil

Darum wird bei `TDM` aktuell eher auf Folgendes geprueft:

- Distanzgewinn zum naechsten aktiven Gegner
- Travel statt kompletter Bewegungslosigkeit

### Classic CTF / One Flag

Hier sind Objective-nahe Metriken aussagekraeftiger:

- Distanzreduktion zum relevanten Objective
- Flag-Pickup / Capture-Druck
- begrenzte laengere Stalls

## Aktueller Befund

Stand dieses Dokuments:

- alle aktuellen Tests und der Build laufen gruen
- Bots sind in allen drei Modi und in `2v2`/`4v4` headless aktiv
- es gibt keinen offensichtlichen Totalausfall der Bot-Runtime

Wichtigster Befund fuer `One Flag x Grand Archive`:

- der Center-Flag-Approach selbst wirkt nicht als primaerer Fehler
- `take-center-flag` wird in der aktuellen Diagnostik nicht als blockiertes
  Ziel beobachtet
- blockierte Ziele treten dagegen bei spaeteren dynamischen Zieltypen auf,
  vor allem im Bereich `chase-enemy-carrier`

Praktische Schlussfolgerung:

- der Verdacht verschiebt sich weg von
  `Center Flag Zielzelle ist falsch oder im Padding`
- der Verdacht geht eher Richtung
  dynamische Carrier-Verfolgung, Combat-Standoff oder Repath-Verhalten bei
  bewegten Zielen in Hindernisnaehe

## Was dieses Testprogramm noch nicht kann

- keine Browser-/HUD-/Mobile-Aussagen
- kein reales Nutzer- oder Visuell-QA
- kein echtes Performance-Profiling
- keine deterministische Replay-Datei
- keine Langzeitserie mit Seeds und Streuung
- keine Trennung zwischen legitimem Combat-Halten und echtem
  Feststecken ueber ein eigenes semantisches Modell

## Sinnvolle naechste Ausbaustufen

### Kurzfristig

- Text- oder JSON-Report separat erzeugen, nicht nur im Assertion-Pfad
- Goal-Wechsel ueber Zeit mitschreiben
- Navigator-Zielzellen und Pfadlaengen als Verlauf mitschreiben
- `One Flag` separat fuer
  `take-center-flag`, `escort-carrier`, `chase-enemy-carrier` auswerten

### Mittelfristig

- kleine Replay-/Trace-Artefakte fuer einzelne problematische Simulationslaeufe
- semantische Stuck-Erkennung statt nur Distanz/Stillstand
- mehrere Seeds bzw. Startlagen fuer robustere Streuungsanalyse
- Testmatrix spaeter auf mehr Maps oder laengere Laufzeiten erweitern

## Architekturempfehlung

Aus Architektursicht ist jetzt kein grosser KI-Umbau sinnvoll.

Sinnvoller naechster Pfad:

1. Beobachtbarkeit weiter ausbauen
2. daraus eng begrenzte lokale Fixes ableiten
3. erst danach Entscheidungslogik oder Rollenlogik umbauen

Konkret:

- die Navigator-Diagnostik beibehalten und erweitern
- Zielwahl, Navigation und Combat-Standoff getrennt beobachtbar halten
- keine One-Flag-Sonderregeln tief in den Navigator schieben
- keine Map-ID-Hacks
- spaetere Fixes moeglichst lokal in
  `GridBotNavigator`, `BotCombatStandoff` oder klar abgegrenzter
  Zielprojektion halten

Der aktuell sinnvollste naechste technische Slice waere:

- `chase-enemy-carrier` in `One Flag x Grand Archive` isoliert untersuchen
- pruefen, ob bewegte Carrier-Ziele vor Navigation auf erreichbare Rasterzellen
  projiziert werden sollten
- erst dann entscheiden, ob ein minimaler lokaler Navigator-Fix reicht

## Ausfuehrung

Tests starten:

```bash
npm.cmd test
```

Build pruefen:

```bash
npm.cmd run build
```
