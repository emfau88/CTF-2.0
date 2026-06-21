# Gameplay Core V2 Roadmap

## Zielbild

V2 wird kein anderes Spiel, sondern eine saubere, erweiterbare
Neuimplementierung des V1-Spielgefuehls:

- [ ] Bewegung, Spruenge, Waffen und Spieltempo entsprechen V1.
- [ ] Classic CTF bleibt vollstaendig erhalten.
- [ ] Weitere Modi verwenden gemeinsame Actor-, Movement-, Combat-, Spawn- und
      Match-Systeme.
- [ ] Phaser bleibt fuer Darstellung, Input, Audio und Effekte verantwortlich.
- [ ] Spielregeln und autoritativer Zustand bleiben im Core.
- [ ] V1 bleibt bis zur bestaetigten Paritaet die spielbare Referenz.
- [ ] V2 ersetzt V1 erst nach vollstaendiger Abnahme.

## Verbindliche Arbeitsprinzipien

- [ ] Keine weitere Diagnosearbeit ohne konkreten spielbaren oder
      architektonischen Nutzen.
- [ ] Jeder groessere Meilenstein endet mit einem spielbaren Browser-Build.
- [ ] V1 wird gelesen und verglichen, aber nicht veraendert.
- [ ] Es wird keine dritte Architektur und kein weiterer Neustart begonnen.
- [ ] Gemeinsame Systeme enthalten keine CTF-, TDM- oder One-Flag-Regeln.
- [ ] Modusspezifische Regeln liegen ausschliesslich im jeweiligen `GameMode`.
- [ ] Menschliches Gameplay und V1-Feeling werden vor Bot-KI priorisiert.
- [ ] Jede Aenderung erfordert Build, Core-Checks und Browserpruefung.
- [ ] Kein Multiplayer- oder Netzwerkcode, bevor das lokale Spiel stabil ist.
- [ ] Neue Abstraktionen werden nur bei realem Bedarf eingefuehrt.

## Aktueller Stand

- [x] V1 ist unter `/CTF/` eingefroren und spielbar.
- [x] V2 ist unter `/CTF/?scene=v2` opt-in.
- [x] Framework-neutraler Core und Phaser-Adaptergrenze existieren.
- [x] World-, Actor-, Movement-, Jump-, Collision- und Gap-Grundlagen
      existieren.
- [x] Training Crossing ist als Plain-Data-Geometrie vorhanden.
- [x] Eine V2-Map-Registry waehlt Weltinhalt und Phaser-Praesentation aus
      derselben Map-Definition.
- [x] Grand Archive ist mit V1-Geometrie, Pickups und Bibliotheksoptik
      migriert.
- [x] Damage, Armor, Death und Respawn existieren.
- [x] Ein diagnostisches Projektil und Health-/Armor-Pickups existieren.
- [x] MatchState, Timer, ScoreBoard und diagnostischer GameMode existieren.
- [x] Kill-Scoring besitzt Teampruefung, `lifeId` und Deduplizierung.
- [x] Ein Blue Player und mehrere Red Targets besitzen feste Team-Spawns.
- [x] Phase 19 ist committed.

## Meilenstein 1: V2 stabilisieren

**Ziel:** Die vorhandene Basis konsolidieren, bevor weitere Features
hinzukommen.

- [x] Phase 19 pruefen und committen.
- [x] `InertCoreRuntime` passend zur realen Verantwortung umbenennen.
- [x] Die Runtime in klar erkennbare Update-Systeme gliedern:
  - [x] Actor Lifecycle
  - [x] Movement und Collision
  - [x] Combat und Projectiles
  - [x] Pickups
  - [x] Match und Mode
- [x] Die verbindliche Update-Reihenfolge dokumentieren.
- [x] Die Update-Reihenfolge durch Core-Tests absichern.
- [x] Simulation bei Match-Ende kontrolliert stoppen.
- [ ] Diagnose-Sonderfaelle aus allgemeinen APIs entfernen.
- [x] Bestehende Smoke-Checks als verlaessliche Core-Regressionstests nutzen.
- [x] Eine gemeinsame Runtime fuer injizierbare World- und Mode-Konfiguration
      verwenden.
- [x] Keine unbeabsichtigte sichtbare Verhaltensaenderung gegenueber dem
      aktuellen V2-Stand.

**Abschlusskriterium:** Das aktuelle V2-Verhalten bleibt erhalten, aber die
Runtime ist kein wachsendes Godfile.

## Meilenstein 2: Spielbarer Team-Deathmatch-Slice

**Ziel:** Der erste vollstaendig spielbare V2-Modus.

- [x] `TeamDeathmatchMode` implementieren.
- [x] Zwei menschlich kontrollierbare Actors unterstuetzen.
- [x] Team-Spawns verwenden.
- [x] Kill-Score aus generischen `actor.died`-Events ableiten.
- [x] Scorelimit implementieren.
- [x] Zeitlimit implementieren.
- [x] Death und Respawn vollstaendig integrieren.
- [x] Match-Ende stoppt die relevante Simulation.
- [x] Mode-neutralen HUD-Zustand verwenden.
- [x] Einfachen Restart oder Rematch ermoeglichen.
- [x] Modus vorlaeufig ueber `?scene=v2&mode=tdm` auswaehlbar machen.
- [x] Keine TDM-Regeln in Scene, Renderer, HUD oder allgemeinen
      Combat-Systemen ablegen.
- [x] Noch keine Bots und kein Hauptmenue implementieren.

**Abschlusskriterium:** Ein lokales TDM-Match kann gestartet, gespielt,
gewonnen und neu gestartet werden.

## Meilenstein 3: V1-Feeling-Paritaet

**Ziel:** V2 fuehlt sich praktisch wie V1 an.

- [x] Beschleunigung vergleichen.
- [x] Brems- und Reibungsverhalten vergleichen.
- [x] Richtungswechsel und Strafing vergleichen.
- [x] Maximalgeschwindigkeit vergleichen.
- [x] Kurzen Sprung vergleichen.
- [x] Gehaltenen beziehungsweise langen Sprung vergleichen.
- [x] Luftkontrolle vergleichen.
- [x] Collision- und Gap-Crossing vergleichen.
- [x] Damage-, Armor- und Respawn-Verhalten vergleichen.
- [x] Kamera und visuelles Feedback vergleichen.
- [x] Desktop-Input und wahrgenommene Latenz vergleichen.
- [x] Mobile-Steuerung mit derselben Core-Logik anbinden.
- [x] V1-Konstanten und Formeln als Referenz dokumentieren.
- [ ] Identische Startsituationen fuer V1 und V2 verwenden.
- [x] Abweichungen messen und gezielt korrigieren.
- [ ] Keine vermeintlichen Verbesserungen einbauen, solange Paritaet das Ziel
      ist.

**Abschlusskriterium:** Bewegung und Grundkampf werden im direkten Vergleich
nicht als anderes Spiel wahrgenommen.

## Meilenstein 4: V1-Waffen migrieren

**Ziel:** Alle Waffen funktionieren mode-unabhaengig und mit V1-Feeling.

- [x] Basic Autoshoot migrieren.
- [x] Rocket Launcher migrieren.
- [x] Railgun migrieren.
- [x] Whip migrieren.

Fuer jede Waffe:

- [x] Fire-Regeln und Eingaben abgleichen.
- [x] Cooldowns abgleichen.
- [x] Ammo und Ressourcen abgleichen.
- [x] Reichweite und Trefferverhalten abgleichen.
- [x] Damage und Knockback abgleichen.
- [x] Projectile- oder Hitscan-Daten im Core halten.
- [x] Gameplay-Events definieren.
- [x] Darstellung, Audio und Effekte ueber Adapter ausloesen.
- [x] Passende Pickups integrieren.
- [x] Regressionstests fuer Treffer, Schaden und Cooldown ergaenzen.

**Abschlusskriterium:** Jede V1-Waffe funktioniert bereits in TDM und fuehlt
sich wie ihre V1-Version an.

### V1-Waffenparitaet in V2

- Rocket: `371` Geschwindigkeit, `45` Basisschaden, `105` Splash-Radius,
  `230` Knockback und `5` Ammo pro Pickup.
- Railgun: `1100` Reichweite, `95 %` Max-HP-Schaden, `2500 ms` Cooldown und
  `5` Ammo pro Pickup.
- Whip: `120` Reichweite, `35 Grad` Halbwinkel, `35` Schaden,
  `800 ms` Cooldown und `8` Ammo pro Pickup.
- Desktop/Hybrid: `Q` Rocket, `E` Railgun, `F` Whip.
- Touch: eigene Rocket-, Rail- und Whip-Buttons; Drag bestimmt die Richtung,
  Tap verwendet die zuletzt bekannte Zielrichtung.
- Offene Paritaetsarbeit: temporaere Ammo-Drops nach Tod sind noch nicht
  migriert. Bot-Nutzung der Spezialwaffen ist im TDM-Slice vorhanden.

### Aktueller spielbarer Mobile-TDM-Slice

- [x] Touch-Stick und Jump-Button verwenden dieselben Core-Actions wie Desktop.
- [x] Pickup-Icongroessen und Offsets entsprechen den typabhaengigen
      V1-Darstellungswerten.
- [x] Mobile Waffenbuttons verwenden V1-Touchlayout, Radien, Bildskalierung,
      Ammo-Badges und Cooldown-Ringe.
- [x] Basic Autoshoot funktioniert mit V1-Werten.
- [x] Touch-Kamera folgt dem Blue Player.
- [x] Match-Ende kann per Tap neu gestartet werden.
- [x] Desktop-TDM behaelt lokale Zwei-Spieler-Steuerung.
- [x] Training Crossing verwendet V1-Ruinenassets und Charakter-Sprites.
- [x] Teamseiten, Health-/Armor-Pickups und Pickup-Werte entsprechen V1.
- [x] Mobile-TDM besitzt einen einfachen Red Bot als Einzelspieler-Gegner.
- [x] TDM-Bots navigieren, springen und verwenden Spezialwaffen.
- [x] TDM verwendet ein Killziel von `10`.
- [x] Headless-TDM trennt Combat-Hold, Inaktivitaet und echte
      Move-Intent-Stalls und aktiviert Bot-Auto-Fire wie der Spielpfad.
- [x] CTF-Rollen und One-Flag-Ziele sind ueber getrennte
      Entscheidungscontroller angebunden.

### Aktueller V2-Audio-Slice

- [x] Eigene Schritte mit V1-Geschwindigkeitstakt und Lautstaerke.
- [x] Gegner-Schritte mit V1-Distanzabfall und maximal zwei parallelen Sounds.
- [x] Erfolgreicher Jump-Start als serialisierbares Core-Event und V1-Sound.
- [x] Basic Autoshoot lokal und raeumlich.
- [x] Rocket-, Rail- und Whip-Sounds lokal; Gegnerwaffen raeumlich.
- [x] Death-Sound lokal und raeumlich.
- [x] Health-Pickup als Glass-/Air-Sequenz.
- [x] Armor- und Waffen-Pickup lokal und raeumlich.
- [x] Aktive Sounds werden bei Restart und Scene-Wechsel beendet.
- [ ] Eigener Damage-/Hurt-Sound benoetigt noch eine verbindliche V1-Referenz
      beziehungsweise Assetentscheidung.
- [x] SFX-/Mute-Settings folgen mit dem finalen Settings-Fluss.

## Meilenstein 5: Classic CTF als eigener GameMode

**Ziel:** Den V1-Hauptmodus vollstaendig in V2 abbilden.

Nur `ClassicCtfMode` besitzt:

- [x] Zwei Team-Flags.
- [x] Flag Pickup und Carry.
- [x] V1-konformer sofortiger Reset bei Tod oder Fall.
- [x] Capture-Regeln.
- [x] Capture-Score.
- [x] CTF-Endbedingungen.
- [x] CTF-spezifische HUD-Daten.
- [x] CTF-Spawns und Objective-Zustand.

Gemeinsam bleiben:

- [ ] Actors und Teams.
- [ ] Movement und Jump.
- [ ] Collision und Gaps.
- [ ] Combat und Waffen.
- [ ] Damage und Respawn.
- [ ] Match-Timer und generische Matchphasen.

**Architekturtest:** TDM erzeugt keinerlei Flag- oder CTF-Zustand. Dieser
Vertrag ist durch den Core-Smoke abgesichert.

## Meilenstein 6: One Flag / Center Flag

**Ziel:** Die Objective- und GameMode-Grenzen praktisch pruefen.

- [x] Eine neutrale Flagge oder ein Center-Objective definieren.
- [x] Mode-eigene Capture-Ziele definieren.
- [x] Gemeinsame Objective-Vertraege nur bei nachgewiesenem Bedarf erweitern.
- [x] Eigenen HUD-Zustand erzeugen.
- [x] Keine Annahme von exakt zwei Flags im gemeinsamen Core zulassen.
- [x] Classic CTF und TDM unveraendert lauffaehig halten.

**Stop-Bedingung:** Wenn One Flag Aenderungen an Classic-CTF- oder TDM-Regeln
erzwingt, wird zuerst die Objective-Grenze korrigiert.

### One-Flag-Foundation-Slice

- Der gemeinsame Flag-Factory-Vertrag unterstuetzt Team- und neutrale Flags.
- `OneFlagMode` erzeugt genau eine neutrale Flagge im Karten-Kampfzentrum.
- World-Factory, Match-Timer und isolierter HUD-Vertrag sind angelegt.
- Die neutrale Flagge kann von beiden Teams aufgenommen und getragen werden.
- Tod oder Fall setzt sie sofort ins Kartenzentrum zurueck.
- Ein Capture erfolgt in der gegnerischen Basis und endet bei drei Punkten.
- Renderer und HUD stellen die neutrale Flagge und ihren Zustand dar.
- Menue und Scene-Pfad starten One Flag auf allen drei V2-Karten.
- Dedizierte One-Flag-Botziele bleiben Teil von Meilenstein 8.

## Meilenstein 7: Maps und Content

- [x] Alle drei V1-Maps als Plain Data migrieren.
- [x] Allgemeine V2-Map-Registry implementieren.
- [x] Map-Auswahl an World-Factory und Renderer durchreichen.
- [x] Renderer von Training Crossing entkoppeln.
- [x] Training Crossing: Solids und Bounds migrieren.
- [x] Training Crossing: Gaps migrieren.
- [x] Training Crossing: Team-Spawns migrieren.
- [x] Training Crossing: Health-/Armor-Pickup-Platzierungen migrieren.
- [x] Objective-Slots beziehungsweise Flag-Basen migrieren.
- [x] Map-Daten beim Laden validieren.
- [x] Mode-Kompatibilitaet einer Map validieren.
- [x] Keine Phaser-GameObjects in Map-Daten speichern.
- [x] Training Crossing: V1-Optik und Platzierungen beibehalten.
- [x] Grand Archive: Solids, Gaps, Team-Spawns und Pickups migrieren.
- [x] Grand Archive: Bibliotheksassets, Lesetische, Kerzen, Staub und
      Spinnen als Phaser-Praesentation migrieren.
- [x] Flank Switch: Industriebarrieren, Wartungsgruben, Team-Spawns und
      Pickups migrieren.
- [x] Flank Switch: Metallboden, Basen, Energieleitungen, Junction und
      Randmaschinen als Phaser-Praesentation migrieren.
- [x] Flank Switch: TDM-Botnavigation gegen Solids und Gaps pruefen.
- [x] Neue Maps ohne Renderer- oder Scene-Sonderfall ladbar machen.
- [ ] Kerzenreaktionen auf Rocket- und Rail-Treffer migrieren.

### Map-Registry-/Grand-Archive-Slice

- `WORLD_MAPS`, `getWorldMap()` und `resolveWorldMap()` bilden die zentrale
  V2-Auswahl.
- `createTeamDeathmatchWorldState(map)` erzeugt Geometrie, Spawns und Pickups
  aus der ausgewaehlten Map.
- `PhaserArenaRendererPort` uebersetzt die Plain-Data-Praesentation am
  Adapterrand in das vorhandene Arena-Rendering.
- Unbekannte Map-IDs und inkompatible Mode-/Map-Konfigurationen werden vor
  Matchstart strikt abgelehnt und mit sichtbarer Ursache ins V2-Menue
  zurueckgefuehrt.
- Build, kompletter Core-Smoke, V2-Menue, Grand Archive Desktop/Local,
  Grand Archive Touch/Bot und Browser-Konsole wurden am 13.06.2026 geprueft.
- Flank Switch wurde am 14.06.2026 mit komplettem Core-Smoke,
  Touch/Bot-TDM, Desktop/Local-TDM und fehlerfreier Browser-Konsole geprueft.

## Meilenstein 8: Bots

**Ziel:** Bots verwenden dieselben Regeln und Inputs wie menschliche Actors.

- [x] Globale V2-Bodenbewegung fuer Spieler und Bots auf `72 %` reduzieren.
- [x] Authored Gaps und Hindernisse mit reduzierter Geschwindigkeit pruefen.
- [x] Minimalen TDM-Zielcontroller fuer Gegnerverfolgung erstellen.
- [x] Generische Grid-Navigation fuer Solids und Gaps erstellen.
- [x] Bots erzeugen dieselben Core-Action-Intents wie Spieler.
- [x] Geschwindigkeit als Bot-Konfiguration behandeln.
- [x] Jump Links als Map-Daten modellieren.
- [x] Bot-Jump-Unterstuetzung ueber das gemeinsame Jump-System implementieren.
- [x] Spezialwaffen ueber normale `fireWeapon`-Actions verwenden.
- [x] Grundlegendes TDM-Bot-Ziel implementieren.
- [x] CTF-Rollen implementieren.
- [x] One-Flag-Ziele fuer Bots implementieren.
- [x] Navigation und Entscheidung getrennt testen.
- [ ] Das alte Bot-Bewegungsexperiment bis dahin nicht anwenden.

### Movement-Balancing-Slice

- `V2_GROUND_PARITY_CONFIG.maxSpeed` wurde von `335` auf `268` und danach fuer
  bessere mobile Lesbarkeit nochmals um `10 %` auf `241.2` reduziert.
- Beschleunigung und Jump-Timing bleiben fuer direkte Vergleichbarkeit
  unveraendert; der Air-Speed-Multiplikator erhaelt die authored
  Sprungreichweiten.
- Audio und Bewegungseffekte beziehen ihren Speed-Massstab aus derselben
  Core-Konfiguration.
- Core-Smokes simulieren gehaltene Spruenge ueber alle Gaps und Solids von
  Training Crossing, Grand Archive und Flank Switch.
- Die fruehere Bot-Input-Magnitude `0.82` wurde mit der expliziten
  Bot-Geschwindigkeitskonfiguration neu bewertet und auf `1` gesetzt; Bots und
  Spieler nutzen damit dieselbe reduzierte Core-Geschwindigkeit.

### Bot-Navigation-Separation-Slice

- `BotMovementConfig` enthaelt die explizite Bot-Input-Magnitude; der Standard
  ist `1`, damit Bots denselben reduzierten Core-Speed wie Spieler verwenden.
- `GridBotNavigator` besitzt A*-Pfad, Repath-Timing und Wegpunktfortschritt.
- `TdmBotController` entscheidet nur ueber Actor-Ziel, Aim und Action-Intents.
- Navigation um Blocker, konfigurierbare Movement-Actions und die bestehende
  TDM-Langstreckennavigation werden getrennt im Core-Smoke geprueft.

### Bot-Jump-Link-Slice

- `WorldNavigation` und gerichtete `WorldJumpLink`-Daten bleiben
  serialisierbarer Core-Zustand und werden aus jeder V2-Karte in den Snapshot
  kopiert.
- Alle authored Gaps der drei V2-Karten besitzen beidseitige Jump Links mit
  sicheren Start- und Landepunkten.
- `GridBotNavigator` behandelt Jump Links als eigene A*-Kanten und signalisiert
  den Sprung erst im Aktivierungsradius am Absprungpunkt.
- `TdmBotController` erzeugt dafuer normale `jump`-Actions mit
  Press/Hold/Release; Bot-Sonderphysik existiert nicht.
- Ein Runtime-Smoke zwingt den Bot ueber eine vollstaendig sperrende Gap-Zone
  und prueft `actor.jumped`, erfolgreiche Landung und ausbleibenden Fall.
- Langstrecken-Navigation wird auf Training Crossing, Grand Archive und Flank
  Switch geprueft.

### Bot-Spezialwaffen-Slice

- `TdmBotCombatController` bewertet Kampfentscheidungen getrennt von
  `GridBotNavigator` und erzeugt ausschliesslich normale
  `fireWeapon`-Actions.
- Whip wird im Nahbereich, Rocket auf mittlere Distanz und Rail bevorzugt auf
  lange Distanz beziehungsweise als sichtbarer Fallback eingesetzt.
- Sichtlinie, Ammo, Rail-/Whip-Cooldowns, Waffenreichweiten und der
  V1-Bot-Schusstakt fuer Rockets werden vor der Action-Erzeugung geprueft.
- Treffer, Damage, Knockback, Ammo-Verbrauch und echte Waffen-Cooldowns
  bleiben in den gemeinsamen Core-Waffensystemen autoritativ.
- Entscheidungstests sind von Navigationstests getrennt; Runtime-Smokes
  pruefen Treffer, Ammo und Cooldown fuer Rocket, Rail und Whip.

### Classic-CTF-Botrollen-Slice

- `ClassicCtfBotDecisionController` haelt CTF-Zielwahl getrennt von
  `GridBotNavigator`, Movement, Jump und Combat.
- Angreifer holen die gegnerische Flagge, Carrier kehren zur eigenen Basis
  zurueck, Verteidiger reagieren auf Basis-Eindringlinge und patrouillieren,
  Support-Bots kontrollieren die Mitte oder eskortieren verbuendete Carrier.
- Eine gestohlene eigene Flagge ueberschreibt jede Rolle und wird vom
  gegnerischen Carrier zurueckgeholt.
- `ClassicCtfBotController` erzeugt ausschliesslich normale `move`-, `aim`-,
  `jump`- und `fireWeapon`-Actions.
- Der Solo-CTF-Pfad verwendet den roten Bot als Angreifer; alle drei Rollen
  besitzen getrennte Entscheidungstests.
- Ein Runtime-Smoke zwingt den Angreifer zu Flag-Pickup, Rueckweg und Capture
  durch die normalen Objective-, Navigation- und Jump-Regeln.

### One-Flag-Botziele-Slice

- `OneFlagBotDecisionController` behandelt One Flag getrennt von
  `TdmBotController`, `ClassicCtfBotDecisionController` und
  `GridBotNavigator`.
- Carrier laufen zur gegnerischen Basis, gegnerische Carrier werden gejagt,
  verbuendete Carrier eskortiert, freie Center-Flags geholt und ansonsten die
  Kartenmitte kontrolliert.
- `OneFlagBotController` erzeugt dafuer ausschliesslich normale `move`-,
  `aim`-, `jump`- und `fireWeapon`-Actions.
- Entscheidungstests bleiben getrennt; Runtime-Smokes pruefen Pickup,
  Eskorte, Carrier-Jagd und Capture fuer One Flag.

## Meilenstein 9: Mobile, UI und kompletter Spielablauf

- [x] Erste V2-Mode-Auswahl implementieren.
- [x] Erste V2-Map-Auswahl implementieren.
- [x] Solo-vs-Bot und lokales Zwei-Spieler-Setup konfigurierbar machen.
- [x] Schlanken V2-Startbildschirm implementieren.
- [x] Rueckkehr vom laufenden V2-Match zum Hauptmenue ermoeglichen.
- [x] Ergebnisbildschirm mit Rueckkehr ins V2-Menue vervollstaendigen.
- [x] Restart und Rematch implementieren.
- [ ] Desktop-HUD finalisieren.
- [ ] Mobile-HUD finalisieren.
- [x] Touch-Steuerung mit V1-Paritaet anbinden.
- [x] Touch-Overlay und WASD/Space koennen denselben P1 steuern.
- [x] Settings und Audiooptionen integrieren.
- [x] UI konfiguriert nur Matchdaten und enthaelt keine Spielregeln.

### Arena-Flow-/Settings-Slice

- `PhaserArenaHudPort` ersetzt den TDM-spezifisch benannten Match-HUD-Port als
  gemeinsamen V2-Arena-HUD-Pfad fuer TDM, Classic CTF und One Flag.
- Ergebnisanzeige, Restart-Hinweise und der Rueckweg ins V2-Menue laufen ueber
  denselben opt-in-Flow; Desktop verwendet `R` fuer Restart und `M` fuer Menu,
  Touch verwendet Tap fuer Restart plus den gemeinsamen Menu-Button.
- Das V2-Menue und der laufende Match-Pfad teilen sich eine gemeinsame
  Routen-/Matchkonfiguration fuer Modus, Map, `players`, `controls` und
  `sfx`; die Menue-Rueckkehr behaelt diese Werte bei.
- SFX-Mute bleibt eine Adapter-/Praesentationsentscheidung: das V2-Menue
  bietet `SFX on/off`, der laufende Match-Pfad besitzt dafuer einen
  gemeinsamen DOM-Button, und der Core kennt diese Option nicht.

## Meilenstein 10: Produktionsqualitaet

- [x] Simulationsschritte und `dt`-Grenzen festlegen.
- [x] Tab-Wechsel und lange Frame-Pausen korrekt behandeln.
- [ ] Performance mit vielen Actors und Projectiles messen.
- [ ] Objekt-Pooling nur bei nachgewiesenem Bedarf einsetzen.
- [ ] Audio- und Effekt-Events vollstaendig abdecken.
- [x] Pause-Verhalten definieren.
- [x] Verschiedene Aufloesungen testen.
- [x] Desktop-Browser testen.
- [ ] Relevante Mobile-Browser testen.
- [x] Deterministische Core-Tests ausbauen.
- [x] Regressionstests fuer jeden Modus pflegen.
- [x] Ungueltige Maps und Konfigurationen sauber ablehnen.
- [x] Production Build pruefen.
- [ ] V2 erst nach vollstaendiger Abnahme zum Standard machen.

### Runtime-Haertungs-/Validierungs-Slice

- `GameplayCoreRuntime` klemmt uebergrosse Frame-Deltas zentral auf einen
  verbindlichen Maximalwert, statt Match-, Actor-, Pickup- und Combat-Zeit
  ungebremst fortzuschreiben.
- `GameplayV2Scene` pausiert die Simulation bei `document.hidden` und
  verwirft den ersten Rueckkehr-Frame, damit Tab-Wechsel und Fokusverlust nicht
  zu einem grossen Nachhol-Update fuehren.
- V2-Routen werden vor Matchstart strikt geprueft; ungueltige `mode`-,
  `map`-, `players`- oder `controls`-Werte starten kein Match mehr, sondern
  fuehren mit sichtbarer Ursache ins V2-Menue zurueck.
- `validateWorldMapForMode()` und `assertWorldMapSupportsMode()` sichern Bases,
  Team-Spawns und fuer One Flag die Combat-Zone als mode-relevante
  Mindestvertraege ab.

### Abschlussabnahme vom 15.06.2026

- Production Build und vollstaendiger Core-Smoke sind erfolgreich; als einzige
  Build-Meldung bleibt die bekannte Vite-Warnung zur Chunkgroesse.
- Die komplette V2-Matrix aus drei Modi, drei Karten und den Setups
  Desktop/Local, Desktop/Bot und Touch/Bot wurde in 27 Browserstarts ohne
  Konsolenfehler geprueft.
- Desktop-Input, Touch-Stick, Touch-Jump, gemeinsamer Menu-Pfad und
  SFX-Umschaltung wurden im laufenden Match direkt ausgeloest.
- Desktop `1280x720`, Mobile Portrait `390x844` und Mobile Landscape
  `844x390` halten Canvas, HUD und Touch-Bedienelemente innerhalb des
  sichtbaren Bereichs.
- V1 startet weiterhin unter `/CTF/`; V2 bleibt opt-in und lehnt ungueltige
  Routen sichtbar ab.
- Offen bleiben reale Mobile-Browser-/Geraetetests, Lastmessungen mit vielen
  Actors und Projectiles, die verbindliche Damage-/Hurt-Sound-Entscheidung,
  Kerzenreaktionen sowie die finale Desktop-/Mobile-HUD-Politur.
- V2 wird erst nach Schliessen dieser Produktluecken und einer ausdruecklichen
  finalen Abnahme zum Standard.

## Qualitaets-Gate fuer jeden Meilenstein

Ein Meilenstein gilt nur als abgeschlossen, wenn:

- [ ] `npm.cmd run build` erfolgreich ist.
- [ ] Alle Core- und Smoke-Checks erfolgreich sind.
- [ ] `/CTF/` weiterhin V1 startet.
- [ ] `/CTF/?scene=v2` beziehungsweise die neue V2-Route fehlerfrei startet.
- [ ] Keine Browser-Konsolenfehler auftreten.
- [ ] Keine V1-Datei unbeabsichtigt veraendert wurde.
- [ ] Neue Regeln im Core oder im passenden `GameMode` liegen.
- [ ] Scene, Renderer und HUD keine autoritativen Spielregeln enthalten.
- [ ] Manuelle Spielpruefung bestanden wurde.
- [ ] Bekannte Grenzen dokumentiert wurden.
- [ ] Der Aenderungsumfang vor dem Commit geprueft wurde.
- [ ] Nur auf ausdrueckliche Anweisung gepusht wurde.

## Architektur-Stop-Bedingungen

Bei einem dieser Punkte wird nicht einfach weitergebaut:

- [ ] `InertCoreRuntime` oder sein Nachfolger entwickelt sich erneut zum
      unkontrollierten Godfile.
- [ ] Ein gemeinsames System fragt nach einem konkreten Modusnamen.
- [ ] CTF-Annahmen gelangen in Actor, Movement, Combat oder ScoreBoard.
- [ ] Renderer oder HUD veraendern Score, MatchState, Objectives oder Spawns.
- [ ] Ein neuer Modus erfordert Aenderungen an den Regeln eines bestehenden
      Modus.
- [ ] Phaser- oder DOM-Objekte gelangen in autoritativen Core-Zustand.
- [ ] V1-Paritaet wird durch nicht abgestimmte Verbesserungen verwischt.
- [ ] Diagnosecode wird zur dauerhaften Produktionsarchitektur.
- [ ] Bot-Sonderbewegung umgeht das gemeinsame Movement- oder Jump-System.

## Naechste verbindliche Schritte

- [x] Phase 19 manuell abnehmen.
- [x] Phase 19 committen.
- [x] Meilenstein 1: Runtime konsolidieren.
- [x] Meilenstein 2: spielbaren TDM-Slice manuell abnehmen und abschliessen.
- [ ] Meilenstein 3: V1-Feeling systematisch abgleichen.
- [x] V1-Feedback-Slice: Bewegungsspur, Rocket-Smoke/-Explosion,
      Rail-/Whip-Feedback und Todesburst migrieren.
- [ ] Meilenstein 4: V1-Waffen migrieren.
- [ ] Meilenstein 5: Classic CTF als eigenen Modus implementieren.
- [x] Meilenstein 6: One Flag als Architekturtest implementieren.
- [ ] Danach Maps, Bots, Mobile, UI und Produktionshaertung ausbauen.
