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
- [ ] Rocket Launcher migrieren.
- [ ] Railgun migrieren.
- [ ] Whip migrieren.

Fuer jede Waffe:

- [ ] Fire-Regeln und Eingaben abgleichen.
- [ ] Cooldowns abgleichen.
- [ ] Ammo und Ressourcen abgleichen.
- [ ] Reichweite und Trefferverhalten abgleichen.
- [ ] Damage und Knockback abgleichen.
- [ ] Projectile- oder Hitscan-Daten im Core halten.
- [ ] Gameplay-Events definieren.
- [ ] Darstellung, Audio und Effekte ueber Adapter ausloesen.
- [ ] Passende Pickups integrieren.
- [ ] Regressionstests fuer Treffer, Schaden und Cooldown ergaenzen.

**Abschlusskriterium:** Jede V1-Waffe funktioniert bereits in TDM und fuehlt
sich wie ihre V1-Version an.

### Aktueller spielbarer Mobile-TDM-Slice

- [x] Touch-Stick und Jump-Button verwenden dieselben Core-Actions wie Desktop.
- [x] Basic Autoshoot funktioniert mit V1-Werten.
- [x] Touch-Kamera folgt dem Blue Player.
- [x] Match-Ende kann per Tap neu gestartet werden.
- [x] Desktop-TDM behaelt lokale Zwei-Spieler-Steuerung.
- [x] Training Crossing verwendet V1-Ruinenassets und Charakter-Sprites.
- [x] Teamseiten, Health-/Armor-Pickups und Pickup-Werte entsprechen V1.
- [ ] Ein mobiler Einzelspieler-Gegner erfordert spaeter die geplante Bot-KI.

## Meilenstein 5: Classic CTF als eigener GameMode

**Ziel:** Den V1-Hauptmodus vollstaendig in V2 abbilden.

Nur `ClassicCtfMode` besitzt:

- [ ] Zwei Team-Flags.
- [ ] Flag Pickup und Carry.
- [ ] Flag Drop.
- [ ] Flag Return und Auto-Return.
- [ ] Capture-Regeln.
- [ ] Capture-Score.
- [ ] CTF-Endbedingungen.
- [ ] CTF-spezifische HUD-Daten.
- [ ] CTF-Spawns und Objective-Zustand.

Gemeinsam bleiben:

- [ ] Actors und Teams.
- [ ] Movement und Jump.
- [ ] Collision und Gaps.
- [ ] Combat und Waffen.
- [ ] Damage und Respawn.
- [ ] Match-Timer und generische Matchphasen.

**Architekturtest:** TDM erzeugt keinerlei Flag- oder CTF-Zustand.

## Meilenstein 6: One Flag / Center Flag

**Ziel:** Die Objective- und GameMode-Grenzen praktisch pruefen.

- [ ] Eine neutrale Flagge oder ein Center-Objective definieren.
- [ ] Mode-eigene Capture-Ziele definieren.
- [ ] Gemeinsame Objective-Vertraege nur bei nachgewiesenem Bedarf erweitern.
- [ ] Eigenen HUD-Zustand erzeugen.
- [ ] Keine Annahme von exakt zwei Flags im gemeinsamen Core zulassen.
- [ ] Classic CTF und TDM unveraendert lauffaehig halten.

**Stop-Bedingung:** Wenn One Flag Aenderungen an Classic-CTF- oder TDM-Regeln
erzwingt, wird zuerst die Objective-Grenze korrigiert.

## Meilenstein 7: Maps und Content

- [ ] Alle drei V1-Maps als Plain Data migrieren.
- [x] Training Crossing: Solids und Bounds migrieren.
- [x] Training Crossing: Gaps migrieren.
- [x] Training Crossing: Team-Spawns migrieren.
- [x] Training Crossing: Health-/Armor-Pickup-Platzierungen migrieren.
- [ ] Objective-Slots beziehungsweise Flag-Basen migrieren.
- [ ] Map-Daten beim Laden validieren.
- [ ] Mode-Kompatibilitaet einer Map validieren.
- [ ] Keine Phaser-GameObjects in Map-Daten speichern.
- [x] Training Crossing: V1-Optik und Platzierungen beibehalten.
- [ ] Neue Maps ohne Scene-Aenderung ladbar machen.

## Meilenstein 8: Bots

**Ziel:** Bots verwenden dieselben Regeln und Inputs wie menschliche Actors.

- [ ] `BotDecisionSystem` fuer Ziele und Absichten erstellen.
- [ ] `BotNavigationSystem` fuer Route und Jump Links erstellen.
- [ ] Bots erzeugen dieselben Core-Action-Intents wie Spieler.
- [ ] Geschwindigkeit als Bot-Konfiguration behandeln.
- [ ] Jump Links als Map-Daten modellieren.
- [ ] Bot-Jump-Unterstuetzung ueber das gemeinsame Jump-System implementieren.
- [ ] TDM-Bot-Ziele implementieren.
- [ ] CTF-Rollen implementieren.
- [ ] One-Flag-Ziele implementieren.
- [ ] Navigation und Entscheidung getrennt testen.
- [ ] Das alte Bot-Bewegungsexperiment bis dahin nicht anwenden.

## Meilenstein 9: Mobile, UI und kompletter Spielablauf

- [ ] Mode-Auswahl implementieren.
- [ ] Map-Auswahl implementieren.
- [ ] Matchkonfiguration implementieren.
- [ ] Start- und Ergebnisbildschirm implementieren.
- [ ] Restart und Rematch implementieren.
- [ ] Desktop-HUD finalisieren.
- [ ] Mobile-HUD finalisieren.
- [x] Touch-Steuerung mit V1-Paritaet anbinden.
- [ ] Settings und Audiooptionen integrieren.
- [ ] UI konfiguriert nur Matchdaten und enthaelt keine Spielregeln.

## Meilenstein 10: Produktionsqualitaet

- [ ] Simulationsschritte und `dt`-Grenzen festlegen.
- [ ] Tab-Wechsel und lange Frame-Pausen korrekt behandeln.
- [ ] Performance mit vielen Actors und Projectiles messen.
- [ ] Objekt-Pooling nur bei nachgewiesenem Bedarf einsetzen.
- [ ] Audio- und Effekt-Events vollstaendig abdecken.
- [ ] Pause-Verhalten definieren.
- [ ] Verschiedene Aufloesungen testen.
- [ ] Desktop-Browser testen.
- [ ] Relevante Mobile-Browser testen.
- [ ] Deterministische Core-Tests ausbauen.
- [ ] Regressionstests fuer jeden Modus pflegen.
- [ ] Ungueltige Maps und Konfigurationen sauber ablehnen.
- [ ] Production Build pruefen.
- [ ] V2 erst nach vollstaendiger Abnahme zum Standard machen.

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
- [ ] Meilenstein 4: V1-Waffen migrieren.
- [ ] Meilenstein 5: Classic CTF als eigenen Modus implementieren.
- [ ] Meilenstein 6: One Flag als Architekturtest implementieren.
- [ ] Danach Maps, Bots, Mobile, UI und Produktionshaertung ausbauen.
