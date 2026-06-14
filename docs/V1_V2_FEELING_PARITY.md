# V1/V2 Feeling Parity

## Referenz

V1 bleibt die verbindliche Referenz. Die relevanten Implementierungen liegen
in:

- `src/config.ts`
- `src/player.ts` (`MovementController`, `JumpSystem`, `Player`)
- `src/systems.ts` (`CollisionSystem`)
- `src/scenes/ArenaScene.ts` (Update-Reihenfolge, Input, Kamera, Darstellung)

## Bereits gespiegelt

- Beschleunigung: `1580`
- V1-Maximalgeschwindigkeit: `335`
- V2-Maximalgeschwindigkeit: bewusst auf `268` reduziert (`80 %`), da sich
  `335` insbesondere auf Touch deutlich zu schnell anfuehlt.
- Bodenreibung: `7`
- Reibung mit Input: `1.25`
- Luftreibung: `1.05`
- Luftkontrolle: `0.72`
- Luft-Maximalgeschwindigkeit: Faktor `1.08`
- Turn-Penalty: `0.68` ab Dot-Produkt `< -0.28`
- Strafe-Bonus: `1.12`
- Simulations-dt: maximal `34 ms`
- Positionsfaktor: `0.93`
- Kurzer Sprung: mindestens `180 ms`
- Gehaltener Sprung: maximal `620 ms`, Verlängerungsrate `1.18`
- Sprunghöhe: `62`
- Jump-Cooldown: `540 ms`
- Gap-Clear-Schwelle: `34 %` der Sprunghöhe
- Fall-Respawn: `420 ms`
- Death-Respawn: `900 ms`
- Safe-Position-Intervall: `120 ms`
- Actor-Radius: `16`
- Leben: `100`
- maximales Armor-Cap: `100`
- Basic Autoshoot: Reichweite `520`, Cooldown `3000 ms`
- Basic-Projektil: Speed `286`, Damage `18`, Radius `9`, TTL `2600 ms`
- Pickups: Radius `22`, Respawn `20000 ms`, Health `50`, Armor `25`

## Bewusste Movement-Balance-Abweichung

- Beschleunigung, Bremsung, Luftkontrolle, Sprunghoehe und Sprungdauer bleiben
  zunaechst unveraendert.
- Spieler und Bots verwenden denselben reduzierten Core-Geschwindigkeitswert.
- Audio-Schrittfrequenz und Bewegungsspur skalieren ueber denselben
  `V2_GROUND_PARITY_CONFIG`-Wert.
- Deterministische Smokes pruefen jedes authored Gap und Solid auf allen drei
  Karten mit einem gehaltenen Sprung bei `268`.
- Short-Jump- und Long-Jump-Unterschied, Landung und Jump-Events bleiben
  weiterhin separat abgesichert.

## Update-Reihenfolge

V2 behält die V1-Reihenfolge für kontrollierte Actors bei:

1. Jump-Input und Jump-State aktualisieren.
2. Ground-/Air-Movement aktualisieren.
3. Position integrieren.
4. Bounds, Solids, Gaps und Safe Position auswerten.

## Darstellung

Der diagnostische V2-Renderer verwendet für Sprunghöhe, Skalierung und
Schatten dieselben Faktoren wie V1. Die V2-Kamera folgt dem Mittelpunkt der
aktiven Spieler mit dem V1-Lerp-Faktor `0.12`. Bei einem Spieler entspricht
das dem V1-Follow; bei zwei lokalen Spielern ist es eine notwendige
Shared-Camera-Abweichung.

## Bewusste Restabweichungen

- V2 verwendet noch Diagnoseformen statt der V1-Sprites und Animationen.
- Der aktuelle TDM-Slice verwendet eine gemeinsame Kamera für zwei lokale
  Spieler.
- Basic Autoshoot, Rocket, Railgun und Whip sind mit Core-Regeln, Effekten
  und Audioadaptern migriert.
- Mobile Input ist über dieselben Core-Actions angebunden. Touchgeräte werden
  automatisch erkannt; `&controls=mobile` erzwingt den Test auf Desktop.
- Im mobilen TDM folgt die Kamera dem Blue Player. Nach Match-Ende startet ein
  Tap auf das Resultat einen neuen Lauf.
- Training Crossing rendert in V2 mit denselben Ruinen-, Charakter- und
  Pickup-Assets wie V1. Der autoritative Zustand bleibt trotzdem im V2-Core.
- Training Crossing und Grand Archive werden ueber dieselbe V2-Map-Registry
  ausgewaehlt. Runtime und Renderer erhalten dasselbe Plain-Data-Map-Objekt;
  der Phaser-Renderer enthaelt keine feste Training-Crossing-Auswahl mehr.
- Grand Archive verwendet die V1-Bounds `2500x820`, alle 20 Solids, vier
  Gaps, 15 Pickups, Team-Spawns und Bibliotheksassets. Lesetischkerzen,
  Staub und Spinnen sind Presentation; Projektilinteraktion mit Kerzen ist
  noch offen.
- Flank Switch verwendet die V1-Bounds `2500x820`, alle 14
  Industriebarrieren, vier Wartungsgruben, 15 Pickups und Team-Spawns.
  Metallboden, Team-Basen, Energiekanäle, zentrale Junction sowie
  Randmaschinen werden über den gemeinsamen mapgetriebenen Renderer
  dargestellt.
- Mobile-TDM steuert den roten Gegner ueber normale `move`- und `aim`-Intents.
  Navigation meidet Solids und Gaps; Bot-Jumps und Rollen sind noch offen.
- Rocket, Railgun und Whip verwenden in V2 die V1-Werte aus
  `src/config.ts`. Trefferregeln liegen im Core, waehrend Phaser nur
  Projektile, Beams, Swings, Explosionen und Sounds darstellt.
- V1-Weapon-Pickups auf Training Crossing sind in V2 vorhanden. Temporaere
  Ammo-Drops nach einem Tod und Spezialwaffennutzung durch Bots sind noch
  offene Paritaetspunkte.
- V2-Pickup-Icons verwenden die V1-Basisskalierungen `.18` fuer Health,
  Armor und Rocket, `.22` fuer Rail sowie `.34` fuer Whip. Der Puls betraegt
  wie in V1 nur `.008`; Waffen verwenden `y=-3`, andere Pickups `y=-5`.
- Feste V2-Spawn-Pads bleiben auch waehrend des Pickup-Respawns sichtbar.
  Nur Icon und Glow werden ausgeblendet; die cyanfarbenen V1-Aufstiegspartikel
  laufen am Spawnpunkt dauerhaft weiter.
- Mobile V2-Waffenbuttons verwenden direkt `calculateTouchLayout()` sowie die
  V1-Radien `35/43`, Bildskalierungen `.27/.38` beziehungsweise `.42/.54`,
  Badge-Skalierungen `.12/.16`, Badge-Abstaende `24/31` und die
  Rail-/Whip-Cooldown-Ringe aus V1.
- Mobile Rocket- und Rail-Buttons unterscheiden wie V1 zwischen Tap und
  Drag: Tap zielt auf den naechsten lebenden, sichtbaren Gegner in Reichweite;
  Drag zeigt Button- und Welt-Zielhilfe und feuert beim Loslassen manuell.
  Zurueckziehen unter die Abbruchschwelle verwirft den Schuss. Whip bleibt
  ein direkter Autoziel-Tap.
- `PhaserArenaAudioPort` spiegelt den vorhandenen V1-Audiopfad fuer eigene und
  gegnerische Schritte, Jump, Basic Autoshoot, Spezialwaffen, Death sowie
  Health-, Armor- und Waffen-Pickups. Raeumliche Sounds verwenden den
  quadratischen V1-Distanzabfall; Listener ist im aktuellen TDM-Slice P1
  (`blue-player`).
- Ein erfolgreicher Sprung emittiert `actor.jumped`; einmalige Sounds bleiben
  dadurch eventbasiert. Schritte werden als Presentation aus Snapshot-
  Geschwindigkeit und Grounded-Zustand abgeleitet.
- Ein eigener Damage-/Hurt-Sound bleibt offen, weil der aktuelle V1-Code
  dafuer keinen separaten Audioaufruf und kein eindeutig zugeordnetes Asset
  besitzt.
- V2 spiegelt jetzt die V1-Presentation fuer Bewegungsspur, Rocket-Smoke,
  Rocket-Explosion, Rail-Beam, Rail-Impact und Whip-Kegel. Rail-Impact wird
  wie in V1 nur bei einem Treffer dargestellt; der Whip unterscheidet
  Treffer und Fehlschuss farblich.
- `actor.died` erzeugt den V1-Todesburst mit 24 Team-/Dunkel-/Weisspartikeln,
  zwei zeitversetzten Ringen und kurzem Flash. Fall-Respawns erhalten bewusst
  keinen Todesburst, entsprechend dem V1-Verhalten.
- Temporaere Ammo-Drops nach einem Tod bleiben ein Gameplay-Paritaetspunkt
  und sind nicht Teil dieses Presentation-Slices.
- `ClassicCtfMode` bildet die V1-Regeln mit zwei Team-Flags, Pickup-Radius
  `36`, sofortigem Reset bei Tod/Fall und Capture im eigenen Basisrechteck
  ab. Wie in V1 ist ein Capture auch bei gestohlener eigener Flagge erlaubt.
  Capture-Limit und Matchdauer bleiben `3` beziehungsweise `180000 ms`.
- Vollständige subjektive Parität benötigt weiterhin direkten Gerätetest auf
  Desktop und Mobile.
