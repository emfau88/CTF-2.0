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
- Maximalgeschwindigkeit: `335`
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
- Waffen-Audio, Trefferfeedback, Knockback und die V1-Waffen sind noch nicht
  migriert.
- Mobile Input wird im nächsten Slice über dieselben Core-Actions angebunden.
- Vollständige subjektive Parität benötigt weiterhin direkten Gerätetest auf
  Desktop und Mobile.
