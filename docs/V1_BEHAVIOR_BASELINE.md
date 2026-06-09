# V1 Playable Behavior Baseline

Stand: 9. Juni 2026

Diese Datei beschreibt den aktuellen spielbaren V1-Zustand als Referenz fuer
den spaeteren Gameplay-Core V2. Sie dokumentiert den derzeitigen Arbeitsbaum,
einschliesslich bereits vorhandener, nicht committeter Aenderungen.

## Build-Baseline

- Projekt: Phaser 3, TypeScript und Vite
- Verifiziertes Kommando: `npm.cmd run build`
- Das Kommando fuehrt `tsc && vite build` aus.
- Ergebnis am 9. Juni 2026: erfolgreich
- Vite meldet nur eine Warnung, dass das erzeugte JavaScript-Chunk groesser
  als 500 kB ist. Das ist kein Build-Fehler.

## Aktuelle CTF-Regeln

### Teams

- Es gibt genau zwei Teams: Rot und Blau.
- Der menschliche Spieler gehoert immer zum roten Team.
- Die restlichen Teamplaetze werden mit Bots besetzt.
- Im Menue sind pro Team ein bis vier Einheiten einstellbar.

### Punkte und Matchende

- Ein Capture gibt dem Team einen Punkt.
- Das Punktelimit liegt bei 3 Captures.
- Die maximale Matchdauer liegt bei 180 Sekunden.
- Das Team, das zuerst 3 Punkte erreicht, gewinnt sofort.
- Nach Ablauf der Zeit gewinnt das Team mit mehr Punkten.
- Bei gleichem Punktestand nach Ablauf der Zeit endet das Match unentschieden.

### Flaggenverhalten

- Beide Teams besitzen eine Flagge in ihrer jeweiligen Basis.
- Eine Einheit nimmt die gegnerische Flagge automatisch auf, wenn sie sich
  ihr auf weniger als 36 Welteinheiten naehert.
- Eine Einheit kann nur eine Flagge tragen.
- Ein Capture erfolgt, sobald ein Flaggentraeger seine eigene Basis betritt.
- Der aktuelle Code verlangt fuer einen Capture nicht, dass die eigene Flagge
  zu Hause ist.
- Es gibt keinen dauerhaften Zustand fuer eine am Boden liegende Flagge.
- Stirbt eine Einheit oder faellt der Spieler in einen Abgrund, wird die
  getragene Flagge sofort zu ihrem Startpunkt zurueckgesetzt.
- Eine manuelle Rueckgabe durch Beruehren einer fallengelassenen eigenen Flagge
  existiert deshalb derzeit nicht.

Implementierung:

- `src/systems.ts`: `FlagSystem`
- `src/scenes/ArenaScene.ts`: Aufruf der Flaggenlogik und Reaktion auf Tod/Fall
- `src/matchFlow.ts`: Punktelimit, Zeitablauf und Gewinner

## Spielerbewegung

### Desktop-Steuerung

- Bewegung: `WASD` oder Pfeiltasten
- Sprung: Leertaste
- Peitsche: `F`
- Raketenwerfer und Railgun werden ueber die eingeblendeten Waffenbuttons
  ausgeloest und gezielt.

### Mobile-Steuerung

- Virtueller Joystick auf der linken Bildschirmseite
- Eigener Sprungbutton
- Eigene Buttons fuer Raketenwerfer, Railgun und Peitsche
- Raketenwerfer und Railgun koennen durch Ziehen gezielt werden.
- Kurzes Antippen der Waffenbuttons verwendet automatische Zielwahl.

### Bewegungswerte und Verhalten

- Bodenbeschleunigung: `1580`
- Maximale Bodengeschwindigkeit: `335`
- Bewegung verwendet Beschleunigung, Reibung und Richtungswechsel-Strafen.
- Seitliches Beschleunigen kann einen Strafe-Bonus erhalten.
- Ohne Eingabe wird staerker abgebremst als bei gehaltener Eingabe.
- In der Luft gelten reduzierte Luftkontrolle und geringere Luftreibung.
- Die maximale Luftgeschwindigkeit liegt bei 108 Prozent der
  Boden-Hoechstgeschwindigkeit.
- Beim Absprung aus sehr niedriger Geschwindigkeit gibt es einen kleinen
  Schub in die letzte Bewegungsrichtung.

### Kollision, Abgruende und Respawn

- Der Spieler wird innerhalb der Kartenbegrenzung gehalten.
- Am Boden wird seine Kreis-Kollision gegen Waende aufgeloest.
- Waehrend eines ausreichend hohen Sprungs wird die Wandkollision
  voruebergehend ignoriert.
- Abgruende besitzen verkleinerte Gefahrenzonen.
- Befindet sich der Spieler in einer Gefahrenzone und der Sprung ist nicht
  hoch genug, beginnt der Fallzustand.
- Sichere Bodenpositionen werden regelmaessig gespeichert.
- Nach einem Fall erscheint der Spieler nach 420 ms an der letzten sicheren
  Position.

Implementierung:

- `src/player.ts`: `updateGroundMovement`, `MovementController`, `JumpSystem`
- `src/systems.ts`: `CollisionSystem`
- `src/scenes/ArenaScene.ts`: Eingabe und Bewegungsablauf

## Short Jump und Long/Held Jump

- Beide Sprungvarianten sind im `JumpSystem` in `src/player.ts` implementiert.
- Ein Sprung startet mit einer geplanten Mindestdauer von 180 ms.
- Wird die Sprungtaste schnell losgelassen, bleibt es bei einem kurzen Sprung.
- Solange die Taste gehalten wird, wird die geplante Sprungdauer verlaengert.
- Die maximale geplante Sprungdauer liegt bei 620 ms.
- Der gehaltene Sprung bleibt dadurch laenger in der Luft und legt bei
  vorhandener Geschwindigkeit eine groessere horizontale Strecke zurueck.
- Kurzer und gehaltener Sprung bleiben getrennte Eingabeverhalten. Sie duerfen
  bei einer spaeteren Migration nicht zusammengelegt werden.
- Die maximale berechnete Sprunghoehe ist fuer beide Varianten `62`; die
  unterschiedliche Dauer bestimmt vor allem Flugzeit und Reichweite.
- Ein Sprung gilt ab 34 Prozent der maximalen Hoehe als hoch genug, um einen
  Abgrund nicht als Fall auszuloesen.
- Wandkollision wird ab 50 Prozent der maximalen Sprunghoehe ignoriert.
- Der Code markiert keine konkrete Luecke als "Short Jump" oder "Long Jump".
  Welche Kartenstellen einen gehaltenen Sprung erfordern, muss deshalb
  manuell im Spiel getestet werden.

## Waffen

### Automatischer Standardschuss

- Spieler und lebende Bots suchen automatisch sichtbare Gegner.
- Reichweite: `520`
- Schussintervall: `3000 ms`
- Projektilgeschwindigkeit: `286`
- Schaden: `18`
- Waende blockieren Sichtlinie und Projektile.
- Friendly Fire ist deaktiviert.
- Flaggentraeger werden bei der Zielauswahl bevorzugt.

### Raketenwerfer

- Munition pro normalem Pickup: `5`
- Projektilgeschwindigkeit: `371`
- Maximaler Explosionsschaden: `45`
- Explosionsradius: `105`
- Rueckstoss-Staerke: `230`
- Raketen explodieren bei Wand- oder Einheitentreffern.
- Schaden und Rueckstoss nehmen mit der Entfernung zum Explosionszentrum ab.
- Waende koennen Explosionswirkung blockieren.
- Der Spieler feuert Raketen manuell oder mit automatischer Zielwahl.
- Bots koennen aufgenommene Raketen ueber ihr AutoAttack-Verhalten einsetzen.

### Railgun

- Munition pro Pickup: `5`
- Cooldown: `2500 ms`
- Reichweite: `1100`
- Treffer erfolgt sofort entlang einer geraden Linie.
- Schaden: 95 Prozent der maximalen Lebenspunkte des getroffenen Ziels.
- Waende stoppen den Strahl.
- In der Bibliothek kann der Strahl Kerzen entlang der Schusslinie loeschen.
- Bots koennen Railgun-Pickups derzeit nicht aufnehmen; die Railgun ist damit
  im normalen Spiel Spieler-exklusiv.

### Peitsche

- Munition pro Pickup: `8`
- Cooldown: `800 ms`
- Reichweite: `120`
- Angriffshalbwinkel: 35 Grad
- Schaden: `35`
- Getroffen wird der naechste sichtbare Gegner im Angriffskegel.
- Bots koennen Peitschen-Pickups derzeit nicht aufnehmen.

## Pickups

### Gesundheit

- Heilt 50 Prozent der maximalen Lebenspunkte der aufnehmenden Einheit.
- Heilung kann die jeweiligen maximalen Lebenspunkte nicht ueberschreiten.

### Ruestung

- Gibt Ruestung in Hoehe von 25 Prozent der maximalen Lebenspunkte.
- Ruestung absorbiert Schaden vor den Lebenspunkten.

### Waffenmunition

- Rakete: 5 Schuss
- Railgun: 5 Schuss
- Peitsche: 8 Schlaege
- Bots ignorieren Railgun- und Peitschen-Pickups.

### Respawn und fallengelassene Munition

- Feste Pickups erscheinen 20 Sekunden nach Aufnahme erneut.
- Beim Tod wird vorhandene Waffenmunition als temporaeres Pickup abgelegt.
- Spieler lassen Raketen-, Railgun- und Peitschenmunition fallen.
- Bots lassen vorhandene Raketen- und Railgunmunition fallen.
- Temporaere Munitions-Pickups verschwinden nach 15 Sekunden.
- Die verbleibende Munitionsmenge wird beim Drop uebernommen.

## Bots

### Rollen

- `attacker`
- `defender`
- `support`
- Bei einem vierten Bot wird erneut die Rolle `attacker` vergeben.

### Aktuelles Zielverhalten

Bots koennen derzeit:

- die gegnerische Flagge holen
- eine getragene Flagge zur eigenen Basis bringen
- gegnerische Flaggentraeger verfolgen
- eine gestohlene eigene Flagge abfangen
- verbuendete Flaggentraeger begleiten
- die eigene Basis verteidigen und patrouillieren
- den mittleren Kartenbereich kontrollieren
- bei niedriger Gesundheit Heilung suchen oder sich zurueckziehen
- passende Pickups suchen
- Gegner automatisch beschiessen
- per Grid-Navigation Wege um Waende und Abgruende suchen
- bei erkennbarem Feststecken neu planen und seitlich ausweichen

### Bekannte Einschraenkungen

- Die Designvorgabe lautet, dass Bots absichtlich langsamer als der Spieler
  sein sollen.
- Im aktuellen Arbeitsbaum verwenden Bots jedoch bereits
  `updateGroundMovement()` und damit dasselbe konfigurierte
  Geschwindigkeitslimit `T.maxSpeed` wie der Spieler am Boden.
- Ob Bots im aktuellen spielbaren Build tatsaechlich noch langsamer wirken,
  muss vor dem Tagging manuell geprueft werden. Die dokumentierte
  Designabsicht und der sichtbare Codezustand stimmen hier nicht eindeutig
  ueberein.
- Bots koennen derzeit nicht springen.
- Bots besitzen kein `JumpSystem`.
- Bots verwenden nicht den vollstaendigen `MovementController` des Spielers,
  sondern nur den gemeinsamen Bodenbewegungshelfer.
- Bot-Navigation behandelt Abgruende als blockierte Flaechen.
- Es gibt im aktuellen Kartenschema keine `jumpLinks`.
- Navigation, Zielentscheidung, Lebenszustand und Bewegung sind noch in der
  Klasse `Bot` gebuendelt.

## Tod und Respawn

### Spieler

- Spieler-Maximalleben: `100`
- Ruestung wird vor den Lebenspunkten verbraucht.
- Bei null Lebenspunkten wechselt der Spieler in den Zustand `dead`.
- Die Geschwindigkeit wird auf null gesetzt und ein aktiver Sprung beendet.
- Nach `900 ms` respawnt der Spieler am roten Team-Spawn.
- Leben wird vollstaendig aufgefuellt.
- Ruestung und alle Waffenmunition werden beim Respawn auf null gesetzt.
- Beim Tod wird vorhandene Waffenmunition vorher als temporaeres Pickup
  abgelegt.

### Bots

- Bot-Maximalleben: `70`
- Bei null Lebenspunkten wird der Bot fuer `900 ms` deaktiviert.
- Geschwindigkeit und Ruestung werden auf null gesetzt.
- Danach respawnt der Bot an seinem individuellen Team-Spawn.
- Leben wird vollstaendig aufgefuellt; Ruestung und Munition werden geleert.

### Flaggen bei Tod oder Fall

- Beim Tod eines Spielers oder Bots wird eine getragene Flagge sofort an ihren
  Startpunkt zurueckgesetzt.
- Beim Fall des Spielers wird die Flagge ebenfalls sofort zurueckgesetzt.
- Es bleibt keine aufnehmbare Flagge am Todes- oder Fallort liegen.

## Matchende, Neustart und Menue

- Vor jedem gestarteten Match laeuft ein Countdown von 3 Sekunden.
- Waehrend Countdown und Ergebnisbildschirm wird die Spielsimulation nicht
  normal fortgesetzt.
- Die Matchzeit beginnt bei `3:00`.
- Das Match endet sofort bei 3 Punkten oder nach Ablauf der Zeit.
- Der Ergebnisbildschirm zeigt Gewinner oder Unentschieden sowie den
  Endpunktestand.
- `Play again` startet dieselbe Karten- und Teamkonfiguration neu.
- `Main menu` oeffnet das Hauptmenue.
- Kartenwahl und Teamgroessen werden im Browser unter
  `ctf-match-settings` gespeichert.
- Karten- oder Team-Aenderungen in den Einstellungen starten die Szene mit
  den neuen Einstellungen neu.

## Karten

### Training Crossing

- Ruinen-Thema
- Kartengroesse: `1500 x 820`
- Symmetrische Basen und kurze CTF-Wege
- Zentraler Kampfbereich
- Zwei Abgruende als Sprung- beziehungsweise Flankenbereiche
- Eigene Ruinen-Dekorationen und Banner

### Grand Archive

- Bibliotheks-Thema
- Kartengroesse: `2500 x 820`
- Lange Galerien, Regale, Lesetische und vier eingestuerzte Bodenbereiche
- Bibliotheksatmosphaere mit Kerzen und weiteren Effekten
- Projektile koennen Bibliothekseffekte ausloesen.
- Railgun-Strahlen koennen Kerzen entlang des Strahls loeschen.

### Flank Switch

- Industrielles Thema
- Kartengroesse: `2500 x 820`
- Drei Hauptwege und mehrere Querverbindungen
- Vier Wartungsgruben als Abgruende
- Industrielle Barrieren, Energie-Dekorationen und eigene Team-Basen

Alle drei Karten enthalten derzeit verpflichtend:

- roten und blauen Spawn
- rote und blaue Basis
- feste Pickup-Positionen
- Angreifer- und Verteidiger-Routen fuer Bots

## Bekannte Probleme und Grenzen

- Die Spielstruktur ist tief auf klassisches CTF und genau zwei Teams
  zugeschnitten.
- `src/scenes/ArenaScene.ts` ist mit etwa 953 Zeilen ein Godfile und mischt
  Aufbau, Update-Schleife, Eingabe, Kampf, Rendering, HUD und Menuefluss.
- `src/systems.ts` ist mit etwa 703 Zeilen ein zweites Godfile und mischt
  Navigation, Kollision, Flaggen, Bot-KI, Projektile, Pickups und AutoAttack.
- Bots verwenden noch keine vollstaendige spieleraehnliche Bewegung.
- Bots koennen nicht springen und verwenden keine `jumpLinks`.
- Es existieren noch keine weiteren Spielmodi.
- Es gibt keine allgemeine GameMode-, Objective-, Event- oder
  ScoreBoard-Schnittstelle.
- Team Deathmatch besitzt noch keine Kill-Zuordnung oder Kill-Punkte.
- One Flag beziehungsweise Center Flag passt nicht sauber in das aktuelle
  `FlagSystem`.
- Es wurden keine automatisierten Tests oder Testdateien gefunden.
- Die V1-Baseline muss deshalb vor dem Tagging manuell im Browser getestet
  werden.
- Der Produktions-Build erzeugt aktuell ein grosses JavaScript-Chunk und
  meldet dafuer eine Vite-Warnung.

## Empfohlener manueller Baseline-Test

Vor dem Tagging sollten mindestens folgende Punkte auf allen drei Karten
geprueft werden:

1. Matchstart, 3-Sekunden-Countdown und laufender Timer
2. Spielerbewegung mit WASD, Pfeiltasten und Mobile-Joystick
3. kurzer Sprung durch Antippen und langer Sprung durch Halten
4. alle vorgesehenen Abgruende und Wand-Sprungstellen
5. AutoShot, Raketenwerfer, Railgun und Peitsche
6. Gesundheit, Ruestung und alle Munitions-Pickups
7. Pickup-Respawn und temporaere Munitions-Drops
8. Spieler- und Bot-Tod sowie Respawn
9. Flaggenaufnahme, Capture und Ruecksetzung bei Tod beziehungsweise Fall
10. Bot-Rollen, CTF-Ziele, Navigation und tatsaechliche Bot-Geschwindigkeit
11. Sieg bei 3 Punkten, Zeitablauf, Unentschieden und Ergebnisbildschirm
12. `Play again`, Hauptmenue, Kartenwechsel und Teamgroessenwechsel
13. Desktop- und Mobile-Steuerung

## Vorgeschlagener Git-Tag

`v1-playable-baseline`

Der Tag sollte erst nach erfolgreichem manuellen Baseline-Test und nachdem
bewusst entschieden wurde, welche bereits vorhandenen Arbeitsbaum-Aenderungen
Teil von V1 sein sollen, erstellt werden.
