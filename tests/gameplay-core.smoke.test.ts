import assert from "node:assert/strict";
import test from "node:test";
import { runPhaserGameBridgeSmokeCheck } from "../src/adapters/phaser/PhaserGameBridge.smoke";
import {
  ClassicCtfBotController,
  ClassicCtfMode,
  classicCtfRoleForSlot,
  createActorState,
  createArenaBotControllerGroup,
  createArenaRoster,
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
  TdmBotController,
  TdmBotCombatController,
  TRAINING_CROSSING_V2,
  clampRuntimeDeltaMs,
  FLANK_SWITCH_V2,
  GRAND_ARCHIVE_V2,
  V2_GAMEPLAY_RUNTIME_TIMING_CONFIG,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_BOT_MOVEMENT_CONFIG,
  V2_BOT_NAVIGATION_CONFIG,
  V2_TEAM_DEATHMATCH_CONFIG,
  V2_V1_WEAPON_PARITY_CONFIG,
  validateWorldMapForMode,
  type BotCombatConfig,
  type ArenaTeamSize,
} from "../src/core";
import { shouldUseGameplayV2Shell } from "../src/bootSceneSelection";
import { buildV2MatchSearch, readV2RouteState } from "../src/v2Route";
import { calculateV2TouchLayout } from "../src/adapters/phaser/v2TouchLayout";

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

test("v2 routes preserve and validate arena team size", () => {
  const valid = readV2RouteState(new URLSearchParams(
    "scene=v2&mode=ctf&map=grand-archive-v2&players=bot&controls=keyboard&teamSize=4",
  ));
  assert.equal(valid.canStartMatch, true);
  assert.equal(valid.route.teamSize, 4);
  assert.equal(
    new URLSearchParams(buildV2MatchSearch(valid.route)).get("teamSize"),
    "4",
  );

  const legacy = readV2RouteState(new URLSearchParams(
    "scene=v2&mode=tdm&map=training-crossing-v2&players=bot&controls=keyboard",
  ));
  assert.equal(legacy.canStartMatch, true);
  assert.equal(legacy.route.teamSize, 1);

  const invalid = readV2RouteState(new URLSearchParams(
    "scene=v2&mode=one-flag&map=flank-switch-v2&players=bot&controls=touch&teamSize=5",
  ));
  assert.equal(invalid.canStartMatch, false);
  assert.equal(invalid.route.menu, true);
  assert.deepEqual(invalid.issues, ["Unsupported V2 team size: 5."]);
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

test("default TDM matches require ten kills", () => {
  const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
  const mode = new TeamDeathmatchMode();
  const events = mode.initialize(world);

  assert.equal(V2_TEAM_DEATHMATCH_CONFIG.scoreLimit, 10);
  assert.equal(mode.getHudState(createWorldSnapshot(world)).notices[0], "First to 10");
  assert.equal(
    (events[0]?.payload as { scoreLimit?: unknown } | undefined)?.scoreLimit,
    10,
  );
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

test("one flag bot projects blocked carrier chase targets to a reachable point", () => {
  const world = createOneFlagWorldState(GRAND_ARCHIVE_V2);
  new OneFlagMode(GRAND_ARCHIVE_V2).initialize(world);
  const red = world.actors.find((actor) => actor.id === "red-player");
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  const flag = world.objectives.find((objective) => objective.kind === "neutral-flag");
  assert.ok(red);
  assert.ok(blue);
  assert.ok(flag);
  red.position = { x: 760, y: 410 };
  blue.position = { x: 860, y: 330 };
  flag.state.status = "carried";
  flag.state.interactingActorId = blue.id;

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

  controller.readActions(createWorldSnapshot(world), 34);

  assert.ok(capturedTarget);
  assert.notDeepEqual(capturedTarget, blue.position);
  assert.equal(
    GRAND_ARCHIVE_V2.geometry.solids.some((rect) =>
      capturedTarget!.x >= rect.x - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.x <= rect.x + rect.width + V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.y >= rect.y - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.y <= rect.y + rect.height + V2_BOT_NAVIGATION_CONFIG.obstaclePadding
    ),
    false,
  );
});

test("one flag bot projects blocked escort targets to a reachable point", () => {
  const world = createOneFlagWorldState(GRAND_ARCHIVE_V2, { teamSize: 2 });
  new OneFlagMode(GRAND_ARCHIVE_V2).initialize(world);
  const escort = world.actors.find((actor) => actor.id === "red-player");
  const carrier = world.actors.find((actor) => actor.id === "red-player-2");
  const flag = world.objectives.find((objective) => objective.kind === "neutral-flag");
  assert.ok(escort);
  assert.ok(carrier);
  assert.ok(flag);
  escort.position = { x: 400, y: 410 };
  carrier.position = { x: 553, y: 324 };
  flag.state.status = "carried";
  flag.state.interactingActorId = carrier.id;

  let capturedTarget: { x: number; y: number } | null = null;
  const controller = new OneFlagBotController(
    escort.id,
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

  controller.readActions(createWorldSnapshot(world), 34);

  assert.ok(capturedTarget);
  assert.equal(controller.debugSnapshot().goalKind, "escort-carrier");
  assert.equal(controller.debugSnapshot().projectionApplied, true);
  assert.equal(
    [
      ...GRAND_ARCHIVE_V2.geometry.solids,
      ...GRAND_ARCHIVE_V2.geometry.gaps,
    ].some((rect) =>
      capturedTarget!.x >= rect.x - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.x <= rect.x + rect.width + V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.y >= rect.y - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
      capturedTarget!.y <= rect.y + rect.height + V2_BOT_NAVIGATION_CONFIG.obstaclePadding
    ),
    false,
  );
});

test("rail bot waits for target acquisition and applies deterministic spread", () => {
  const world = createEmptyWorldState("rail-bot-balance");
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 600 },
    solids: [],
    gaps: [],
  };
  const bot = createActorState({
    id: "rail-bot",
    kind: "bot",
    teamId: "red",
    position: { x: 100, y: 100 },
    radius: 16,
    maxHealth: 100,
    maxArmor: 0,
    weapons: { railAmmo: 2 },
  });
  const target = createActorState({
    id: "rail-target",
    kind: "player",
    teamId: "blue",
    position: { x: 700, y: 100 },
    radius: 16,
    maxHealth: 100,
    maxArmor: 0,
  });
  world.actors.push(bot, target);
  const config: BotCombatConfig = {
    rocketMinRange: 190,
    rocketMaxRange: 700,
    rocketDecisionCooldownMs: 3000,
    railReactionMs: 320,
    railAimJitterRadians: .04,
    railPreferredMinRange: 300,
    railRange: 1100,
    whipRange: 100,
  };
  const combat = new TdmBotCombatController(config);
  const snapshot = createWorldSnapshot(world);

  assert.equal(combat.readAction(bot, target, snapshot, 16), null);
  assert.equal(combat.readAction(bot, target, snapshot, 319), null);
  const shot = combat.readAction(bot, target, snapshot, 1);

  assert.equal(shot?.payload?.weaponId, "rail");
  assert.ok(shot?.direction);
  assert.ok(Math.abs(shot.direction.y) > .0001);
  assert.ok(Math.abs(Math.hypot(shot.direction.x, shot.direction.y) - 1) < .0001);

  target.lifeId++;
  assert.equal(
    combat.readAction(bot, target, createWorldSnapshot(world), 34),
    null,
  );
});

test("player basic fire is manual while the bot fallback remains automatic", () => {
  const createWorld = () => {
    const world = createEmptyWorldState("manual-basic-fire");
    world.geometry = {
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 400 },
      solids: [],
      gaps: [],
    };
    world.actors.push(
      createActorState({
        id: "blue-player",
        kind: "player",
        teamId: "blue",
        position: { x: 100, y: 200 },
        radius: 16,
        maxHealth: 100,
        maxArmor: 0,
      }),
      createActorState({
        id: "red-player",
        kind: "player",
        teamId: "red",
        position: { x: 300, y: 200 },
        radius: 16,
        maxHealth: 100,
        maxArmor: 0,
      }),
    );
    return world;
  };
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld,
    basicAutoAttack: V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
    manualBasicAttackActorIds: ["blue-player"],
    autoBasicAttackActorIds: ["red-player"],
    allowManualPrimaryFire: false,
  });
  runtime.initialize();

  const automatic = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [],
  });
  assert.deepEqual(
    automatic.events
      .filter((event) => event.type === "projectile.spawned")
      .map((event) => event.sourceActorId),
    ["red-player"],
  );

  const manual = runtime.advance({
    sequence: 2,
    timeMs: 68,
    deltaMs: 34,
    actions: [{
      action: "firePrimary",
      phase: "held",
      actorId: "blue-player",
    }],
  });
  assert.equal(
    manual.events.some((event) =>
      event.type === "projectile.spawned" &&
      event.sourceActorId === "blue-player"
    ),
    true,
  );
});

test("compact v2 attack controls form a clear edge cluster", () => {
  const width = 667;
  const layout = calculateV2TouchLayout(width, 375);
  const distance = (
    left: { x: number; y: number },
    right: { x: number; y: number },
  ) => Math.hypot(left.x - right.x, left.y - right.y);

  assert.ok(
    distance(layout.fire, layout.jump) >
      layout.fire.r + layout.jump.r + 20,
  );
  for (const weapon of [layout.rocket, layout.rail, layout.whip]) {
    assert.ok(
      distance(layout.fire, weapon) > layout.fire.r + weapon.r + 20,
    );
  }
  for (const [left, right] of [
    [layout.rocket, layout.rail],
    [layout.rocket, layout.whip],
    [layout.rail, layout.whip],
  ] as const) {
    assert.ok(distance(left, right) > left.r + right.r);
  }
  assert.ok(layout.jump.r > layout.fire.r);
  assert.ok(layout.jump.x > layout.fire.x);
  assert.ok(layout.jump.x + layout.jump.r <= width);
  assert.ok(
    Math.min(layout.rocket.x, layout.rail.x, layout.whip.x) >= width - 210,
  );
});

test("arena world factories support symmetric teams from 1v1 through 4v4", () => {
  const maps = [TRAINING_CROSSING_V2, GRAND_ARCHIVE_V2, FLANK_SWITCH_V2];
  const factories = [
    createTeamDeathmatchWorldState,
    createClassicCtfWorldState,
    createOneFlagWorldState,
  ];
  for (const map of maps) {
    for (
      const teamSize of [1, 2, 3, 4] as const satisfies
        readonly ArenaTeamSize[]
    ) {
      for (const factory of factories) {
        const world = factory(map, { teamSize });
        assert.equal(world.actors.length, teamSize * 2);
        assert.equal(
          world.actors.filter((actor) => actor.teamId === "blue").length,
          teamSize,
        );
        assert.equal(
          world.actors.filter((actor) => actor.teamId === "red").length,
          teamSize,
        );
        assert.equal(
          new Set(world.actors.map((actor) => actor.id)).size,
          world.actors.length,
        );
        assert.equal(
          new Set(world.actors.map((actor) => actor.spawnPointId)).size,
          world.actors.length,
        );
        for (const actor of world.actors) {
          const spawn = world.spawnPoints.find((candidate) =>
            candidate.id === actor.spawnPointId &&
            candidate.teamId === actor.teamId
          );
          assert.ok(spawn);
          assert.deepEqual(actor.position, spawn.position);
          assert.deepEqual(actor.spawnPosition, spawn.position);
          assert.equal(
            world.pickups.some((pickup) =>
              Math.hypot(
                pickup.position.x - actor.position.x,
                pickup.position.y - actor.position.y,
              ) <= pickup.radius + actor.radius
            ),
            false,
          );
          assert.equal(
            world.actors.some((other) =>
              other.id !== actor.id &&
              Math.hypot(
                other.position.x - actor.position.x,
                other.position.y - actor.position.y,
              ) < other.radius + actor.radius
            ),
            false,
          );
        }
      }
    }
  }
});

test("4v4 map validation rejects a missing team spawn slot", () => {
  const missingSlotMap = {
    ...TRAINING_CROSSING_V2,
    spawnPoints: TRAINING_CROSSING_V2.spawnPoints.filter((spawn) =>
      spawn.id !== "blue-player-spawn-4"
    ),
  };
  assert.equal(
    validateWorldMapForMode(missingSlotMap, "team-deathmatch", 4).some(
      (issue) => issue.code === "missing-team-spawn",
    ),
    true,
  );
});

test("default arena roster preserves the existing 1v1 actor ids", () => {
  const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
  assert.deepEqual(world.actors.map((actor) => actor.id), [
    "blue-player",
    "red-player",
  ]);
});

test("arena bot groups control every non-human slot from 1v1 through 4v4", () => {
  const modes = [
    {
      id: "team-deathmatch" as const,
      createWorld: createTeamDeathmatchWorldState,
      createMode: () => new TeamDeathmatchMode(),
    },
    {
      id: "classic-ctf" as const,
      createWorld: createClassicCtfWorldState,
      createMode: () => new ClassicCtfMode(TRAINING_CROSSING_V2),
    },
    {
      id: "one-flag" as const,
      createWorld: createOneFlagWorldState,
      createMode: () => new OneFlagMode(TRAINING_CROSSING_V2),
    },
  ];
  for (const teamSize of [1, 2, 3, 4] as const) {
    const bots = createArenaRoster(teamSize).filter((participant) =>
      participant.actorId !== "blue-player"
    );
    for (const definition of modes) {
      const world = definition.createWorld(TRAINING_CROSSING_V2, { teamSize });
      definition.createMode().initialize(world);
      const group = createArenaBotControllerGroup(
        definition.id,
        TRAINING_CROSSING_V2,
        bots,
      );
      const actions = group.readActions(createWorldSnapshot(world), 34);
      const controlledActorIds = new Set(actions
        .filter((action) => action.action === "move")
        .map((action) => action.actorId));
      assert.equal(group.size, bots.length);
      assert.deepEqual(
        controlledActorIds,
        new Set(bots.map((participant) => participant.actorId)),
      );
      group.reset();
    }
  }
});

test("dynamic TDM bot targeting switches to the next active enemy", () => {
  const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2, {
    teamSize: 2,
  });
  new TeamDeathmatchMode().initialize(world);
  const red = world.actors.find((actor) => actor.id === "red-player")!;
  const nearBlue = world.actors.find((actor) => actor.id === "blue-player-2")!;
  const farBlue = world.actors.find((actor) => actor.id === "blue-player")!;
  red.position = { x: 100, y: 100 };
  nearBlue.position = { x: 200, y: 100 };
  farBlue.position = { x: 500, y: 100 };
  const controller = new TdmBotController("red-player");

  let aim = controller.readActions(createWorldSnapshot(world), 34).find(
    (action) => action.action === "aim",
  );
  assert.deepEqual(aim?.direction, { x: 1, y: 0 });

  nearBlue.lifeState = "dead";
  farBlue.position = { x: 100, y: 400 };
  aim = controller.readActions(createWorldSnapshot(world), 34).find(
    (action) => action.action === "aim",
  );
  assert.deepEqual(aim?.direction, { x: 0, y: 1 });
});

test("classic CTF bot roles are stable for four team slots", () => {
  assert.deepEqual(
    ([1, 2, 3, 4] as const).map(classicCtfRoleForSlot),
    ["attacker", "defender", "support", "attacker"],
  );
});
