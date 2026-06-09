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
