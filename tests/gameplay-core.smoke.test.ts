import assert from "node:assert/strict";
import test from "node:test";
import { runPhaserGameBridgeSmokeCheck } from "../src/adapters/phaser/PhaserGameBridge.smoke";
import {
  ClassicCtfBotController,
  ClassicCtfMode,
  createActorState,
  createClassicCtfWorldState,
  createEmptyWorldState,
  createWorldSnapshot,
  createOneFlagWorldState,
  createTeamDeathmatchWorldState,
  fireV1Weapons,
  GameplayCoreRuntime,
  OneFlagMode,
  OneFlagBotController,
  TeamDeathmatchMode,
  TRAINING_CROSSING_V2,
  clampRuntimeDeltaMs,
  GRAND_ARCHIVE_V2,
  V2_GAMEPLAY_RUNTIME_TIMING_CONFIG,
  V2_BOT_MOVEMENT_CONFIG,
  V2_V1_WEAPON_PARITY_CONFIG,
} from "../src/core";
import { shouldUseGameplayV2Shell } from "../src/bootSceneSelection";
import { readV2RouteState } from "../src/v2Route";

test("gameplay core smoke passes the full phaser game bridge check", () => {
  assert.doesNotThrow(() => runPhaserGameBridgeSmokeCheck());
});

test("runtime timing hardening clamps negative and oversized frame deltas", () => {
  assert.equal(clampRuntimeDeltaMs(-10), 0);
  assert.equal(clampRuntimeDeltaMs(34), 34);
  assert.equal(
    clampRuntimeDeltaMs(999),
    V2_GAMEPLAY_RUNTIME_TIMING_CONFIG.maxFrameDeltaMs,
  );
});

test("v2 route validation rejects invalid match routes", () => {
  const state = readV2RouteState(new URLSearchParams(
    "scene=v2&mode=broken&map=training-crossing-v2&players=???&controls=bad",
  ));

  assert.equal(state.canStartMatch, false);
  assert.equal(state.route.menu, true);
  assert.deepEqual(state.issues, [
    "Unsupported V2 mode: broken.",
    "Unsupported V2 players mode: ???.",
    "Unsupported V2 controls mode: bad.",
  ]);
});

test("scene selection keeps /CTF/ on v1 and defaults /CTF-2.0/ to v2", () => {
  assert.equal(shouldUseGameplayV2Shell({
    pathname: "/CTF/",
    search: "",
  }), false);
  assert.equal(shouldUseGameplayV2Shell({
    pathname: "/CTF-2.0/",
    search: "",
  }), true);
  assert.equal(shouldUseGameplayV2Shell({
    pathname: "/CTF-2.0/",
    search: "?scene=v1",
  }), false);
  assert.equal(shouldUseGameplayV2Shell({
    pathname: "/CTF/",
    search: "?scene=v2",
  }), true);
});

test("production arena modes do not emit diagnostic movement events", () => {
  const runtimes = [
    new GameplayCoreRuntime({
      mode: new TeamDeathmatchMode(),
      createWorld: () => createTeamDeathmatchWorldState(TRAINING_CROSSING_V2),
    }),
    new GameplayCoreRuntime({
      mode: new ClassicCtfMode(TRAINING_CROSSING_V2),
      createWorld: () => createClassicCtfWorldState(TRAINING_CROSSING_V2),
    }),
    new GameplayCoreRuntime({
      mode: new OneFlagMode(TRAINING_CROSSING_V2),
      createWorld: () => createOneFlagWorldState(TRAINING_CROSSING_V2),
    }),
  ];

  for (const runtime of runtimes) {
    runtime.initialize();
    const result = runtime.advance({
      sequence: 1,
      timeMs: 16,
      deltaMs: 16,
      actions: [{
        action: "move",
        phase: "held",
        actorId: "blue-player",
        direction: { x: 1, y: 0 },
        magnitude: 1,
      }, {
        action: "aim",
        phase: "held",
        actorId: "blue-player",
        direction: { x: 1, y: 0 },
      }],
    });
    assert.equal(
      result.events.some((event) => event.type === "diagnostic.actorMoved"),
      false,
    );
  }
});

test("rocket cooldown blocks repeated fire until the cooldown expires", () => {
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld: () => {
      const world = createEmptyWorldState("team-deathmatch");
      world.actors.push(
        createActorState({
          id: "blue-player",
          kind: "player",
          teamId: "blue",
          position: { x: 100, y: 100 },
          radius: 16,
          maxHealth: 100,
          maxArmor: 0,
          weapons: { rocketAmmo: 2 },
        }),
        createActorState({
          id: "red-player",
          kind: "player",
          teamId: "red",
          position: { x: 260, y: 100 },
          radius: 16,
          maxHealth: 100,
          maxArmor: 0,
        }),
      );
      return world;
    },
  });
  runtime.initialize();

  const readFireFrame = (sequence: number, timeMs: number, deltaMs: number) =>
    runtime.advance({
      sequence,
      timeMs,
      deltaMs,
      actions: [{
        action: "aim",
        phase: "held",
        actorId: "blue-player",
        direction: { x: 1, y: 0 },
      }, {
        action: "fireWeapon",
        phase: "pressed",
        actorId: "blue-player",
        direction: { x: 1, y: 0 },
        payload: { weaponId: "rocket" },
      }],
    });

  const first = readFireFrame(1, 34, 34);
  assert.equal(
    first.events.filter((event) => event.type === "weapon.rocketFired").length,
    1,
  );
  assert.equal(
    first.snapshot.actors.find((actor) => actor.id === "blue-player")?.weapons
      .rocketCooldownMs,
    V2_V1_WEAPON_PARITY_CONFIG.rocketCooldownMs,
  );

  const blocked = readFireFrame(2, 68, 34);
  assert.equal(
    blocked.events.some((event) => event.type === "weapon.rocketFired"),
    false,
  );
  assert.equal(
    blocked.snapshot.actors.find((actor) => actor.id === "blue-player")?.weapons
      .rocketAmmo,
    1,
  );

  let timeMs = 68;
  let sequence = 2;
  while (
    (runtime.snapshot.actors.find((actor) => actor.id === "blue-player")?.weapons
      .rocketCooldownMs ?? 0) > 0
  ) {
    sequence += 1;
    timeMs += 34;
    runtime.advance({
      sequence,
      timeMs,
      deltaMs: 34,
      actions: [],
    });
  }

  const readyAgain = readFireFrame(sequence + 1, timeMs + 34, 34);
  assert.equal(
    readyAgain.events.filter((event) => event.type === "weapon.rocketFired")
      .length,
    1,
  );
  assert.equal(
    readyAgain.snapshot.actors.find((actor) => actor.id === "blue-player")
      ?.weapons.rocketAmmo,
    0,
  );
});

test("classic ctf bot holds combat standoff while chasing a flag carrier", () => {
  const world = createClassicCtfWorldState(TRAINING_CROSSING_V2);
  new ClassicCtfMode(TRAINING_CROSSING_V2).initialize(world);
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 600 },
    solids: [],
    gaps: [],
  };
  const red = world.actors.find((actor) => actor.id === "red-player");
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  const redFlag = world.objectives.find((objective) => objective.id === "red-flag");
  assert.ok(red);
  assert.ok(blue);
  assert.ok(redFlag);
  red.position = { x: 100, y: 100 };
  blue.position = { x: 220, y: 100 };
  redFlag.state.status = "carried";
  redFlag.state.interactingActorId = blue.id;

  const controller = new ClassicCtfBotController(
    "red-player",
    "attacker",
    TRAINING_CROSSING_V2,
    V2_BOT_MOVEMENT_CONFIG,
    {
      navigate: () => ({ direction: { x: 1, y: 0 }, jump: false }),
      reset: () => {},
    },
  );
  const actions = controller.readActions(createWorldSnapshot(world), 34);
  const move = actions.find((action) => action.action === "move");
  const aim = actions.find((action) => action.action === "aim");
  assert.equal(move?.magnitude, 0);
  assert.deepEqual(move?.direction, { x: 0, y: 0 });
  assert.deepEqual(aim?.direction, { x: 1, y: 0 });
});

test("one flag bot still approaches the neutral flag directly", () => {
  const world = createOneFlagWorldState(GRAND_ARCHIVE_V2);
  new OneFlagMode(GRAND_ARCHIVE_V2).initialize(world);
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 2500, maxY: 820 },
    solids: [],
    gaps: [],
  };
  const red = world.actors.find((actor) => actor.id === "red-player");
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  const flag = world.objectives.find((objective) => objective.kind === "neutral-flag");
  assert.ok(red);
  assert.ok(blue);
  assert.ok(flag);
  red.position = { x: 100, y: 100 };
  blue.position = { x: 180, y: 100 };
  flag.position = { x: 600, y: 320 };
  flag.state.status = "home";
  flag.state.interactingActorId = null;

  let capturedTarget: { x: number; y: number } | null = null;
  const controller = new OneFlagBotController(
    "red-player",
    GRAND_ARCHIVE_V2,
    V2_BOT_MOVEMENT_CONFIG,
    {
      navigate: (_from, target) => {
        capturedTarget = { ...target };
        return { direction: { x: 1, y: 0 }, jump: false };
      },
      reset: () => {},
    },
  );
  const actions = controller.readActions(createWorldSnapshot(world), 34);
  const move = actions.find((action) => action.action === "move");
  assert.equal(move?.magnitude, 1);
  assert.deepEqual(capturedTarget, flag.position);
});
