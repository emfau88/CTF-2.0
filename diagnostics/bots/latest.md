# Bot Diagnostics Baseline

Timestamp: 2026-06-24T18:42:51.972Z
Git: branch=codex/gameplay-core-v2, commit=2aea888, dirty=true

## Kurzurteil

Die Diagnose lief durch, markiert aber 3 Hotzone-Hinweis(e).

## Modus-/Map-Matrix

| Scenario | Mode | Map | Team | Duration | Score | Pickups | Special | Invalid | Idle |
|---|---|---|---:|---:|---:|---|---|---:|---:|
| TDM Training Crossing 1v1 | team-deathmatch | training-crossing-v2 | 1v1 | 18020ms | 3 | 2/5 | 8/2 | 0 | 0 |
| TDM Training Crossing 2v2 | team-deathmatch | training-crossing-v2 | 2v2 | 18020ms | 3 | 5/5 | 7/3 | 0 | 0 |
| TDM Training Crossing 3v3 | team-deathmatch | training-crossing-v2 | 3v3 | 18020ms | 6 | 5/5 | 10/2 | 0 | 0 |
| TDM Training Crossing 4v4 | team-deathmatch | training-crossing-v2 | 4v4 | 18020ms | 8 | 5/6 | 7/5 | 0 | 0 |
| Classic CTF Flank Switch 1v1 | classic-ctf | flank-switch-v2 | 1v1 | 22032ms | 2 | 3/2 | 2/2 | 0 | 0 |
| Classic CTF Flank Switch 2v2 | classic-ctf | flank-switch-v2 | 2v2 | 22032ms | 0 | 7/6 | 5/6 | 0 | 0 |
| Classic CTF Flank Switch 3v3 | classic-ctf | flank-switch-v2 | 3v3 | 22032ms | 0 | 7/6 | 6/7 | 0 | 0 |
| Classic CTF Flank Switch 4v4 | classic-ctf | flank-switch-v2 | 4v4 | 22032ms | 1 | 7/5 | 14/3 | 0 | 0 |
| One Flag Grand Archive 1v1 | one-flag | grand-archive-v2 | 1v1 | 18020ms | 1 | 1/2 | 0/0 | 0 | 0 |
| One Flag Grand Archive 2v2 | one-flag | grand-archive-v2 | 2v2 | 18020ms | 1 | 1/3 | 0/0 | 0 | 0 |
| One Flag Grand Archive 3v3 | one-flag | grand-archive-v2 | 3v3 | 18020ms | 1 | 3/4 | 5/3 | 0 | 0 |
| One Flag Grand Archive 4v4 | one-flag | grand-archive-v2 | 4v4 | 18020ms | 1 | 2/4 | 3/6 | 0 | 0 |

## Full Smoke Matrix

- Kombinationen: 60
- Modi: 3
- Maps: 5
- Teamgroessen: 4
- Invalid Position Frames: 0
- Idle Action Frames: 0

Diese Matrix prueft Startbarkeit, gueltige Positionen, Bot-Aktionen und Mindestbewegung fuer alle Modi, registrierten V2-Maps und Teamgroessen. Sie ist kein finaler Gameplay-Qualitaetsbeweis.

## Auffaellige Hotzones

- One Flag Grand Archive: chase-enemy-carrier blocked frames=12
- One Flag Grand Archive: blocked escort-carrier frames=78
- One Flag Grand Archive: blocked chase-enemy-carrier frames=12

## Wichtigste Metriken

- Frame-Delta: 34ms
- Matrix-Szenarien: 12
- One-Flag Detail: grand-archive-v2, 2v2
- One-Flag chaseBlockedFrames: 12
- One-Flag takeCenterBlockedFrames: 0

## Szenario-Baselines

| Scenario | Mode | Map | Duration | Primary intent | Primary check | Path misses | Progress | Result |
|---|---|---|---:|---|---|---:|---:|---|
| One Flag Grand Archive Escort/Carrier Hotzone | one-flag | grand-archive-v2 | 3400ms | escort=escort-carrier, chaser=chase-enemy-carrier | escort/chaser progress | 0/0 | 662.1/258.7 | escort_path_found, chaser_path_found, escort_progress, chaser_progress |
| Classic CTF Flank Switch Own Flag Stolen | classic-ctf | flank-switch-v2 | 1360ms | recover-own-flag | recover own flag | 0 | 160.6 | path_found, recovery_goal_selected, carrier_distance_reduced, no_attack_flag_drift |
| TDM Training Crossing Low Health vs Enemy | team-deathmatch | training-crossing-v2 | 1700ms | seek-health | seek health before fight | 0 | 149.4 | path_found, pickup_prioritized, health_distance_reduced, pickup_collected, health_restored |
| TDM Training Crossing Armor/Weapon Pickup Intents | team-deathmatch | training-crossing-v2 | 1700ms | armor=seek-armor, weapon=seek-weapon | seek armor/weapon pickups | armor:0, weapon:0 | armor:149.4, weapon:149.4 | paths_found, expected_intents_seen, pickups_collected |
| TDM Training Crossing Combat Standoff | team-deathmatch | training-crossing-v2 | 850ms | hold-standoff | hold ideal combat range | 0 | hold:25, move:0 | path_not_needed_or_found, hold_dominates_move, position_held |

### Intent-Sichtbarkeit

- One Flag und Classic CTF nutzen aktuell die vorhandenen Goal-Frames als Intent-Baseline.
- TDM nutzt aktuell Controller-Debug-Intents wie `seek-health`, `hold-standoff` und `fight-enemy`.
- Noch nicht gemessen: Utility-Scores, Zielbindungsbonus, Combat-Prioritaet und Team-Claims.

## Aktuell NICHT gemessen

- damage_caused_per_bot
- damage_received_per_bot
- reaction_time_to_flag_event
- pickup_contention_per_target
- stuck_recovery_count
- goal_switches_for_tdm_and_classic_ctf
- browser_visual_playability
- mobile_human_playtest_quality
- deterministic_seed_or_replay_file

