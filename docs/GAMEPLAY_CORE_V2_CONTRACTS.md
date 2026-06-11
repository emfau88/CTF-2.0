# Gameplay Core V2 Contracts

## Purpose

The V2 gameplay core creates a framework-independent source of truth for
actors, world state, objectives, scoring, spawning, match rules, and gameplay
events. It exists because V1 currently mixes those responsibilities with
Phaser scene orchestration and classic CTF-specific behavior.

V1 remains the playable reference. The contracts in this phase do not replace,
connect to, or change V1 behavior.

## Contract Responsibilities

### Actor, ActorId, TeamId, and ActorState

`Actor` describes the minimum shared gameplay state for a world participant:
identity, optional team membership, life state, position, velocity, collision
radius, health, and armor.

`ActorId` and `TeamId` are identifiers rather than fixed red/blue unions. This
allows modes to define their own teams and permits neutral actors.

`ActorState` describes broad lifecycle states without depending on Phaser
sprites or the V1 `Player` and `Bot` classes.

### GameEvent

`GameEvent` is the generic record of something that happened in the
simulation. Future event types can represent damage, kills, pickups, objective
changes, captures, or other mode-relevant actions.

Events carry generic payloads and optional actor/team references. They do not
assume that scoring comes from flag captures.

### GameMode and GameModeId

`GameMode` is the rules boundary for a match. A future mode will initialize its
state, react to gameplay events, update time-based rules, decide when the match
is complete, provide spawn rules, and expose presentation-neutral HUD data.

Classic CTF, Team Deathmatch, and One Flag / Center Flag should eventually be
separate implementations of this contract. None is implemented in this phase.

### Objective and ObjectiveState

`Objective` represents a mode-owned world objective. Its `kind` and generic
state allow multiple team flags, one neutral center objective, control points,
or future objective types without making the core CTF-specific.

The objective contract contains gameplay data only. Sprite keys, animations,
and DOM elements stay outside the core.

### ScoreBoard

`ScoreBoard` stores score entries and awards score in response to a
`GameEvent`. Entries may represent teams or actors, allowing both team scores
and individual scores.

The active `GameMode` must decide which events award points, how many points
they award, and which score limit or win condition applies.

### SpawnProvider and SpawnPoint

`SpawnProvider` selects a spawn from a mode-independent request and an
immutable world snapshot. `SpawnPoint` contains world coordinates and optional
team and tag metadata.

Maps or modes may later provide team bases, neutral spawns, safe respawns, or
other spawn strategies without hardcoding red and blue positions.

### ModeHudState

`ModeHudState` is presentation-neutral data produced by a mode. It may contain
phase, timer, score, objective, and notice information.

It does not know whether the presentation uses DOM, Phaser text, a mobile
overlay, or another UI technology.

### WorldState and WorldSnapshot

`WorldState` is the mutable simulation state that future core systems will
update. It owns actors, objectives, scoring, events, time, and the active mode
identifier.

`WorldSnapshot` is the read-only view intended for decisions, adapters, HUD
mapping, debugging, and rendering. Phaser should render snapshots rather than
becoming the source of gameplay truth.

## What Stays Outside the Core

The following responsibilities must remain in adapters or presentation layers:

- Phaser scenes, sprites, graphics, cameras, tweens, particles, and audio
- keyboard, pointer, gamepad, and touch bindings
- DOM queries, buttons, menus, overlays, and CSS
- asset loading and asset keys
- browser storage and URL handling
- visual interpolation and effects

The core must not import Phaser, access `ArenaScene`, query DOM elements, or
depend on the V1 `FlagSystem`.

## GameMode Ownership

A `GameMode` should eventually own:

- objective setup and objective rules
- event interpretation
- score awards
- match phases and timer rules
- win, loss, and draw conditions
- mode-specific spawning policy
- mode-specific HUD state

Shared combat, movement, and actor systems should emit generic events and
update world state. They should not decide that a flag capture is the only way
to score.

## Adapter Boundary

Phaser and DOM are adapters around the gameplay core:

1. Input adapters translate physical controls into future core actions.
2. The core updates gameplay state without rendering dependencies.
3. Phaser renders a `WorldSnapshot`.
4. HUD adapters render `ModeHudState`.
5. Audio and effects react to emitted `GameEvent` values.

No Phaser scene or adapter is implemented in this phase.

## Phase 3 Adapter Contracts

Phase 3 adds contracts only for the future adapter flow:

```text
InputAdapterPort
  -> CoreInputFrame
  -> CoreRuntime
  -> CoreFrameResult
  -> RendererPort / AudioPort / EffectsPort / HudPort
```

`CoreFrameResult` contains the latest `WorldSnapshot`, newly emitted
`GameEvent` values, and `ModeHudState`. `AssetLoaderPort` defines a generic
asset-registration boundary.

These contracts contain no Phaser, DOM, browser, `ArenaScene`, `FlagSystem`,
V1 `Player`, or V1 `Bot` dependencies. No adapter implementation, bridge
runtime, scene, or gameplay connection exists yet.

## Phase 4 Inert Bridge Harness

Phase 4 adds:

- `InertCoreRuntime`, which returns empty snapshots, events, and HUD state
- `PhaserGameBridge`, which forwards runtime output to optional adapter ports
- a small exported smoke-check function for the inert flow

Despite its adapter name, `PhaserGameBridge` does not import or require Phaser.
It can be constructed and checked without a browser or scene.

No V1 gameplay is connected. No Phaser scene exists, and no movement, combat,
mode, objective, bot, weapon, or pickup behavior is implemented.

## Phase 5 Non-Playable Scene Shell

Phase 5 adds an opt-in `GameplayV2Scene` that constructs the inert runtime and
bridge inside Phaser. It sends empty input frames and displays diagnostic text
through a Phaser HUD adapter.

The shell is available with:

```text
?scene=v2
```

Normal startup still uses V1 `ArenaScene`. The V2 shell creates no actors,
maps, objectives, bots, weapons, pickups, movement, combat, modes, multiplayer,
or network systems.

## Phase 6 Plain World And Actor State

Phase 6 adds the first concrete V2 state model. `WorldState` and `ActorState`
contain only serializable plain data, including position, velocity, facing,
health, armor, lifecycle, and optional respawn state. Helper functions create
empty world state, actor state, and defensive world snapshots.

`InertCoreRuntime` owns a `WorldState` and returns snapshots derived from it.
At this phase the state was empty and the diagnostic shell displayed an actor
count of zero. No gameplay, movement, combat, objectives, or modes were
connected. V1 remained the default playable scene.

## Phase 7 Static Diagnostic Actor Rendering

Phase 7 initializes the inert diagnostic world with one static plain-data actor.
A Phaser renderer adapter reads that actor from each `WorldSnapshot` and draws
only diagnostic geometry, facing, identity, health, and armor information.

This proves the snapshot-to-renderer pipeline but is not gameplay. The actor
does not react to input or move, and no combat, bots, objectives, maps, game
modes, or V1 systems are connected. V1 remains the default playable scene.

## Phase 8 Diagnostic Input And Frame Data

Phase 8 adds a Phaser input adapter that converts keyboard, pointer, and touch
state into generic `CoreInputFrame` actions. The V2 shell displays movement,
aim, fire, and separate jump pressed, held, and released diagnostics.

The bridge also reports frame count, last delta time, accumulated runtime time,
actor count, and event count through a dedicated diagnostic adapter port.
At this phase inputs were observed only: the static actor did not move, fire,
jump, or change state. Movement, combat, modes, maps, and V1 gameplay remained
unconnected.

## Phase 9 Controllable Diagnostic Actor

Phase 9 completes the temporary diagnostic data loop:

```text
CoreInputFrame -> InertCoreRuntime -> WorldState -> WorldSnapshot -> adapters
```

WASD input now applies constant, delta-time-based velocity to the diagnostic
actor. The core updates position and velocity, clamps the actor to fixed
diagnostic bounds, and emits a serializable `diagnostic.actorMoved` event when
the position changes. The HUD displays the resulting position and velocity.

At this phase the diagnostic movement was not final and did not attempt V1
movement parity. It had no acceleration, friction, jumping, collision, map
logic, combat, or mode logic. V1 movement migration remained pending.

## Phase 10 V2 Ground Movement Parity

Phase 10 replaces constant-speed diagnostic movement with a framework-neutral
ground movement module based on the V1 playable reference:

- `src/player.ts`, `MovementController.update()` supplies acceleration,
  direction-change penalty, strafe bonus, friction, and speed limiting.
- `src/config.ts`, `T` supplies acceleration `1580`, max speed `335`, ground
  friction `7`, input friction `1.25`, turn penalty `.68`, turn dot `-.28`,
  and strafe bonus `1.12`.
- `src/scenes/ArenaScene.ts`, `update()` caps movement delta at `34 ms` and
  integrates velocity with the V1 ground distance factor `.93`.
- `src/scenes/ArenaScene.ts`, `inputVector()` normalizes diagonal keyboard and
  touch-stick directions. Desktop and mobile use the same movement controller
  after this normalization.

The V2 module mirrors those ground formulas using plain position, velocity,
facing, input direction, input magnitude, delta time, and movement config.
Temporary diagnostic bounds remain, but map collision and gaps do not exist.
At this phase jumping, including short and held jumps, was not implemented.
V1 remained the playable movement reference.

## Phase 11 V2 Jump Parity

Phase 11 mirrors the V1 jump lifecycle from `src/player.ts`, `JumpSystem`:

- `start()` rejects active/cooldown jumps, applies a `100` low-speed boost
  below speed `34`, starts held state, and sets a `540 ms` cooldown.
- `release()` ends hold extension without cancelling the active jump.
- `update()` starts from a `180 ms` planned duration, extends held jumps at
  `1.18 ms` per update millisecond up to `620 ms`, and calculates height as
  `sin(progress * PI) * 62`.
- Landing occurs when elapsed time reaches planned duration, resetting active
  jump height while preserving cooldown state.

`src/scenes/ArenaScene.ts`, `update()` establishes the processing order:
jump input, jump update, movement update, then horizontal integration. The V2
runtime mirrors that order. While airborne, `MovementController.update()` in
`src/player.ts` uses air control `.72`, air friction `1.05`, and a max-speed
multiplier of `1.08`; V2 ground movement now mirrors those airborne settings.

Actor jump state is plain serializable data. The Phaser diagnostic renderer
uses jump height only as a visual vertical offset and scale above a shadow.
Short and held jumps remain distinct. Gaps, collision, maps, fall handling,
bots, combat, objectives, and modes are still not implemented. V1 remains the
playable reference.

## Phase 12 Collision, Bounds, And Gap Groundwork

Phase 12 adds serializable V2 world geometry for bounds, solid rectangles, and
gap rectangles. The diagnostic world contains only a small test arena; no V1
map data is imported.

The framework-neutral collision module mirrors the relevant V1 groundwork:

- `src/systems.ts`, `CollisionSystem.update()` clamps actors to world bounds,
  resolves circle-versus-rectangle collisions for up to three passes, removes
  velocity into the collision surface, and ignores solids above half of the
  configured jump height.
- The same V1 function insets gap danger zones by `.2`, considers the actor
  clear at `.34` of jump height, and records a safe position every `120 ms`
  while grounded and outside gaps.
- `src/player.ts`, `Player.fall()` and its update lifecycle use a `420 ms`
  falling delay, reduce velocity to `.18`, cancel the jump, and return the
  actor to the last safe position.
- `src/config.ts`, `T` supplies jump height `62`, fall respawn time `420`,
  safe-point interval `120`, and gap danger inset ratio `.2`.

V2 now owns those collision decisions using plain actor and geometry data. The
Phaser diagnostic renderer only visualizes the resulting snapshot: gray
rectangles are solids, dark red rectangles are gaps, and the outline is the
diagnostic world boundary. Actor state exposes whether it is over a gap,
falling, waiting to respawn, and where its last safe position is.

This remains diagnostic groundwork rather than full map migration or final
physics. V1 maps, bots, combat, pickups, objectives, and game modes are not
connected. V1 remains the default playable reference.

## Phase 13 Training Crossing Geometry

Phase 13 introduces a plain-data V2 map content contract and migrates only the
authored geometry of V1 Training Crossing from `src/level.ts`:

- map bounds `1500 x 820`
- ten solid wall rectangles
- two gap rectangles
- the red-side reference spawn at `(150, 410)` as the V2 diagnostic spawn

The V2 map is identified as `training-crossing-v2` and is defined independently
under `src/core/world/maps/`. The diagnostic runtime copies its geometry into
`WorldState`; it does not import or retain the V1 `LevelData` object.

The V2 renderer displays the real Training Crossing wall and gap coordinates
and keeps the camera centered around the diagnostic actor within the authored
world bounds. The HUD displays the active V2 map id and name.

Only geometry and a diagnostic start position are migrated. V1 bases, flags,
decorations, pickups, combat zone, bot routes, bots, weapons, score, match
flow, objectives, and modes remain unconnected. V1 remains the default
playable reference.

## Phase 14 Actor Lifecycle

Phase 14 adds framework-neutral V2 actor lifecycle functions for diagnostic
damage, armor absorption, death, and timed respawn. The behavior mirrors the
V1 player rules in `src/player.ts`, `Player.damage()` and `Player.respawn()`:

- armor absorbs incoming damage before health
- health at or below zero enters the dead state
- death clears velocity and armor and cancels the active jump
- respawn occurs after `900 ms`
- respawn restores full health, zero armor, and the authored map spawn

Lifecycle state remains plain serializable actor data. Damage emits
`actor.damaged`; lethal damage also emits `actor.died`; successful respawn
emits `actor.respawned`.

The V2 diagnostic input uses `K` to apply `35` damage. While dead, the actor
ignores movement and jump input. Gap falls remain a separate lifecycle path:
they return to `lastSafePosition`, while death returns to `spawnPosition`.
Diagnostic damage is ignored while falling or dead, preventing the two
respawn paths from overlapping.

This is diagnostic lifecycle groundwork only. No weapons, projectiles,
targeting, combat system, pickups, bots, objectives, flags, scoring, or modes
are implemented. V1 remains the default playable reference.
