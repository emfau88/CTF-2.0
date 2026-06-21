# CTF Project Handoff - Current State 2026-06-20

## Zweck dieses Dokuments

Dieses Dokument ist die aktuelle Uebergabe fuer einen neuen Kollegen oder einen neuen Codex-Chat. Es konsolidiert den verifizierten Ist-Stand des Projekts, verweist auf die wichtigen bestehenden Markdown-Dateien und benennt klar:

- was aktuell funktioniert
- wie das Projekt architektonisch geschnitten ist
- welche Risiken und Hotzones offen sind
- welche lokalen WIP-Aenderungen gerade im Working Tree liegen
- was als naechstes sinnvoll ist

Wenn Aussagen aus aelteren Docs nicht mehr exakt zum Code passen, gilt dieses Dokument zusammen mit dem aktuellen Code- und Teststand als fuehrend.

## Kurzfassung

- Projekt: browserbasiertes 2D-Capture-the-Flag-/Arena-Spiel auf Phaser + TypeScript + Vite
- Workspace: `C:\Users\madde\Documents\CTF`
- Aktueller Branch: `codex/gameplay-core-v2`
- Remotes:
  - `ctf2` -> `https://github.com/emfau88/CTF-2.0.git`
  - `origin` -> `https://github.com/emfau88/CTF.git`
- V1 bleibt weiterhin die eingefrorene Referenz unter `/CTF/`
- V2 ist opt-in und laeuft ueber `/CTF/?scene=v2` sowie `/CTF-2.0/`
- V2 hat inzwischen:
  - alle 3 Modi im Runtime-/Menu-Pfad
  - alle 3 Maps im V2-Map-System
  - Teamgroessen von `1v1` bis `4v4`
  - Bot- und Local-Pfade
  - Mobile Touch-Steuerung
  - Fullscreen-Mobile-Menu
  - Pause-/Result-/Restart-/Main-Menu-Flows
- Tests und Build sind aktuell gruen
- Die groesste offene technische Hotzone ist derzeit Bot-Verhalten, nicht die Grundarchitektur

## Verifizierter Stand vom 2026-06-20

### Git-Arbeitsstand vor dieser Uebergabe

Bereits vorhandene, nicht von dieser Uebergabe stammende Working-Tree-Aenderungen:

- Modified:
  - `package.json`
  - `src/core/bots/OneFlagBotController.ts`
  - `src/core/bots/index.ts`
  - `src/core/index.ts`
  - `tests/bot-simulation.test.ts`
  - `tests/gameplay-core.smoke.test.ts`
- Untracked:
  - `docs/CODEX_HANDOFF_2026-06-13.md`
  - mehrere Asset-Mockups unter `public/assets/`
  - `scripts/`
  - `tests/bot-diagnostics.ts`

Diese Uebergabe-Datei wurde zusaetzlich neu erstellt. Die oben genannten Dateien sollten als pre-existing WIP behandelt werden.

### Laufende Validierung

Am 2026-06-20 erneut ausgefuehrt:

- `npm.cmd test` -> `21 / 21` Tests gruen
- `npm.cmd run build` -> erfolgreich
- `npm.cmd run bot:diagnostics` -> erfolgreich

Build-Hinweis:

- `dist/assets/index-jkzjuJir.js` ist mit `1,441.68 kB` weiterhin groesser als die Vite-Warnschwelle von `500 kB`
- Das ist aktuell ein Performance-/Bundle-Thema, kein Build-Blocker

## Projektziel

Das Projekt verfolgt zwei gleichzeitig laufende Linien:

1. Eingefrorene V1-Referenz erhalten
2. V2 als saubere, erweiterbare Gameplay-Core-Architektur aufbauen, bis sie V1 irgendwann kontrolliert ersetzen kann

Wichtig:

- V2 ist keine neue Spielidee, sondern eine strukturierte Neuimplementierung des bestehenden Spiels
- V1-Paritaet bei Feeling, Modes, Maps und Produktfluss bleibt das Leitprinzip
- Neue Features sind nur sinnvoll, wenn sie die Architektur nicht wieder verwischen

## Architektur in einem Satz

V1 ist der alte produktnahe Pfad; V2 trennt autoritativen Gameplay-Core (`src/core/`) von Phaser-/HUD-/Input-/Audio-Adaptern (`src/adapters/phaser/` und `src/adapters/*`).

## Wichtige Architekturgrenzen

### V1 / Legacy

Relevante V1-nahe Dateien:

- `src/scenes/ArenaScene.ts`
- `src/level.ts`
- `src/systems.ts`
- `src/player.ts`
- `src/arenaRenderer.ts`
- `src/arenaAudio.ts`
- `src/hud.ts`
- `src/touchLayout.ts`

Diese Schicht ist wichtig als Referenz fuer:

- Spielgefuehl
- Regeln
- Mapdaten
- Praesentation
- Audioverhalten

### V2 / neue Architektur

V2-Hauptgrenzen:

- `src/core/`
  - autoritativer Spielzustand
  - Movement
  - Combat
  - Pickups
  - Objectives
  - Score/Match-State
  - GameModes
  - Spawn/Roster
  - WorldMap-Plain-Data
  - Bot-Entscheidungen und Navigation
- `src/adapters/`
  - Renderer-/HUD-/Input-/Audio-Port-Schnittstellen
- `src/adapters/phaser/`
  - konkrete Phaser-Anbindung fuer V2
- `src/adapters/phaser/scenes/GameplayV2Scene.ts`
  - V2-Scene-Einstieg
- `src/main.ts`
  - Routing zwischen V1 und V2

### Zentrale V2-Dateien

- Routing / Shell
  - `src/main.ts`
  - `src/bootSceneSelection.ts`
  - `src/v2Route.ts`
  - `src/v2Menu.ts`
  - `index.html`
  - `src/styles.css`
- Runtime / World
  - `src/core/runtime/GameplayCoreRuntime.ts`
  - `src/core/runtime/createTeamDeathmatchWorldState.ts`
  - `src/core/runtime/createClassicCtfWorldState.ts`
  - `src/core/runtime/createOneFlagWorldState.ts`
- Modes
  - `src/core/modes/TeamDeathmatchMode.ts`
  - `src/core/modes/ClassicCtfMode.ts`
  - `src/core/modes/OneFlagMode.ts`
- Maps
  - `src/core/world/maps/trainingCrossingV2.ts`
  - `src/core/world/maps/grandArchiveV2.ts`
  - `src/core/world/maps/flankSwitchV2.ts`
  - `src/core/world/maps/worldMapRegistry.ts`
  - `src/core/world/maps/worldMapValidation.ts`
- Bots
  - `src/core/bots/GridBotNavigator.ts`
  - `src/core/bots/TdmBotController.ts`
  - `src/core/bots/ClassicCtfBotController.ts`
  - `src/core/bots/OneFlagBotController.ts`
  - `src/core/bots/ClassicCtfBotDecisionController.ts`
  - `src/core/bots/OneFlagBotDecisionController.ts`
  - `src/core/bots/BotCombatStandoff.ts`
- Phaser-Adapter
  - `src/adapters/phaser/PhaserArenaRendererPort.ts`
  - `src/adapters/phaser/PhaserArenaHudPort.ts`
  - `src/adapters/phaser/PhaserArenaAudioPort.ts`
  - `src/adapters/phaser/PhaserMobileInputAdapter.ts`
  - `src/adapters/phaser/scenes/GameplayV2Scene.ts`

## Routing und Produktpfade

### Verifiziert

- `/CTF/` -> V1-Pfad
- `/CTF/?scene=v2` -> V2-Shell
- `/CTF-2.0/` -> V2-Shell

Logik:

- `src/bootSceneSelection.ts` entscheidet explizit zwischen V1 und V2
- `src/main.ts` blendet fuer V2 das alte `#hud` aus und startet `GameplayV2Scene`
- `src/v2Route.ts` validiert Mode, Map, Players, Teamgroesse, Controls, Skin und SFX

### V2-Route-Parameter

Aktuell relevante Route-Felder:

- `mode`: `tdm | ctf | one-flag`
- `map`: V2-Map-ID
- `players`: `bot | local`
- `teamSize`: `1..4`
- `controls`: `auto | touch | keyboard`
- `skin`: `alien-runner | riot-droid`
- `sfx`: `on | off`

## Bestehende Features - aktueller Ist-Stand

### 1. Modi

Aktuell im V2-Pfad verdrahtet und getestet:

- Team Deathmatch
- Classic CTF
- One Flag

Mode-Implementierungen liegen in:

- `src/core/modes/TeamDeathmatchMode.ts`
- `src/core/modes/ClassicCtfMode.ts`
- `src/core/modes/OneFlagMode.ts`

Die GameMode-Grenze ist vorhanden und sinnvoll. TDM, Classic CTF und One Flag laufen nicht mehr als lose Sonderlogik in einer Scene.

### 2. Maps

Aktuell als V2-Plain-Data vorhanden:

- Training Crossing
- Grand Archive
- Flank Switch

Map-Registry und Validation:

- `src/core/world/maps/worldMapRegistry.ts`
- `src/core/world/maps/worldMapValidation.ts`

Die Maps sind nicht nur eingetragen, sondern auch Teil der V2-Menueauswahl und Runtime-Initialisierung.

### 3. Teamgroessen

Verifiziert:

- `1v1`
- `2v2`
- `3v3`
- `4v4`

Die Teamgroesse laeuft durch:

- Route
- Roster
- World-Factory
- Map-Validation
- Bot-Gruppen
- Scene-Initialisierung

Das ist ein wichtiger Fortschritt gegenueber aelteren Docs.

### 4. Players-Modi

Aktuell verfuegbar:

- `bot` -> Solo vs Bots
- `local` -> lokaler Pfad, weiterhin explizit experimentell

Wichtig:

- Local 2 Player ist produktseitig noch nicht so belastbar wie der Bot-/Solo-Pfad
- Bei `local` werden Controls im V2-Menu auf `keyboard` festgesetzt

### 5. Movement / Core-Feeling

Verifizierter Status:

- eigener Core-Movement-Pfad vorhanden
- Jump-System vorhanden
- Jump wird auch von Bots verwendet
- globale Bewegung fuer Spieler und Bots wurde auf das gewuenschte reduzierte Niveau gebracht

Die aeltere V2-Doku spricht explizit von bewusster Reduktion gegenueber rohem V1-Speed. Der aktuelle Code- und Teststand bestaetigt, dass dieses Balancing aktiv und kein Zufall ist.

### 6. Combat / Waffen

Im V2-Core vorhanden:

- Basic Fire
- Rocket
- Railgun
- Whip
- V1-Weapon-Config-Pfad

Wichtige Produktentscheidung im aktuellen Stand:

- Player basic fire ist manuell
- Bot-Fallback fuer basic fire bleibt automatisch

Das ist explizit durch Test abgesichert:

- `player basic fire is manual while the bot fallback remains automatic`

### 7. Mobile / Touch / UI

Aktuell vorhanden:

- Touch-Steuerung im V2-Pfad
- Mobile-Weapon-/Action-Cluster
- Jump bleibt der Hauptbutton
- dauerhafter Basic-Fire-Button ist eingefuehrt
- fullscreenartiges V2-Mobile-Menu
- Portrait-Fallback mit Rotate-Hinweis
- Ingame Menu- und SFX-Button als Overlay
- Pause-Overlay
- Result-Overlay

Wichtige Dateien:

- `src/adapters/phaser/PhaserMobileInputAdapter.ts`
- `src/adapters/phaser/v2TouchLayout.ts`
- `index.html`
- `src/styles.css`

### 8. Audio

V2 besitzt einen separaten Phaser-Audio-Pfad:

- `src/adapters/phaser/PhaserArenaAudioPort.ts`

Zusammen mit den aelteren Docs ist der aktuelle Eindruck:

- Audio ist nicht mehr "ganz offen"
- aber weiterhin nicht vollstaendig abgeschlossen
- insbesondere Feinschliff-/Paritaetsfragen bleiben moeglich

### 9. Match-Flow / Produktfluss

Aktuell vorhanden:

- Start aus V2-Menue
- Matchstart ueber Route
- Ingame Pause
- Resume
- Restart
- Main Menu Rueckkehr
- Result-Overlay
- Play Again

Das ist deutlich weiter als der Stand in `docs/CODEX_HANDOFF_2026-06-13.md`.

## Bot-/KI-Stand

## Was vorhanden ist

- TDM-Bot-Controller
- Classic-CTF-Bot-Controller
- One-Flag-Bot-Controller
- Grid-basierte Navigation
- authored Jump Links im World-/Map-System
- Combat-Standoff-Logik
- Bot-Controller-Gruppen fuer komplette Teams
- Headless Simulationstests

### Wichtige Bot-Komponenten

- Zielentscheidung:
  - `ClassicCtfBotDecisionController`
  - `OneFlagBotDecisionController`
- Ausfuehrung:
  - `ClassicCtfBotController`
  - `OneFlagBotController`
  - `TdmBotController`
- Navigation:
  - `GridBotNavigator`
- Kampfnahe Abstandshaltung:
  - `BotCombatStandoff`

### Verifizierte Testabdeckung

Aktuelle Tests decken u. a. ab:

- Bots fuer alle non-human Slots von `1v1` bis `4v4`
- TDM-Zielwechsel
- Classic-CTF-Rollen fuer vier Slots
- One-Flag-Naeherung an die neutrale Flagge
- Chase-Projektion fuer blockierte Carrier-Ziele
- Headless Simulationsmatrix fuer TDM / Classic CTF / One Flag

## Bot-Simulationsprogramm

Eigene aktuelle Artefakte:

- `tests/bot-diagnostics.ts`
- `tests/bot-simulation.test.ts`
- `scripts/run-bot-diagnostics.ts`
- `package.json` Script: `bot:diagnostics`
- Doku: `docs/BOT_SIMULATION_TESTING.md`

### Aktuell getestete Matrix

- TDM / Training Crossing / 2v2
- TDM / Training Crossing / 4v4
- Classic CTF / Flank Switch / 2v2
- Classic CTF / Flank Switch / 4v4
- One Flag / Grand Archive / 2v2
- One Flag / Grand Archive / 4v4

### Aktueller Diagnostikbefund

Wichtigste Aussage:

- Das One-Flag-Problem auf Grand Archive ist nach dem aktuellen Befund **nicht primaer** die Center-Flag-Grundnaeherung
- Der aktuelle groesste belegte Hotspot liegt spaeter im Objective-Ablauf, vor allem bei `escort-carrier`

Zuletzt gemessener Report:

```text
Bot Simulation Matrix
scenario | scoreEvents | flagPickups | flagCaptures | invalidFrames | idleFrames | bestBlueProgress | bestRedProgress | blueTravel | redTravel | blueStallMs | redStallMs
TDM Training Crossing 2v2 | 0 | 0 | 0 | 0 | 0 | 970.5 | 981.4 | 611.9 | 634.7 | 15368 | 15368
TDM Training Crossing 4v4 | 2 | 0 | 0 | 0 | 0 | 1070.4 | 1029.0 | 1885.9 | 2033.6 | 15368 | 15368
Classic CTF Flank Switch 2v2 | 0 | 1 | 0 | 0 | 0 | 2180.0 | 1867.8 | 8700.4 | 8084.4 | 884 | 918
Classic CTF Flank Switch 4v4 | 0 | 3 | 0 | 0 | 0 | 2180.0 | 2106.3 | 6574.3 | 7283.7 | 1088 | 1360
One Flag Grand Archive 2v2 | 1 | 1 | 1 | 0 | 0 | 1008.0 | 1096.7 | 2020.8 | 3752.8 | 408 | 408
One Flag Grand Archive 4v4 | 1 | 2 | 1 | 0 | 0 | 1026.7 | 1093.2 | 4197.8 | 5107.1 | 884 | 918

One Flag Grand Archive Navigator Report
mode=one-flag map=grand-archive-v2 teamSize=2 flagPickups=1 flagCaptures=1 invalidFrames=0 idleFrames=0
blockedGoalKinds=escort-carrier:120, chase-enemy-carrier:4 blockedGoalCells=escort-carrier@39,9:8, escort-carrier@42,5:8, escort-carrier@44,5:8, escort-carrier@46,5:8, escort-carrier@47,5:8, escort-carrier@48,5:8
timeline=6086:flagPickedUp:red:red-player-2, 11968:flagCaptured:red:red-player-2
actor | repaths | pathMisses | goalSwitches | blockedGoalFrames | noProgressMs | sameCellMs | chaseProjectionCount | avgProjection | maxProjection | standoff | goalKinds
blue-player | 11 | 0 | 1 | 0 | 578 | 408 | 0 | 0.0 | 0.0 | pursue:12 | take-center-flag:191, chase-enemy-carrier:43
blue-player-2 | 10 | 0 | 0 | 4 | 816 | 442 | 0 | 0.0 | 0.0 | pursue:15 | take-center-flag:194, chase-enemy-carrier:50
red-player | 35 | 1 | 2 | 120 | 5236 | 442 | 0 | 0.0 | 0.0 | none | take-center-flag:309, escort-carrier:173
red-player-2 | 38 | 0 | 2 | 0 | 748 | 442 | 0 | 0.0 | 0.0 | none | take-center-flag:322, capture-flag:173
```

### Konsequenz daraus

- One Flag ist nicht "kaputt", sondern technisch schon lauffaehig
- Die relevante naechste Bot-Untersuchung ist lokal und konkret:
  - `escort-carrier` auf `Grand Archive`
- TDM zeigt in der Matrix weiterhin hohe Stall-Werte und braucht spaeter einen eigenen Bot-Qualitaetsslice

## Aktuelle lokale WIP-Aenderungen

Diese Aenderungen liegen im Working Tree und sind noch nicht Teil eines sauberen Commits in diesem Stand:

### One-Flag-Chase-/Diagnostik-WIP

- `src/core/bots/OneFlagBotController.ts`
  - Debug-Snapshot fuer Goal/Navigation/Standoff
  - lokale Projektion fuer blockierte `chase-enemy-carrier`-Ziele
- `src/core/bots/index.ts`
- `src/core/index.ts`
- `tests/gameplay-core.smoke.test.ts`
  - Regression fuer erreichbare Carrier-Chase-Projektion
- `tests/bot-simulation.test.ts`
  - auf wiederverwendbare Diagnostik verschoben
- `tests/bot-diagnostics.ts`
  - neue Diagnostik-Matrix und One-Flag-Detailreport
- `scripts/run-bot-diagnostics.ts`
- `package.json`
  - `bot:diagnostics`

Wichtig:

- Diese WIP-Aenderung ist **kein allgemeiner KI-Refactor**
- Sie ist ein lokaler Diagnose-/Stabilisierungsschritt
- Der naechste sinnvolle Folgeschritt waere eher `escort-carrier` als nochmal `take-center-flag`

## Offene Themen / Hotzones

### Hotzone 1 - One Flag x Grand Archive Bot-Verhalten

Status:

- reproduzierbar diagnostizierbar
- nicht mehr diffuse Vermutung

Aktuell wahrscheinlichste technische Ursache:

- nicht die neutrale Flaggenannaherung
- eher spaetere dynamische Zielpunkte bei Eskorte / Carrier-Interaktion in Hindernisnaehe

Betroffene Dateien:

- `src/core/bots/OneFlagBotController.ts`
- `src/core/bots/OneFlagBotDecisionController.ts`
- `src/core/bots/GridBotNavigator.ts`
- `tests/bot-diagnostics.ts`

### Hotzone 2 - TDM-Bot-Stalls

Die frueheren hohen TDM-Stall-Werte waren groesstenteils ein Messartefakt:

- die Headless-Runtime hatte Basic-Auto-Fire nicht wie der echte Spielpfad
  konfiguriert
- bewusstes Combat-Hold wurde als Stall gezaehlt
- nach Matchende eingefrorene Frames konnten weitergezaehlt werden

Die korrigierte Diagnostik trennt Hold, Inaktivitaet und echte
Move-Intent-Stalls. Im aktuellen TDM-`2v2`- und `4v4`-Lauf entstehen `0 ms`
echte Move-Intent-Stalls. Offen bleibt die subjektive Browserfrage, ob Bots im
Feuergefecht zu lange statisch stehen.

Das regulaere TDM-Killziel wurde auf `10` gesetzt.

### Hotzone 3 - Mobile HUD / Praesentation / manuelle QA

Offen beziehungsweise nur teilweise verifiziert:

- Mobile Grand Archive Tile-Jitter/Shimmering nach Renderer-/Camera-Verdacht
- finale HUD-/Scorebox-Politur
- reale Mobile-Browser statt nur Code- und Testpfad
- Desktop/Mobile visuelle Konsistenz ueber alle Modi/Maps

Der userseitige manuelle Test ist hier weiter wichtig. Nicht alles ist sinnvoll headless absicherbar.

### Hotzone 4 - Bundle Size

Build ist gruen, aber:

- der V2/V1-Gesamtbundle ist gross
- aktuell noch keine Code-Splitting-Strategie

Das ist erst nach Gameplay-/Produktstabilisierung ein sinnvoller Slice.

### Hotzone 5 - Docs koennen hinter dem Code herlaufen

Besonders wichtig:

- `docs/CODEX_HANDOFF_2026-06-13.md` ist inhaltlich historisch wertvoll, aber in mehreren Punkten ueberholt
- `docs/GAMEPLAY_CORE_V2_ROADMAP.md` ist weiterhin nuetzlich, aber nicht jede Checkbox ist als Live-Truth zu lesen

Die Wahrheit liegt aktuell in:

1. Code
2. Tests/Build
3. aktuelle Diagnostik
4. dann erst in aelteren Roadmap-/Handoff-Dokumenten

## Was bereits klar besser ist als im aelteren Handoff

Gegenueber `docs/CODEX_HANDOFF_2026-06-13.md` ist der Projektstand klar weiter:

- Classic CTF existiert inzwischen im V2-Mode-System
- One Flag existiert inzwischen im V2-Mode-System
- Grand Archive und Flank Switch sind im V2-Map-System
- V2-Menue bietet alle drei Modi und Karten
- Teamgroessen `1v1` bis `4v4` laufen durch den V2-Pfad
- Bots springen und sind nicht mehr nur TDM-Minimum
- Mobile Menu/Touch/UI wurde ausgebaut
- Pause-/Result-/Restart-/Main-Menu-Flows sind vorhanden
- Headless Bot-Diagnostik ist jetzt ein eigener technischer Pfad

## Was weiterhin nicht als "fertig" angesehen werden sollte

- finale Bot-Qualitaet
- finale Mobile-Produktreife
- reale Device-/Browser-Abnahme
- V2 als Default
- lokale Multiplayer-Belastbarkeit auf Produktniveau
- volle visuelle Politur auf allen Maps

## Empfohlene Lesereihenfolge fuer einen neuen Kollegen

### Zuerst

1. `docs/PROJECT_HANDOFF_2026-06-20.md`
2. `docs/GAMEPLAY_CORE_V2_ROADMAP.md`
3. `docs/V1_V2_FEELING_PARITY.md`
4. `docs/BOT_SIMULATION_TESTING.md`
5. `docs/BOT_AI_ROADMAP.md`

### Danach die Kerncodepfade

1. `src/main.ts`
2. `src/v2Route.ts`
3. `src/adapters/phaser/scenes/GameplayV2Scene.ts`
4. `src/core/runtime/GameplayCoreRuntime.ts`
5. `src/core/modes/*.ts`
6. `src/core/world/maps/*.ts`
7. `src/core/bots/*.ts`
8. `src/adapters/phaser/PhaserMobileInputAdapter.ts`
9. `src/adapters/phaser/PhaserArenaRendererPort.ts`
10. `tests/gameplay-core.smoke.test.ts`
11. `tests/bot-simulation.test.ts`
12. `tests/bot-diagnostics.ts`

### V1-Referenz nur bei Bedarf parallel

- `docs/V1_BEHAVIOR_BASELINE.md`
- `src/level.ts`
- `src/systems.ts`
- `src/arenaAudio.ts`
- `src/touchLayout.ts`

## Empfohlene naechste Schritte

### Hohe Prioritaet

1. One-Flag-Bot-Folgeslice:
   - `escort-carrier` auf `Grand Archive` lokal diagnostizieren und nur dort minimal absichern
2. Manueller Mobile-Test:
   - Grand Archive Tile-Jitter bestaetigen oder entkraeften
3. HUD-/Scorebox-/Mobile-Politur:
   - nur Praesentation, keine Gameplay-Ausweitung

### Mittlere Prioritaet

4. TDM-Bot-Stall-Slice mit denselben Diagnostikwerkzeugen
5. Ergebnis-/Abnahmematrix fuer reale Devices/Browsers
6. Audio-/Effekt-Feinschliff nur nach manueller Sichtung

### Spaeter

7. Bundle-/Chunking-Arbeit
8. weitere KI-Verbesserungen wie Kandidatenbewertung / Hysterese / Rollenfeintuning

## Arbeitsregeln fuer den naechsten Bearbeiter

- V1 nicht versehentlich anfassen
- keine allgemeine Bot-Architektur neu erfinden
- Probleme zuerst reproduzieren, dann lokal fixen
- Route-/Mode-/Map-Grenzen sauber halten
- keine mode-spezifischen Regeln in generische Core-Teile schieben
- Docs nicht ueber den Code stellen

## Praktische Befehle

```powershell
git status --short
npm.cmd test
npm.cmd run build
npm.cmd run bot:diagnostics
```

## Fazit

Das Projekt ist nicht mehr in einer fruehen V2-Grundlagenphase. Die Basis steht. Die offenen Themen liegen inzwischen hauptsaechlich in drei Kategorien:

- Bot-Qualitaet und Objective-Randfaelle
- Mobile-/HUD-/Praesentationspolitur
- finale Produktabnahme

Die Architektur wirkt aktuell belastbar genug, um diese Restarbeit lokal und ohne neuen Neustart weiterzutragen. Das groesste Risiko ist momentan nicht die Struktur, sondern dass ungeliebte Detailprobleme ohne saubere Reproduktion oder ohne gute Grenzziehung "quick-fixed" werden.
