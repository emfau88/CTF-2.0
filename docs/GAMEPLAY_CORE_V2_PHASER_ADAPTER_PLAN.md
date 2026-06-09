# Gameplay Core V2: Phaser Adapter Plan

## Scope

This document plans the boundary between the framework-independent V2 core and
Phaser. It does not implement a scene, connect V1 gameplay, migrate movement,
or add a game mode.

V1 remains the playable reference. The bot movement experiment in
`stash@{0}` is not part of this plan and must remain unapplied.

## Ownership Boundary

### Phaser Adapter Owns

The Phaser side owns framework and presentation concerns:

- loading images, spritesheets, audio, and other browser assets
- reading keyboard, pointer, touch, and later gamepad input
- translating physical input into presentation-neutral core commands
- calling the future core runtime once per simulation step
- reading immutable `WorldSnapshot` values
- creating, updating, and destroying sprites and other Phaser objects
- camera bounds, following, shake, zoom, and interpolation
- translating `GameEvent` values into audio and visual effects
- passing `ModeHudState` to a HUD presentation adapter
- scene lifecycle, resize handling, and cleanup

The adapter may remember Phaser view objects by stable core IDs. Those maps are
view state only and must never become gameplay state.

### V2 Core Owns

The core owns authoritative gameplay state and rules:

- actors and actor lifecycle
- positions, velocities, movement updates, and collision results
- combat resolution, damage, deaths, and combat events
- pickups and inventory rules when those systems are migrated
- objectives and objective transitions
- score entries and score awards
- game mode phase, timer, completion, and win conditions
- spawning decisions through `SpawnProvider`
- mutable `WorldState`
- immutable `WorldSnapshot` creation
- ordered gameplay events

The core must produce the same results without a Phaser scene, sprites, audio,
DOM elements, or a browser.

## Recommended Adapter Files

The next implementation phase should create only the smallest useful bridge:

```text
src/adapters/
  phaser/
    PhaserGameBridge.ts
    PhaserInputAdapter.ts
    PhaserWorldRenderer.ts
    PhaserAudioAdapter.ts
    PhaserEffectsAdapter.ts
    PhaserAssetLoader.ts
    index.ts
  hud/
    HudPort.ts
    index.ts
```

A later integration phase, not the next skeleton phase, may add:

```text
src/adapters/
  phaser/
    scenes/
      GameplayV2Scene.ts
    views/
      ActorViewRegistry.ts
      ObjectiveViewRegistry.ts
      ProjectileViewRegistry.ts
```

The scene is intentionally deferred. The bridge contracts should exist before
the scene so the scene cannot become the design center.

## File Responsibilities

### `PhaserGameBridge.ts`

The single coordination boundary between Phaser and the core.

Responsibilities:

- accept one input frame from `PhaserInputAdapter`
- advance a future core runtime by a bounded delta
- expose the latest `WorldSnapshot`
- expose newly emitted `GameEvent` values exactly once
- provide `ModeHudState` to the HUD port
- call renderer, audio, and effects adapters in a defined order

It must not contain movement formulas, weapon rules, score decisions,
objective rules, or mode-specific branches.

### `PhaserInputAdapter.ts`

Owns physical controls and translates them into generic input intent.

Responsibilities:

- keyboard bindings
- pointer and touch tracking
- virtual joystick and action button state
- edge detection such as pressed, held, and released
- aim direction in world-neutral numeric form
- reset transient input after each frame

It must not mutate actors or decide whether an action is legal. The core will
eventually decide whether an actor may move, jump, or fire.

Short jump and held/long jump must remain distinct input states:

- jump pressed
- jump held
- jump released

### `PhaserWorldRenderer.ts`

Synchronizes Phaser views from `WorldSnapshot`.

Responsibilities:

- create views for newly visible IDs
- update position, facing, animation, health display, and visibility
- remove views for IDs no longer in the snapshot
- render map/environment presentation
- keep camera-facing interpolation separate from simulation state

It must not write corrected positions back into the core or infer gameplay
events from animation completion.

### `PhaserAudioAdapter.ts`

Consumes core events and snapshot context to play sounds.

Responsibilities:

- map event types to asset keys
- calculate listener-relative volume
- suppress or limit overlapping sounds
- manage Phaser sound instances and cleanup

It must not detect deaths, pickups, shots, or captures by comparing old V1
objects. Those facts must arrive as `GameEvent` values.

### `PhaserEffectsAdapter.ts`

Consumes core events and snapshot context to create temporary visual effects.

Responsibilities:

- explosions, impacts, trails, death bursts, beams, and swing effects
- effect lifetime and Phaser object cleanup
- presentation-only randomness

Damage radius, hit detection, projectile collision, and weapon outcomes belong
to the core, not this adapter.

### `PhaserAssetLoader.ts`

Registers stable asset keys with a Phaser loader.

Responsibilities:

- images, spritesheets, audio, and asset URLs
- frame dimensions and loader metadata
- no gameplay configuration or mode logic

Mode-specific assets may be grouped in manifests, but loading an asset must
not create an objective or enable a game rule.

### `HudPort.ts`

Defines the presentation boundary for HUD output without importing DOM or
Phaser into the core.

Responsibilities:

- accept `ModeHudState`
- accept optional player-facing snapshot data later
- expose presentation actions such as restart or leave-match through adapter
  callbacks, not direct core imports

A future DOM implementation may query elements and format text. `HudPort`
itself should remain framework-neutral and live outside `src/core`.

### Future `GameplayV2Scene.ts`

When eventually introduced, this scene should remain small.

Allowed responsibilities:

- `preload`: delegate to `PhaserAssetLoader`
- `create`: construct adapters and the bridge
- `update`: collect input, call bridge, render returned state
- `shutdown`: remove listeners and destroy adapter resources

It must not own actor arrays, projectile arrays, scores, objectives, respawn
timers, weapon cooldowns, or game mode rules.

## Update and Event Flow

The intended one-way flow is:

```text
Keyboard / Touch / Pointer
          |
          v
PhaserInputAdapter
          |
          v
PhaserGameBridge -> Core runtime -> WorldState
                         |              |
                         v              v
                    GameEvent[]    WorldSnapshot
                         |              |
             +-----------+-------+------+---------+
             |                   |                |
             v                   v                v
      PhaserAudioAdapter  PhaserEffectsAdapter  PhaserWorldRenderer
                                                  |
                                                  v
                                      ModeHudState -> HudPort
```

The core runtime does not currently exist. This plan does not add it.

## Strict Dependency Rules

### Allowed Imports

- `src/core/**` may import only other `src/core/**` modules and
  framework-independent TypeScript utilities.
- `src/adapters/**` may import `src/core/**`.
- Phaser adapters may import Phaser and adapter-local presentation helpers.
- A future scene may import adapter composition classes and content data.
- A future DOM HUD implementation may import core data types and browser APIs.

### Forbidden Imports

- `src/core/**` must not import `phaser`.
- `src/core/**` must not access `document`, `window`, `localStorage`, URL
  parameters, or browser event targets.
- `GameMode` implementations must not import `ArenaScene`.
- `GameMode` implementations must not import the old `FlagSystem`.
- `GameMode` implementations must not import Phaser adapters or DOM HUD code.
- Core actors must not contain sprites, sounds, tweens, or Phaser object
  references.
- Renderers must not mutate `WorldState`.
- Audio and effects adapters must not award score or apply damage.
- Input adapters must not call V1 `Player`, `Bot`, weapon, or flag methods.

### Dependency Direction

Dependencies point inward:

```text
Phaser / DOM / Browser
          |
          v
       Adapters
          |
          v
         Core
```

The core never points back outward.

## V1 Reuse Assessment

### Safe to Reuse Later

These can be reused directly or with a very thin adapter because they are
already presentation-only or pure:

- `public/assets/**`: reuse directly.
- `src/assets.ts`: asset keys and loader metadata are reusable in a future
  `PhaserAssetLoader`; CTF-specific flag assets may remain optional content.
- `src/touchLayout.ts`: pure screen-layout calculation; safe for the input
  presentation layer.
- Pure functions from `src/math.ts`: geometry algorithms are reusable after
  moving or copying them into a framework-neutral V2 utility module. Do not
  make the new core depend on the old module permanently.
- Visual design, depths, scales, animation timing, and asset mapping from
  `src/arenaRenderer.ts`, `src/arenaEffects.ts`, and `src/libraryEffects.ts`.
- Audio asset choices, ranges, and volume curves from `src/arenaAudio.ts`.

### Reuse Only Through Rework

These contain useful behavior or data but are tied to V1 shapes:

- `src/level.ts`: map geometry and authored positions are valuable, but the
  schema hardcodes red/blue spawns, bases, and CTF bot routes. Use a content
  converter or new neutral map schema later.
- `src/arenaRenderer.ts`: Phaser presentation is reusable, but direct
  assumptions about red/blue bases must be replaced by snapshot/content data.
- `src/arenaAudio.ts`: sound behavior is useful, but dependencies on
  `Player`, `Bot`, and state polling must become event/snapshot consumption.
- `src/arenaEffects.ts`: visual implementations are useful, but dependencies
  on V1 `Projectile`, `Pickup`, `Player`, team config, and gameplay constants
  must be removed.
- `src/libraryEffects.ts`: atmospheric visuals are reusable, but projectile
  impact and candle state changes must be driven by core events.
- `src/hud.ts`: DOM techniques and styling can be retained, but its state
  contract and CTF transitions must be replaced by `ModeHudState`.
- Values from `src/config.ts`: preserve proven tuning through explicit V2
  configuration objects rather than importing the V1 global constant.

### Do Not Reuse Directly

These would carry the current coupling into V2:

- `src/scenes/ArenaScene.ts`
- `src/systems.ts`
- `FlagSystem`
- `MatchFlow`
- V1 `Player` and `MovementController` as runtime dependencies
- V1 `Bot` and `BotNavigator`
- `AutoAttack`, `Projectile`, `Pickup`, and `PickupSystem` in their current
  concrete `Player | Bot` form
- `src/targeting.ts`, because it depends on V1 `Bot` and the fixed team model
- `src/botFactory.ts`, because it depends on CTF map fields and V1 bots

Their gameplay behavior and tuning remain migration references. Their classes
must not become dependencies of the new core.

## Risks

### Bridge Becomes a New Godfile

Risk: `PhaserGameBridge` accumulates input mapping, rendering, audio, effects,
HUD formatting, and lifecycle rules.

Control: keep the bridge as orchestration only and require each concern to
implement its own adapter.

### Snapshot Is Too Weak

Risk: adapters start reading mutable `WorldState` or old V1 objects because the
snapshot lacks render or audio context.

Control: extend explicit snapshot/event contracts when a real need is found;
never bypass the boundary with `any` or V1 object references.

### Presentation Polling Recreates Gameplay Logic

Risk: audio, effects, and HUD compare frames to infer shots, deaths, captures,
or score changes.

Control: those transitions must be explicit `GameEvent` values emitted by the
core.

### Mode Rules Leak Into Scene

Risk: the scene gains branches such as `if (mode === "ctf")`.

Control: `GameMode` owns objectives, scoring, completion, spawning policy, and
`ModeHudState`. The scene sees only generic output.

### V1 Reuse Imports Coupling

Risk: directly importing V1 systems appears faster but preserves concrete
`Player | Bot`, red/blue, and flag assumptions.

Control: reuse assets, algorithms, tuning, and presentation knowledge; migrate
behavior behind V2 contracts instead of wrapping entire V1 classes.

### Variable Frame Rate Changes Simulation

Risk: Phaser delta directly drives non-deterministic or unstable gameplay.

Control: the future bridge should bound accumulated time and use a fixed or
carefully bounded simulation step. Exact stepping policy must be decided
before movement migration.

### Event Duplication

Risk: the same event is replayed across frames, duplicating sound, effects, or
score.

Control: bridge APIs must distinguish newly emitted events from retained event
history and deliver each presentation event once.

## Next Three Implementation Steps

### 1. Add Adapter Contracts Without a Scene

Create framework boundary types for:

- core input frame/action intent
- core runtime facade
- snapshot/event frame output
- `HudPort`
- renderer, audio, and effects adapter interfaces

Add compile-time dependency checks or lintable import rules if the existing
toolchain can support them without broad configuration churn.

No V1 gameplay connection is made in this step.

### 2. Implement an Inert Phaser Bridge Harness

Implement `PhaserGameBridge` against a minimal fake or empty core runtime:

- accepts empty input
- advances time
- returns an empty `WorldSnapshot`
- forwards no events
- can be unit-tested without starting Phaser

Still do not create or register `GameplayV2Scene`.

### 3. Add a Non-Playable V2 Scene Shell

Only after the bridge is tested:

- create a separate, opt-in `GameplayV2Scene`
- delegate preload to the asset loader
- construct input/render/audio/effects/HUD adapters
- render an empty or diagnostic snapshot
- keep V1 `ArenaScene` as the default playable scene

No movement, combat, objectives, CTF, TDM, or One Flag migration belongs in
these three steps.
