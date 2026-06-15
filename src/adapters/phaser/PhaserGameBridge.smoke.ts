import {
  applyGroundMovement,
  applyJumpMovement,
  applyWorldCollision,
  awardScore,
  createActorState,
  createClassicCtfWorldState,
  createOneFlagWorldState,
  createEmptyWorldState,
  createWorldSnapshot,
  createPickupState,
  createScoreBoardState,
  createTeamDeathmatchWorldState,
  clampRuntimeDeltaMs,
  ClassicCtfBotController,
  ClassicCtfBotDecisionController,
  DiagnosticArenaMode,
  fireV1Weapons,
  FLANK_SWITCH_V2,
  GRAND_ARCHIVE_V2,
  GridBotNavigator,
  getWorldMap,
  GameplayCoreRuntime,
  ClassicCtfMode,
  OneFlagBotController,
  OneFlagBotDecisionController,
  OneFlagMode,
  resolveWorldMap,
  TeamDeathmatchMode,
  TdmBotCombatController,
  TdmBotController,
  TRAINING_CROSSING_V2,
  updatePickups,
  updateProjectiles,
  validateWorldMapForMode,
  V2_ACTOR_LIFECYCLE_CONFIG,
  V2_ARENA_PICKUP_PARITY_CONFIG,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
  V2_GAMEPLAY_RUNTIME_TIMING_CONFIG,
  V2_GROUND_PARITY_CONFIG,
  V2_JUMP_PARITY_CONFIG,
} from "../../core";
import type {
  ActorState,
  CoreActionIntent,
  PickupState,
  WorldMapData,
  WorldRect,
} from "../../core";
import type { WorldGeometry } from "../../core";
import { createDiagnosticWorldState } from "../../core/runtime/createDiagnosticWorldState";
import { PhaserGameBridge } from "./PhaserGameBridge";
import { readV2RouteState } from "../../v2Route";
import {
  resolveMobileWeaponReleaseDirection,
  resolveMobileWeaponTapDirection,
} from "./PhaserMobileInputAdapter";

export function runPhaserGameBridgeSmokeCheck(): void {
  let renders = 0;
  let audioFrames = 0;
  let effectFrames = 0;
  let hudFrames = 0;
  let diagnosticFrames = 0;
  const bridge = new PhaserGameBridge(new GameplayCoreRuntime(), {
    renderer: {
      render: () => renders++,
      reset: () => {},
      dispose: () => {},
    },
    audio: {
      handleEvents: () => audioFrames++,
      reset: () => {},
      dispose: () => {},
    },
    diagnostics: {
      renderFrame: () => diagnosticFrames++,
      reset: () => {},
      dispose: () => {},
    },
    effects: {
      handleEvents: () => {},
      update: () => effectFrames++,
      reset: () => {},
      dispose: () => {},
    },
    hud: {
      render: () => hudFrames++,
      reset: () => {},
      dispose: () => {},
    },
  });
  const initial = bridge.initialize();
  const next = bridge.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [{
      action: "move",
      phase: "held",
      direction: { x: 1, y: 0 },
      magnitude: 1,
    }],
  });
  const decelerated = bridge.advance({
    sequence: 2,
    timeMs: 68,
    deltaMs: 34,
    actions: [{
      action: "move",
      phase: "held",
      direction: { x: 0, y: 0 },
      magnitude: 0,
    }],
  });

  if (initial.snapshot.timeMs !== 0) {
    throw new Error("Inert bridge must initialize at time zero.");
  }
  if (
    initial.snapshot.map?.id !== "training-crossing-v2" ||
    initial.snapshot.geometry.bounds.maxX !== 1500 ||
    initial.snapshot.geometry.bounds.maxY !== 820 ||
    initial.snapshot.geometry.solids.length !== 10 ||
    initial.snapshot.geometry.gaps.length !== 2 ||
    initial.snapshot.spawnPoints.length !== 5 ||
    initial.snapshot.spawnPoints.filter((spawn) =>
        spawn.teamId === "red"
      ).length !== 4
  ) {
    throw new Error(
      "V2 shell must initialize Training Crossing geometry and team spawns.",
    );
  }
  if (next.snapshot.timeMs !== 34) {
    throw new Error("Inert bridge must advance by the input delta.");
  }
  const initialActor = initial.snapshot.actors[0];
  const nextActor = next.snapshot.actors[0];
  const initialActorSpawn = initial.snapshot.spawnPoints.find((spawn) =>
    spawn.id === initialActor?.spawnPointId
  );
  if (
    next.events.length !== 1 ||
    initial.snapshot.actors.length !== 4 ||
    next.snapshot.actors.length !== 4
  ) {
    throw new Error(
      "Inert bridge must expose one player and three target diagnostics.",
    );
  }
  const redTargets = initial.snapshot.actors.filter((actor) =>
    actor.teamId === "red" && actor.kind === "diagnostic-target"
  );
  if (
    redTargets.length !== 3 ||
    new Set(redTargets.map((actor) => actor.id)).size !== 3 ||
    redTargets.some((actor) =>
      !actor.spawnPointId ||
      !initial.snapshot.spawnPoints.some((spawn) =>
        spawn.id === actor.spawnPointId &&
        spawn.teamId === actor.teamId &&
        spawn.position.x === actor.spawnPosition.x &&
        spawn.position.y === actor.spawnPosition.y
      )
    )
  ) {
    throw new Error("Every red target must own a distinct red team spawn.");
  }
  if (
    !initialActor ||
    !nextActor ||
    !initialActorSpawn ||
    initialActor.id !== "diagnostic-actor-1" ||
    initialActor.position.x !== initialActorSpawn.position.x ||
    initialActor.position.y !== initialActorSpawn.position.y ||
    nextActor.position.x <= initialActor.position.x ||
    nextActor.position.y !== initialActor.position.y ||
    nextActor.velocity.x <= 0 ||
    nextActor.velocity.x >= V2_GROUND_PARITY_CONFIG.maxSpeed ||
    nextActor.velocity.y !== 0
  ) {
    throw new Error("Diagnostic actor must accelerate with V2 ground movement.");
  }
  if (next.events[0]?.type !== "actor.moved") {
    throw new Error("Diagnostic movement must emit a serializable actor event.");
  }
  const deceleratedActor = decelerated.snapshot.actors[0];
  if (
    !deceleratedActor ||
    deceleratedActor.velocity.x <= 0 ||
    deceleratedActor.velocity.x >= nextActor.velocity.x
  ) {
    throw new Error("Diagnostic actor must decelerate without ground input.");
  }
  if (
    initial.events[0]?.type !== "match.started" ||
    next.hudState.phase !== "running"
  ) {
    throw new Error("Diagnostic mode must initialize a running match.");
  }
  if (
    renders !== 3 ||
    audioFrames !== 3 ||
    effectFrames !== 3 ||
    hudFrames !== 3
    || diagnosticFrames !== 3
  ) {
    throw new Error("Inert bridge must forward every frame to provided ports.");
  }

  bridge.dispose();
  checkJumpParity();
  checkAuthoredJumpReachability();
  checkCollisionAndGapGroundwork();
  checkActorLifecycle();
  checkProjectilePipeline();
  checkPickupPipeline();
  checkMatchLifecycle();
  checkScoreSafety();
  checkMobileWeaponTapTargeting();
  checkRuntimeTimingAndRouteValidation();
  checkWorldMapRegistry();
  checkClassicCtfMode();
  checkOneFlagFoundation();
  checkOneFlagBots();
  checkTeamDeathmatchSlice();
  checkBasicAutoShootParity();
  checkTdmBotController();
  checkV1WeaponParity();
}

function checkMobileWeaponTapTargeting(): void {
  const world = createEmptyWorldState("mobile-weapon-targeting");
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
    solids: [],
    gaps: [],
  };
  world.actors.push(
    createActorState({
      id: "blue",
      kind: "player",
      teamId: "blue",
      position: { x: 100, y: 100 },
      radius: 16,
      maxHealth: 100,
      maxArmor: 100,
    }),
    createActorState({
      id: "red",
      kind: "player",
      teamId: "red",
      position: { x: 160, y: 180 },
      radius: 16,
      maxHealth: 100,
      maxArmor: 100,
    }),
  );
  const expectedLength = 100;
  const targeted = resolveMobileWeaponTapDirection(
    createWorldSnapshot(world),
    "blue",
    "whip",
    { x: -1, y: 0 },
  );
  if (
    Math.abs(targeted.x - 60 / expectedLength) > .0001 ||
    Math.abs(targeted.y - 80 / expectedLength) > .0001
  ) {
    throw new Error("Mobile weapon tap must auto-aim at the nearest visible enemy.");
  }

  world.geometry = {
    ...world.geometry,
    solids: [{
      id: "blocking-wall",
      x: 125,
      y: 90,
      width: 12,
      height: 120,
    }],
  };
  const blocked = resolveMobileWeaponTapDirection(
    createWorldSnapshot(world),
    "blue",
    "rocket",
    { x: -1, y: 0 },
  );
  if (blocked.x !== 1 || blocked.y !== 0) {
    throw new Error("Blocked mobile taps must retain the actor fallback direction.");
  }

  const tapRelease = resolveMobileWeaponReleaseDirection({
    dragged: false,
    dragDistance: 0,
    manualDirection: { x: 0, y: -1 },
    autoDirection: { x: .6, y: .8 },
  });
  const manualRelease = resolveMobileWeaponReleaseDirection({
    dragged: true,
    dragDistance: 64,
    manualDirection: { x: 0, y: -4 },
    autoDirection: { x: 1, y: 0 },
  });
  const cancelledRelease = resolveMobileWeaponReleaseDirection({
    dragged: true,
    dragDistance: 12,
    manualDirection: { x: 0, y: -1 },
    autoDirection: { x: 1, y: 0 },
  });
  if (
    tapRelease?.x !== .6 ||
    tapRelease.y !== .8 ||
    manualRelease?.x !== 0 ||
    manualRelease.y !== -1 ||
    cancelledRelease !== null
  ) {
    throw new Error("Mobile weapon release must distinguish tap, manual aim and cancel.");
  }
}

function checkRuntimeTimingAndRouteValidation(): void {
  if (
    clampRuntimeDeltaMs(-40) !== 0 ||
    clampRuntimeDeltaMs(34) !== 34 ||
    clampRuntimeDeltaMs(900) !== V2_GAMEPLAY_RUNTIME_TIMING_CONFIG.maxFrameDeltaMs
  ) {
    throw new Error("Gameplay runtime must clamp frame deltas to the approved range.");
  }

  const runtime = new GameplayCoreRuntime();
  runtime.initialize();
  const advanced = runtime.advance({
    sequence: 1,
    timeMs: 999,
    deltaMs: 999,
    actions: [],
  });
  if (advanced.snapshot.timeMs !== V2_GAMEPLAY_RUNTIME_TIMING_CONFIG.maxFrameDeltaMs) {
    throw new Error("Gameplay runtime must not advance time by an oversized frame.");
  }

  const invalidRoute = readV2RouteState(new URLSearchParams(
    "scene=v2&mode=invalid&map=missing-map&players=weird&controls=broken",
  ));
  if (
    invalidRoute.canStartMatch ||
    invalidRoute.issues.length < 3 ||
    invalidRoute.route.menu !== true
  ) {
    throw new Error("Invalid V2 routes must be rejected into the menu path.");
  }
}

function checkWorldMapRegistry(): void {
  if (
    getWorldMap("training-crossing-v2")?.displayName !== "Training Crossing" ||
    getWorldMap("grand-archive-v2") !== GRAND_ARCHIVE_V2 ||
    getWorldMap("flank-switch-v2") !== FLANK_SWITCH_V2 ||
    getWorldMap("missing-map") !== undefined ||
    resolveWorldMap("missing-map").id !== "training-crossing-v2"
  ) {
    throw new Error("V2 map registry must resolve known maps and fallback safely.");
  }
  if (
    validateWorldMapForMode(TRAINING_CROSSING_V2, "team-deathmatch").length !== 0 ||
    validateWorldMapForMode(TRAINING_CROSSING_V2, "classic-ctf").length !== 0 ||
    validateWorldMapForMode(TRAINING_CROSSING_V2, "one-flag").length !== 0
  ) {
    throw new Error("Playable V2 maps must validate for supported modes.");
  }
  const invalidOneFlagMap = {
    ...TRAINING_CROSSING_V2,
    gameplay: {
      ...TRAINING_CROSSING_V2.gameplay,
      combatZone: undefined,
    },
  };
  if (
    !validateWorldMapForMode(invalidOneFlagMap, "one-flag").some((issue) =>
      issue.code === "missing-combat-zone"
    )
  ) {
    throw new Error("One Flag map validation must reject missing combat zones.");
  }

  const world = createTeamDeathmatchWorldState(GRAND_ARCHIVE_V2);
  if (
    world.map?.id !== "grand-archive-v2" ||
    world.geometry.bounds.maxX !== 2500 ||
    world.geometry.bounds.maxY !== 820 ||
    world.geometry.solids.length !== 20 ||
    world.geometry.gaps.length !== 4 ||
    world.pickups.length !== 15 ||
    world.actors.find((actor) => actor.id === "red-player")
        ?.spawnPosition.x !== 145 ||
    world.actors.find((actor) => actor.id === "blue-player")
        ?.spawnPosition.x !== 2355
  ) {
    throw new Error("Grand Archive must populate its complete V2 TDM world.");
  }

  const flankWorld = createTeamDeathmatchWorldState(FLANK_SWITCH_V2);
  if (
    flankWorld.map?.id !== "flank-switch-v2" ||
    flankWorld.geometry.bounds.maxX !== 2500 ||
    flankWorld.geometry.bounds.maxY !== 820 ||
    flankWorld.geometry.solids.length !== 14 ||
    flankWorld.geometry.gaps.length !== 4 ||
    flankWorld.pickups.length !== 15 ||
    flankWorld.actors.find((actor) => actor.id === "red-player")
        ?.spawnPosition.x !== 150 ||
    flankWorld.actors.find((actor) => actor.id === "blue-player")
        ?.spawnPosition.x !== 2350
  ) {
    throw new Error("Flank Switch must populate its complete V2 TDM world.");
  }
}

function checkClassicCtfMode(): void {
  checkClassicCtfBotRoles();
  checkClassicCtfBotCapture();
  const world = createClassicCtfWorldState(TRAINING_CROSSING_V2);
  const mode = new ClassicCtfMode(TRAINING_CROSSING_V2, {
    durationMs: 180_000,
    captureLimit: 3,
    pickupRadius: 36,
    initialScores: [
      { id: "blue", teamId: "blue", score: 0 },
      { id: "red", teamId: "red", score: 0 },
    ],
  });
  const started = mode.initialize(world);
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  const red = world.actors.find((actor) => actor.id === "red-player");
  if (
    started[0]?.type !== "match.started" ||
    world.objectives.length !== 2 ||
    !blue ||
    !red
  ) {
    throw new Error("Classic CTF must initialize two team flags and players.");
  }

  const redFlagHome = {
    x: TRAINING_CROSSING_V2.gameplay.redBase.x +
      TRAINING_CROSSING_V2.gameplay.redBase.width / 2,
    y: TRAINING_CROSSING_V2.gameplay.redBase.y +
      TRAINING_CROSSING_V2.gameplay.redBase.height / 2,
  };
  blue.position = { ...redFlagHome };
  world.timeMs = 34;
  let events = mode.update(world, 34);
  if (
    !events.some((event) => event.type === "objective.flagPickedUp") ||
    world.objectives.find((objective) => objective.id === "red-flag")
        ?.state.interactingActorId !== blue.id
  ) {
    throw new Error("Classic CTF must allow an enemy flag pickup in V1 range.");
  }

  blue.position = { x: 700, y: 380 };
  blue.jump.height = 20;
  world.timeMs = 68;
  mode.update(world, 34);
  const carriedRed = world.objectives.find((objective) =>
    objective.id === "red-flag"
  );
  if (
    carriedRed?.position.x !== 700 ||
    carriedRed.position.y !== 336
  ) {
    throw new Error("Carried CTF flags must follow the actor and jump height.");
  }

  events = mode.handleEvent({
    id: "blue-fell",
    type: "actor.fell",
    timeMs: 68,
    sourceActorId: blue.id,
    teamId: blue.teamId ?? undefined,
    payload: {},
  }, world);
  if (
    !events.some((event) => event.type === "objective.flagReset") ||
    world.objectives.find((objective) => objective.id === "red-flag")
        ?.state.status !== "home"
  ) {
    throw new Error("Classic CTF must reset a carried flag after a fall.");
  }

  blue.jump.height = 0;
  blue.position = { ...redFlagHome };
  world.timeMs = 102;
  mode.update(world, 34);
  events = mode.handleEvent({
    id: "blue-died",
    type: "actor.died",
    timeMs: 102,
    targetActorId: blue.id,
    teamId: blue.teamId ?? undefined,
    payload: { victimLifeId: blue.lifeId },
  }, world);
  if (
    !events.some((event) => event.type === "objective.flagReset") ||
    world.objectives.find((objective) => objective.id === "red-flag")
        ?.state.status !== "home"
  ) {
    throw new Error("Classic CTF must reset a carried flag after death.");
  }

  const blueFlagHome = {
    x: TRAINING_CROSSING_V2.gameplay.blueBase.x +
      TRAINING_CROSSING_V2.gameplay.blueBase.width / 2,
    y: TRAINING_CROSSING_V2.gameplay.blueBase.y +
      TRAINING_CROSSING_V2.gameplay.blueBase.height / 2,
  };
  const blueBase = blueFlagHome;
  for (let capture = 1; capture <= 3; capture++) {
    blue.lifeState = "active";
    blue.position = { ...redFlagHome };
    world.timeMs += 34;
    mode.update(world, 34);
    if (capture === 1) {
      red.position = { ...blueFlagHome };
      mode.update(world, 0);
    }
    blue.position = { ...blueBase };
    world.timeMs += 34;
    events = mode.update(world, 34);
    if (
      !events.some((event) => event.type === "objective.flagCaptured") ||
      world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !==
        capture
    ) {
      throw new Error("Classic CTF captures must award exactly one point.");
    }
  }
  if (
    world.match?.phase !== "ended" ||
    world.match.result?.kind !== "winner" ||
    world.match.result.winnerEntryId !== "blue"
  ) {
    throw new Error("Classic CTF must end at the configured capture limit.");
  }
}

function checkClassicCtfBotRoles(): void {
  const world = createClassicCtfWorldState(TRAINING_CROSSING_V2);
  const mode = new ClassicCtfMode(TRAINING_CROSSING_V2);
  mode.initialize(world);
  const red = world.actors.find((actor) => actor.id === "red-player")!;
  const blue = world.actors.find((actor) => actor.id === "blue-player")!;
  const attacker = new ClassicCtfBotDecisionController(
    "attacker",
    TRAINING_CROSSING_V2,
  );
  const defender = new ClassicCtfBotDecisionController(
    "defender",
    TRAINING_CROSSING_V2,
  );
  const support = new ClassicCtfBotDecisionController(
    "support",
    TRAINING_CROSSING_V2,
  );

  let snapshot = createWorldSnapshot(world);
  if (
    attacker.chooseGoal(red, snapshot).kind !== "attack-flag" ||
    defender.chooseGoal(red, snapshot).kind !== "patrol-base" ||
    support.chooseGoal(red, snapshot).kind !== "support-mid"
  ) {
    throw new Error(
      "Classic CTF bot roles must start with distinct attack, patrol and support goals.",
    );
  }

  blue.position = centerOfRect(TRAINING_CROSSING_V2.gameplay.redBase);
  snapshot = createWorldSnapshot(world);
  if (defender.chooseGoal(red, snapshot).kind !== "defend-base") {
    throw new Error("Classic CTF defenders must engage base invaders.");
  }

  const redFlag = world.objectives.find((objective) =>
    objective.id === "red-flag"
  )!;
  const redFlagIndex = world.objectives.indexOf(redFlag);
  world.objectives[redFlagIndex] = {
    ...redFlag,
    state: {
      ...redFlag.state,
      status: "carried",
      interactingActorId: blue.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  for (const controller of [attacker, defender, support]) {
    if (controller.chooseGoal(red, snapshot).kind !== "recover-own-flag") {
      throw new Error(
        "Every Classic CTF role must urgently recover its stolen flag.",
      );
    }
  }

  const blueFlag = world.objectives.find((objective) =>
    objective.id === "blue-flag"
  )!;
  const blueFlagIndex = world.objectives.indexOf(blueFlag);
  world.objectives[redFlagIndex] = {
    ...redFlag,
    state: {
      ...redFlag.state,
      status: "home",
      interactingActorId: null,
    },
  };
  world.objectives[blueFlagIndex] = {
    ...blueFlag,
    state: {
      ...blueFlag.state,
      status: "carried",
      interactingActorId: red.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  if (attacker.chooseGoal(red, snapshot).kind !== "return-flag") {
    throw new Error("Classic CTF flag carriers must return to their own base.");
  }

  const ally = createActorState({
    id: "red-support-ally",
    kind: "bot",
    teamId: "red",
    position: { x: 900, y: 410 },
    radius: 16,
    maxHealth: 100,
    maxArmor: 100,
  });
  world.actors.push(ally);
  world.objectives[blueFlagIndex] = {
    ...blueFlag,
    state: {
      ...blueFlag.state,
      status: "carried",
      interactingActorId: ally.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  if (support.chooseGoal(red, snapshot).kind !== "escort-carrier") {
    throw new Error("Classic CTF support bots must escort allied carriers.");
  }
}

function checkClassicCtfBotCapture(): void {
  for (
    const map of [
      TRAINING_CROSSING_V2,
      GRAND_ARCHIVE_V2,
      FLANK_SWITCH_V2,
    ]
  ) {
    checkClassicCtfBotCaptureOnMap(map);
  }
}

function checkClassicCtfBotCaptureOnMap(map: WorldMapData): void {
  const runtime = new GameplayCoreRuntime({
    mode: new ClassicCtfMode(map),
    createWorld: () => createClassicCtfWorldState(map),
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  const controller = new ClassicCtfBotController(
    "red-player",
    "attacker",
    map,
  );
  let pickedUp = false;
  let captured = false;
  let fell = false;
  for (let sequence = 1; sequence <= 3000; sequence++) {
    const frame = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
    pickedUp ||= frame.events.some((event) =>
      event.type === "objective.flagPickedUp" &&
      event.sourceActorId === "red-player"
    );
    captured ||= frame.events.some((event) =>
      event.type === "objective.flagCaptured" &&
      event.sourceActorId === "red-player"
    );
    const red = actorById(frame.snapshot.actors, "red-player");
    fell ||= red.lifeState === "falling";
    if (captured) break;
  }
  const redScore = runtime.snapshot.scoreBoard.entries.find((entry) =>
    entry.id === "red"
  )?.score;
  if (!pickedUp || !captured || redScore !== 1 || fell) {
    throw new Error(
      `${map.displayName} CTF attacker bots must capture through normal movement and objective rules.`,
    );
  }
}

function centerOfRect(rect: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): { readonly x: number; readonly y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function checkOneFlagFoundation(): void {
  for (
    const map of [
      TRAINING_CROSSING_V2,
      GRAND_ARCHIVE_V2,
      FLANK_SWITCH_V2,
    ]
  ) {
    const world = createOneFlagWorldState(map);
    const mode = new OneFlagMode(map);
    const started = mode.initialize(world);
    const objective = world.objectives[0];
    const zone = map.gameplay.combatZone;
    const expectedX = zone
      ? zone.x + zone.width / 2
      : (map.geometry.bounds.minX + map.geometry.bounds.maxX) / 2;
    const expectedY = zone
      ? zone.y + zone.height / 2
      : (map.geometry.bounds.minY + map.geometry.bounds.maxY) / 2;

    if (
      started[0]?.type !== "match.started" ||
      world.modeId !== "one-flag" ||
      world.objectives.length !== 1 ||
      objective?.id !== "center-flag" ||
      objective.kind !== "neutral-flag" ||
      objective.position.x !== expectedX ||
      objective.position.y !== expectedY ||
      objective.state.status !== "home" ||
      objective.state.controllingTeamId !== null ||
      objective.state.interactingActorId !== null
    ) {
      throw new Error(
        `One Flag must initialize one neutral center flag on ${map.id}.`,
      );
    }

    const hud = mode.getHudState(createWorldSnapshot(world));
    const events = mode.update(world, 34);
    if (
      events.length !== 0 ||
      hud.modeId !== "one-flag" ||
      hud.objectives.length !== 1 ||
      world.objectives[0]?.state.status !== "home" ||
      world.scoreBoard.entries.some((entry) => entry.score !== 0)
    ) {
      throw new Error(
        "One Flag must remain idle while no actor reaches the center flag.",
      );
    }
  }

  const world = createOneFlagWorldState(TRAINING_CROSSING_V2);
  const mode = new OneFlagMode(TRAINING_CROSSING_V2);
  mode.initialize(world);
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  if (!blue) throw new Error("One Flag smoke requires the blue player.");
  const center = {
    x: TRAINING_CROSSING_V2.gameplay.combatZone!.x +
      TRAINING_CROSSING_V2.gameplay.combatZone!.width / 2,
    y: TRAINING_CROSSING_V2.gameplay.combatZone!.y +
      TRAINING_CROSSING_V2.gameplay.combatZone!.height / 2,
  };
  const redBase = {
    x: TRAINING_CROSSING_V2.gameplay.redBase.x +
      TRAINING_CROSSING_V2.gameplay.redBase.width / 2,
    y: TRAINING_CROSSING_V2.gameplay.redBase.y +
      TRAINING_CROSSING_V2.gameplay.redBase.height / 2,
  };
  const blueBase = {
    x: TRAINING_CROSSING_V2.gameplay.blueBase.x +
      TRAINING_CROSSING_V2.gameplay.blueBase.width / 2,
    y: TRAINING_CROSSING_V2.gameplay.blueBase.y +
      TRAINING_CROSSING_V2.gameplay.blueBase.height / 2,
  };

  blue.position = { ...center };
  world.timeMs = 34;
  let events = mode.update(world, 34);
  if (
    !events.some((event) => event.type === "objective.flagPickedUp") ||
    world.objectives[0]?.state.interactingActorId !== blue.id
  ) {
    throw new Error("One Flag must allow either team to take the center flag.");
  }
  if (
    mode.getHudState(createWorldSnapshot(world)).notices[0] !==
      "blue carries the center flag"
  ) {
    throw new Error("One Flag HUD state must identify the carrier team.");
  }

  blue.position = { x: 700, y: 380 };
  blue.jump.height = 20;
  world.timeMs = 68;
  mode.update(world, 34);
  if (
    world.objectives[0]?.position.x !== 700 ||
    world.objectives[0]?.position.y !== 336
  ) {
    throw new Error("The neutral flag must follow its carrier and jump height.");
  }

  events = mode.handleEvent({
    id: "one-flag-blue-fell",
    type: "actor.fell",
    timeMs: 68,
    sourceActorId: blue.id,
    teamId: blue.teamId ?? undefined,
    payload: {},
  }, world);
  if (
    !events.some((event) => event.type === "objective.flagReset") ||
    world.objectives[0]?.state.status !== "home" ||
    world.objectives[0]?.position.x !== center.x ||
    world.objectives[0]?.position.y !== center.y
  ) {
    throw new Error("One Flag must reset immediately after a carrier falls.");
  }

  blue.position = { ...center };
  world.timeMs += 34;
  mode.update(world, 34);
  events = mode.handleEvent({
    id: "one-flag-blue-died",
    type: "actor.died",
    timeMs: world.timeMs,
    targetActorId: blue.id,
    teamId: blue.teamId ?? undefined,
    payload: { victimLifeId: blue.lifeId },
  }, world);
  if (
    !events.some((event) => event.type === "objective.flagReset") ||
    world.objectives[0]?.state.status !== "home"
  ) {
    throw new Error("One Flag must reset immediately after a carrier dies.");
  }

  blue.jump.height = 0;
  for (let capture = 1; capture <= 3; capture++) {
    blue.position = { ...center };
    world.timeMs += 34;
    mode.update(world, 34);

    blue.position = { ...blueBase };
    world.timeMs += 34;
    events = mode.update(world, 34);
    if (
      events.some((event) => event.type === "objective.flagCaptured") ||
      world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !==
        capture - 1
    ) {
      throw new Error("One Flag must not score in the carrier's own base.");
    }

    blue.position = { ...redBase };
    world.timeMs += 34;
    events = mode.update(world, 34);
    if (
      !events.some((event) => event.type === "objective.flagCaptured") ||
      world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !==
        capture
    ) {
      throw new Error("One Flag must score in the opposing team base.");
    }
  }
  if (
    world.match?.phase !== "ended" ||
    world.match.result?.kind !== "winner" ||
    world.match.result.winnerEntryId !== "blue"
  ) {
    throw new Error("One Flag must end at the configured capture limit.");
  }
}

function checkOneFlagBots(): void {
  checkOneFlagBotDecisions();
  checkOneFlagBotPickupRuntime();
  checkOneFlagBotEscortRuntime();
  checkOneFlagBotChaseRuntime();
  checkOneFlagBotCaptureRuntime();
}

function checkOneFlagBotDecisions(): void {
  const world = createOneFlagWorldState(TRAINING_CROSSING_V2);
  const mode = new OneFlagMode(TRAINING_CROSSING_V2);
  mode.initialize(world);
  const controller = new OneFlagBotDecisionController(TRAINING_CROSSING_V2);
  const red = world.actors.find((actor) => actor.id === "red-player")!;
  const blue = world.actors.find((actor) => actor.id === "blue-player")!;

  let snapshot = createWorldSnapshot(world);
  if (controller.chooseGoal(red, snapshot).kind !== "take-center-flag") {
    throw new Error("One Flag bots must initially seek the center flag.");
  }

  world.objectives[0] = {
    ...world.objectives[0]!,
    state: {
      ...world.objectives[0]!.state,
      status: "carried",
      interactingActorId: red.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  if (controller.chooseGoal(red, snapshot).kind !== "capture-flag") {
    throw new Error("One Flag carriers must head for the opposing base.");
  }

  const ally = createActorState({
    id: "red-one-flag-ally",
    kind: "bot",
    teamId: "red",
    position: { x: 760, y: 410 },
    radius: 16,
    maxHealth: 100,
    maxArmor: 100,
  });
  world.actors.push(ally);
  world.objectives[0] = {
    ...world.objectives[0]!,
    state: {
      ...world.objectives[0]!.state,
      status: "carried",
      interactingActorId: ally.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  if (controller.chooseGoal(red, snapshot).kind !== "escort-carrier") {
    throw new Error("One Flag bots must escort an allied carrier.");
  }

  world.objectives[0] = {
    ...world.objectives[0]!,
    state: {
      ...world.objectives[0]!.state,
      status: "carried",
      interactingActorId: blue.id,
    },
  };
  snapshot = createWorldSnapshot(world);
  if (controller.chooseGoal(red, snapshot).kind !== "chase-enemy-carrier") {
    throw new Error("One Flag bots must chase an enemy carrier.");
  }

  world.objectives[0] = {
    ...world.objectives[0]!,
    state: {
      ...world.objectives[0]!.state,
      status: "carried",
      interactingActorId: "missing-carrier",
    },
  };
  snapshot = createWorldSnapshot(world);
  if (controller.chooseGoal(red, snapshot).kind !== "control-mid") {
    throw new Error("One Flag bots must fall back to center control.");
  }
}

function checkOneFlagBotPickupRuntime(): void {
  const runtime = createOneFlagBotRuntime(TRAINING_CROSSING_V2);
  const controller = new OneFlagBotController("red-player", TRAINING_CROSSING_V2);
  let pickedUp = false;
  for (let sequence = 1; sequence <= 800; sequence++) {
    const frame = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
    pickedUp ||= frame.events.some((event) =>
      event.type === "objective.flagPickedUp" &&
      event.sourceActorId === "red-player"
    );
    if (pickedUp) break;
  }
  if (!pickedUp) {
    throw new Error("One Flag bots must reach and pick up the center flag.");
  }
}

function checkOneFlagBotEscortRuntime(): void {
  const runtime = createOneFlagBotRuntime(
    TRAINING_CROSSING_V2,
    (world) => {
      const ally = createActorState({
        id: "red-one-flag-ally",
        kind: "bot",
        teamId: "red",
        position: centerOfRect(TRAINING_CROSSING_V2.gameplay.combatZone!),
        radius: 16,
        maxHealth: 100,
        maxArmor: 100,
      });
      zeroWeapons(ally);
      world.actors.push(ally);
      const red = world.actors.find((actor) => actor.id === "red-player")!;
      red.position = { x: 150, y: 410 };
      red.spawnPosition = { ...red.position };
      red.lastSafePosition = { ...red.position };
      const blue = world.actors.find((actor) => actor.id === "blue-player")!;
      blue.position = { x: 1350, y: 410 };
      blue.spawnPosition = { ...blue.position };
      blue.lastSafePosition = { ...blue.position };
      zeroWeapons(red);
      zeroWeapons(blue);
    },
  );
  const controller = new OneFlagBotController("red-player", TRAINING_CROSSING_V2);
  runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [],
  });
  const initialRed = actorById(runtime.snapshot.actors, "red-player");
  const ally = actorById(runtime.snapshot.actors, "red-one-flag-ally");
  const initialDistance = distanceBetweenPositions(
    initialRed.position,
    ally.position,
  );
  for (let sequence = 2; sequence <= 140; sequence++) {
    runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
  }
  const finalRed = actorById(runtime.snapshot.actors, "red-player");
  const finalDistance = distanceBetweenPositions(finalRed.position, ally.position);
  if (finalDistance >= initialDistance - 120) {
    throw new Error("One Flag bots must close distance to escort an allied carrier.");
  }
}

function checkOneFlagBotChaseRuntime(): void {
  const runtime = createOneFlagBotRuntime(
    TRAINING_CROSSING_V2,
    (world) => {
      const center = centerOfRect(TRAINING_CROSSING_V2.gameplay.combatZone!);
      const blue = world.actors.find((actor) => actor.id === "blue-player")!;
      blue.position = { ...center };
      blue.spawnPosition = { ...center };
      blue.lastSafePosition = { ...center };
      const red = world.actors.find((actor) => actor.id === "red-player")!;
      red.position = { x: 150, y: 410 };
      red.spawnPosition = { ...red.position };
      red.lastSafePosition = { ...red.position };
      zeroWeapons(red);
      zeroWeapons(blue);
    },
  );
  const controller = new OneFlagBotController("red-player", TRAINING_CROSSING_V2);
  runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [],
  });
  const initialRed = actorById(runtime.snapshot.actors, "red-player");
  const blue = actorById(runtime.snapshot.actors, "blue-player");
  const initialDistance = distanceBetweenPositions(
    initialRed.position,
    blue.position,
  );
  for (let sequence = 2; sequence <= 120; sequence++) {
    runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
  }
  const finalRed = actorById(runtime.snapshot.actors, "red-player");
  const finalDistance = distanceBetweenPositions(finalRed.position, blue.position);
  if (finalDistance >= initialDistance - 150) {
    throw new Error("One Flag bots must chase an enemy carrier.");
  }
}

function checkOneFlagBotCaptureRuntime(): void {
  for (
    const map of [
      TRAINING_CROSSING_V2,
      GRAND_ARCHIVE_V2,
      FLANK_SWITCH_V2,
    ]
  ) {
    const runtime = createOneFlagBotRuntime(map);
    const controller = new OneFlagBotController("red-player", map);
    let pickedUp = false;
    let captured = false;
    let fell = false;
    for (let sequence = 1; sequence <= 3200; sequence++) {
      const frame = runtime.advance({
        sequence,
        timeMs: sequence * 34,
        deltaMs: 34,
        actions: controller.readActions(runtime.snapshot, 34),
      });
      pickedUp ||= frame.events.some((event) =>
        event.type === "objective.flagPickedUp" &&
        event.sourceActorId === "red-player"
      );
      captured ||= frame.events.some((event) =>
        event.type === "objective.flagCaptured" &&
        event.sourceActorId === "red-player"
      );
      const red = actorById(frame.snapshot.actors, "red-player");
      fell ||= red.lifeState === "falling";
      if (captured) break;
    }
    const redScore = runtime.snapshot.scoreBoard.entries.find((entry) =>
      entry.id === "red"
    )?.score;
    if (!pickedUp || !captured || redScore !== 1 || fell) {
      throw new Error(
        `${map.displayName} One Flag bots must pick up and capture through normal rules.`,
      );
    }
  }
}

function checkJumpParity(): void {
  const speedActor = createActorState({
    id: "movement-speed-cap",
    kind: "diagnostic",
    position: { x: 200, y: 200 },
    radius: 16,
  });
  for (let frame = 0; frame < 120; frame++) {
    applyGroundMovement(
      speedActor,
      {
        direction: { x: 1, y: 0 },
        magnitude: 1,
        grounded: true,
      },
      34,
      V2_GROUND_PARITY_CONFIG,
    );
  }
  const cappedSpeed = Math.hypot(
    speedActor.velocity.x,
    speedActor.velocity.y,
  );
  if (
    V2_GROUND_PARITY_CONFIG.maxSpeed !== 268 ||
    Math.abs(cappedSpeed - V2_GROUND_PARITY_CONFIG.maxSpeed) > .001
  ) {
    throw new Error("V2 movement must enforce the approved 20% speed reduction.");
  }

  const shortJump = runJumpSequence(1);
  const heldJump = runJumpSequence(10);

  if (shortJump.maxHeight <= 0 || heldJump.maxHeight <= 0) {
    throw new Error("Short and held jumps must both produce jump height.");
  }
  if (heldJump.maxPlannedMs <= shortJump.maxPlannedMs) {
    throw new Error("Held jump must extend planned duration.");
  }
  if (heldJump.airborneFrames <= shortJump.airborneFrames) {
    throw new Error("Held jump must remain airborne longer than short jump.");
  }
  if (!shortJump.landed || !heldJump.landed) {
    throw new Error("Short and held jumps must both land.");
  }
  if (heldJump.horizontalDistance <= 0) {
    throw new Error("Air control must preserve horizontal movement.");
  }
  if (shortJump.jumpEvents !== 1 || heldJump.jumpEvents !== 1) {
    throw new Error("Each successful jump must emit actor.jumped exactly once.");
  }
}

function checkAuthoredJumpReachability(): void {
  for (
    const map of [
      TRAINING_CROSSING_V2,
      GRAND_ARCHIVE_V2,
      FLANK_SWITCH_V2,
    ]
  ) {
    for (const gap of map.geometry.gaps) {
      checkAuthoredRectTraversal(map, gap, "gap");
    }
    for (const solid of map.geometry.solids) {
      checkAuthoredRectTraversal(map, solid, "solid");
    }
  }
}

function checkAuthoredRectTraversal(
  map: WorldMapData,
  rect: WorldRect,
  kind: "gap" | "solid",
): void {
  const horizontal = rect.width <= rect.height;
  const direction = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const approachDistance = 40;
  const exitDistance = 16;
  const actor = createActorState({
    id: `${map.id}-${kind}-${rect.id}`,
    kind: "diagnostic",
    position: horizontal
      ? { x: rect.x - approachDistance, y: rect.y + rect.height / 2 }
      : { x: rect.x + rect.width / 2, y: rect.y - approachDistance },
    velocity: {
      x: direction.x * V2_GROUND_PARITY_CONFIG.maxSpeed,
      y: direction.y * V2_GROUND_PARITY_CONFIG.maxSpeed,
    },
    lastMoveDirection: direction,
    radius: 16,
  });
  actor.lastSafePosition = { ...actor.position };
  const geometry: WorldGeometry = {
    bounds: { ...map.geometry.bounds },
    solids: kind === "solid" ? [{ ...rect }] : [],
    gaps: kind === "gap" ? [{ ...rect }] : [],
  };
  const target = horizontal
    ? rect.x + rect.width + exitDistance
    : rect.y + rect.height + exitDistance;
  let collided = false;
  let fell = false;

  for (let frame = 0; frame < 40; frame++) {
    applyJumpMovement(
      actor,
      {
        pressed: frame === 0,
        held: frame < 18,
        released: frame === 18,
      },
      34,
      V2_JUMP_PARITY_CONFIG,
    );
    applyGroundMovement(
      actor,
      {
        direction,
        magnitude: 1,
        grounded: actor.jump.grounded,
      },
      34,
      V2_GROUND_PARITY_CONFIG,
    );
    const collision = applyWorldCollision(
      actor,
      geometry,
      34,
      (frame + 1) * 34,
      V2_COLLISION_GROUNDWORK_CONFIG,
    );
    collided ||= collision.collided;
    fell ||= collision.fell;
    const coordinate = horizontal ? actor.position.x : actor.position.y;
    if (coordinate >= target) {
      if (fell || collided) {
        break;
      }
      return;
    }
  }

  throw new Error(
    `${map.displayName} ${kind} ${rect.id} must remain jump-reachable at 80% speed.`,
  );
}

function runJumpSequence(heldFrames: number): {
  maxHeight: number;
  maxPlannedMs: number;
  airborneFrames: number;
  horizontalDistance: number;
  landed: boolean;
  jumpEvents: number;
} {
  const runtime = new GameplayCoreRuntime();
  const initial = runtime.initialize().snapshot.actors[0];
  if (!initial) {
    throw new Error("Jump smoke check requires a diagnostic actor.");
  }

  let sequence = 0;
  let maxHeight = 0;
  let maxPlannedMs = 0;
  let airborneFrames = 0;
  let landed = false;
  let jumpEvents = 0;
  let actor = initial;

  for (let frame = 0; frame < 80; frame++) {
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      direction: { x: 1, y: 0 },
      magnitude: 1,
    }];
    if (frame === 0) {
      actions.push(
        { action: "jump", phase: "pressed" },
        { action: "jump", phase: "held" },
      );
    } else if (frame < heldFrames) {
      actions.push({ action: "jump", phase: "held" });
    } else if (frame === heldFrames) {
      actions.push({ action: "jump", phase: "released" });
    }

    const result = runtime.advance({
      sequence: ++sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions,
    });
    jumpEvents += result.events.filter((event) =>
      event.type === "actor.jumped"
    ).length;
    actor = result.snapshot.actors[0] ?? actor;
    maxHeight = Math.max(maxHeight, actor.jump.height);
    maxPlannedMs = Math.max(maxPlannedMs, actor.jump.plannedDurationMs);
    if (!actor.jump.grounded) {
      airborneFrames++;
    } else if (airborneFrames > 0) {
      landed = true;
      break;
    }
  }

  return {
    maxHeight,
    maxPlannedMs,
    airborneFrames,
    horizontalDistance: actor.position.x - initial.position.x,
    landed,
    jumpEvents,
  };
}

function checkCollisionAndGapGroundwork(): void {
  const geometry: WorldGeometry = {
    bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
    solids: [{
      id: "smoke-solid",
      x: 200,
      y: 100,
      width: 50,
      height: 200,
    }],
    gaps: [{
      id: "smoke-gap",
      x: 300,
      y: 100,
      width: 100,
      height: 100,
    }],
  };
  const solidActor = createActorState({
    id: "solid-actor",
    kind: "diagnostic",
    position: { x: 190, y: 150 },
    velocity: { x: 100, y: 0 },
    radius: 24,
  });
  const solidResult = applyWorldCollision(
    solidActor,
    geometry,
    34,
    34,
    V2_COLLISION_GROUNDWORK_CONFIG,
  );
  if (
    !solidResult.collided ||
    solidActor.position.x > 176 ||
    solidActor.velocity.x !== 0
  ) {
    throw new Error("Diagnostic solid must block and stop inward velocity.");
  }

  const gapActor = createActorState({
    id: "gap-actor",
    kind: "diagnostic",
    position: { x: 350, y: 150 },
    lastSafePosition: { x: 100, y: 100 },
    radius: 24,
  });
  const fallResult = applyWorldCollision(
    gapActor,
    geometry,
    34,
    68,
    V2_COLLISION_GROUNDWORK_CONFIG,
  );
  if (
    !fallResult.fell ||
    gapActor.lifeState !== "falling" ||
    fallResult.events[0]?.type !== "actor.fell"
  ) {
    throw new Error("Grounded actor inside a gap must start falling.");
  }

  let respawned = false;
  for (let frame = 0; frame < 13; frame++) {
    respawned = applyWorldCollision(
      gapActor,
      geometry,
      34,
      102 + frame * 34,
      V2_COLLISION_GROUNDWORK_CONFIG,
    ).respawned || respawned;
  }
  if (
    !respawned ||
    !isActorActive(gapActor) ||
    gapActor.position.x !== 100 ||
    gapActor.position.y !== 100
  ) {
    throw new Error("Falling actor must respawn at its last safe position.");
  }

  const jumpingActor = createActorState({
    id: "jumping-gap-actor",
    kind: "diagnostic",
    position: { x: 350, y: 150 },
    radius: 24,
    jump: {
      active: true,
      held: true,
      grounded: false,
      phase: "held",
      elapsedMs: 100,
      plannedDurationMs: 400,
      cooldownRemainingMs: 440,
      height: V2_COLLISION_GROUNDWORK_CONFIG.gapClearHeight + 1,
    },
  });
  const crossingResult = applyWorldCollision(
    jumpingActor,
    geometry,
    34,
    600,
    V2_COLLISION_GROUNDWORK_CONFIG,
  );
  if (crossingResult.fell || jumpingActor.lifeState !== "active") {
    throw new Error("Actor above gap clearance height must not fall.");
  }
}

function isActorActive(actor: ActorState): boolean {
  return actor.lifeState === "active";
}

function checkActorLifecycle(): void {
  const runtime = new GameplayCoreRuntime();
  const initial = runtime.initialize().snapshot.actors[0];
  if (!initial) {
    throw new Error("Lifecycle smoke check requires a diagnostic actor.");
  }

  const firstHit = runtime.advance(diagnosticDamageFrame(1, 34));
  const firstActor = firstHit.snapshot.actors[0];
  if (
    !firstActor ||
    firstActor.armor !== 0 ||
    firstActor.health !== 65 ||
    firstHit.events[0]?.type !== "actor.damaged"
  ) {
    throw new Error("Diagnostic damage must consume armor before health.");
  }

  runtime.advance(diagnosticDamageFrame(2, 68));
  const death = runtime.advance(diagnosticDamageFrame(3, 102));
  const deadActor = death.snapshot.actors[0];
  if (
    !deadActor ||
    deadActor.lifeState !== "dead" ||
    deadActor.health !== 0 ||
    deadActor.respawn?.reason !== "death" ||
    !death.events.some((event) => event.type === "actor.died")
  ) {
    throw new Error("Actor must enter dead state and emit actor.died.");
  }

  const deadPosition = { ...deadActor.position };
  const blockedMovement = runtime.advance({
    sequence: 4,
    timeMs: 136,
    deltaMs: 34,
    actions: [{
      action: "move",
      phase: "held",
      direction: { x: 1, y: 0 },
      magnitude: 1,
    }],
  });
  const blockedActor = blockedMovement.snapshot.actors[0];
  if (
    !blockedActor ||
    blockedActor.position.x !== deadPosition.x ||
    blockedActor.position.y !== deadPosition.y ||
    blockedActor.velocity.x !== 0 ||
    blockedActor.velocity.y !== 0
  ) {
    throw new Error("Dead actors must ignore movement input.");
  }

  let respawnEvent = false;
  let respawnedActor = blockedActor;
  for (let frame = 0; frame < 26; frame++) {
    const sequence = 5 + frame;
    const result = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: [],
    });
    respawnedActor = result.snapshot.actors[0] ?? respawnedActor;
    respawnEvent = result.events.some((event) =>
      event.type === "actor.respawned"
    ) || respawnEvent;
  }
  if (
    !respawnEvent ||
    respawnedActor.lifeState !== "active" ||
    respawnedActor.health !== respawnedActor.maxHealth ||
    respawnedActor.armor !== 0 ||
    respawnedActor.position.x !== respawnedActor.spawnPosition.x ||
    respawnedActor.position.y !== respawnedActor.spawnPosition.y
  ) {
    throw new Error("Dead actor must respawn healthy at the map spawn.");
  }
}

function diagnosticDamageFrame(
  sequence: number,
  timeMs: number,
): Parameters<GameplayCoreRuntime["advance"]>[0] {
  return {
    sequence,
    timeMs,
    deltaMs: 34,
    actions: [{
      action: "debugDamage",
      phase: "pressed",
      payload: { amount: 35 },
    }],
  };
}

function checkProjectilePipeline(): void {
  const runtime = new GameplayCoreRuntime({
    createWorld: () => {
      const world = createDiagnosticWorldState();
      const owner = world.actors.find((actor) =>
        actor.id === "diagnostic-actor-1"
      );
      const target = world.actors.find((actor) =>
        actor.id === "diagnostic-target-1"
      );
      if (owner && target) {
        target.position = { x: owner.position.x - 100, y: owner.position.y };
        target.spawnPosition = { ...target.position };
      }
      return world;
    },
  });
  const initial = runtime.initialize();
  const targetBefore = initial.snapshot.actors.find((actor) =>
    actor.id === "diagnostic-target-1"
  );
  if (!targetBefore || targetBefore.armor !== 20 || targetBefore.health !== 100) {
    throw new Error("Projectile smoke check requires the target dummy.");
  }

  const fired = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [
      {
        action: "aim",
        phase: "held",
        direction: { x: -1, y: 0 },
      },
      { action: "firePrimary", phase: "held" },
    ],
  });
  if (
    fired.snapshot.projectiles.length !== 1 ||
    !fired.events.some((event) => event.type === "projectile.spawned")
  ) {
    throw new Error("Primary fire must spawn one diagnostic projectile.");
  }

  let hit = false;
  let damaged = false;
  let targetAfter = targetBefore;
  for (let frame = 0; frame < 8; frame++) {
    const sequence = frame + 2;
    const result = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: [],
    });
    hit = result.events.some((event) => event.type === "projectile.hit") || hit;
    damaged = result.events.some((event) => event.type === "actor.damaged") ||
      damaged;
    targetAfter = result.snapshot.actors.find((actor) =>
      actor.id === "diagnostic-target-1"
    ) ?? targetAfter;
    if (hit) {
      if (result.snapshot.projectiles.length !== 0) {
        throw new Error("Projectile must be removed after actor hit.");
      }
      break;
    }
  }
  if (
    !hit ||
    !damaged ||
    targetAfter.armor !== 0 ||
    targetAfter.health !== 90
  ) {
    throw new Error("Projectile hit must damage target through lifecycle.");
  }

  const expiryRuntime = new GameplayCoreRuntime();
  expiryRuntime.initialize();
  expiryRuntime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [
      {
        action: "aim",
        phase: "held",
        direction: { x: -1, y: 0 },
      },
      { action: "firePrimary", phase: "held" },
    ],
  });
  let expired = false;
  for (let frame = 0; frame < 12; frame++) {
    const sequence = frame + 2;
    const result = expiryRuntime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: [],
    });
    expired = result.events.some((event) =>
      event.type === "projectile.expired"
    ) || expired;
    if (expired) {
      if (result.snapshot.projectiles.length !== 0) {
        throw new Error("Expired projectile must be removed.");
      }
      break;
    }
  }
  if (!expired) {
    throw new Error("Projectile must expire at bounds, range, or lifetime.");
  }
}

function checkPickupPipeline(): void {
  const actor = createActorState({
    id: "pickup-actor",
    kind: "diagnostic",
    position: { x: 100, y: 100 },
    radius: 24,
    health: 80,
    maxHealth: 100,
    armor: 10,
    maxArmor: 25,
  });
  const health = createPickupState(
    {
      id: "health-smoke",
      type: "health",
      position: { x: 100, y: 100 },
      value: 30,
      respawnDelayMs: 100,
    },
    V2_DIAGNOSTIC_PICKUP_CONFIG,
  );
  const armor = createPickupState(
    {
      id: "armor-smoke",
      type: "armor",
      position: { x: 100, y: 100 },
      value: 20,
      respawnDelayMs: 100,
    },
    V2_DIAGNOSTIC_PICKUP_CONFIG,
  );

  const collected = updatePickups(
    [health, armor],
    [actor],
    34,
    34,
  );
  if (
    actor.health !== 100 ||
    actor.armor !== 25 ||
    health.lifeState !== "inactive" ||
    armor.lifeState !== "inactive" ||
    collected.events.filter((event) =>
        event.type === "pickup.collected"
      ).length !== 2
  ) {
    throw new Error("Health and armor pickups must apply capped resources.");
  }

  const respawned = updatePickups(
    [health, armor],
    [],
    100,
    134,
  );
  if (
    !isPickupActive(health) ||
    !isPickupActive(armor) ||
    respawned.events.filter((event) =>
        event.type === "pickup.respawned"
      ).length !== 2
  ) {
    throw new Error("Inactive pickups must respawn after their delay.");
  }

  const fullActorResult = updatePickups(
    [health, armor],
    [actor],
    34,
    168,
  );
  if (
    fullActorResult.events.length !== 0 ||
    !isPickupActive(health) ||
    !isPickupActive(armor)
  ) {
    throw new Error("Full resources must not consume diagnostic pickups.");
  }
}

function isPickupActive(pickup: PickupState): boolean {
  return pickup.lifeState === "active";
}

function checkMatchLifecycle(): void {
  const runtime = new GameplayCoreRuntime();
  const initial = runtime.initialize();
  if (
    initial.snapshot.match?.phase !== "running" ||
    initial.snapshot.match.remainingMs !== 15_000 ||
    initial.snapshot.scoreBoard.entries.length !== 2 ||
    initial.events[0]?.type !== "match.started"
  ) {
    throw new Error("Diagnostic mode must initialize match and score state.");
  }

  const scored = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [{ action: "debugScore", phase: "pressed" }],
  });
  const playerScore = scored.snapshot.scoreBoard.entries.find((entry) =>
    entry.id === "blue"
  )?.score;
  if (
    playerScore !== 1 ||
    !scored.events.some((event) => event.type === "score.awarded")
  ) {
    throw new Error("Diagnostic score trigger must award event-based score.");
  }

  const ended = runtime.advance({
    sequence: 2,
    timeMs: 68,
    deltaMs: 34,
    actions: [],
  });
  let timedEnd = ended;
  for (let sequence = 3; sequence <= 152; sequence++) {
    timedEnd = runtime.advance({
      sequence,
      timeMs: sequence * 100,
      deltaMs: 100,
      actions: [],
    });
    if (timedEnd.snapshot.match?.phase === "ended") break;
  }
  if (
    timedEnd.snapshot.match?.phase !== "ended" ||
    timedEnd.snapshot.match.remainingMs !== 0 ||
    timedEnd.snapshot.match.result?.kind !== "winner" ||
    timedEnd.snapshot.match.result.winnerEntryId !== "blue" ||
    !timedEnd.events.some((event) => event.type === "match.ended")
  ) {
    throw new Error("Diagnostic match must end by timer with a result.");
  }

  const rejectedScore = runtime.advance({
    sequence: 153,
    timeMs: 15_300,
    deltaMs: 34,
    actions: [
      { action: "debugScore", phase: "pressed" },
      {
        action: "move",
        phase: "held",
        direction: { x: 1, y: 0 },
        magnitude: 1,
      },
      {
        action: "aim",
        phase: "held",
        direction: { x: 1, y: 0 },
      },
      { action: "firePrimary", phase: "held" },
    ],
  });
  if (
    rejectedScore.events.length !== 0 ||
    rejectedScore.events.some((event) => event.type === "score.awarded") ||
    rejectedScore.snapshot.scoreBoard.entries.find((entry) =>
        entry.id === "blue"
      )?.score !== 1 ||
    rejectedScore.snapshot.timeMs !== timedEnd.snapshot.timeMs ||
    rejectedScore.snapshot.projectiles.length !==
      timedEnd.snapshot.projectiles.length ||
    rejectedScore.snapshot.actors[0]?.position.x !==
      timedEnd.snapshot.actors[0]?.position.x ||
    rejectedScore.snapshot.actors[0]?.position.y !==
      timedEnd.snapshot.actors[0]?.position.y
  ) {
    throw new Error("Ended matches must freeze gameplay simulation.");
  }

  const drawRuntime = new GameplayCoreRuntime();
  drawRuntime.initialize();
  let draw = drawRuntime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [],
  });
  for (let sequence = 2; sequence <= 151; sequence++) {
    draw = drawRuntime.advance({
      sequence,
      timeMs: sequence * 100,
      deltaMs: 100,
      actions: [],
    });
    if (draw.snapshot.match?.phase === "ended") break;
  }
  if (draw.snapshot.match?.result?.kind !== "draw") {
    throw new Error("Tied diagnostic score boards must end in a draw.");
  }
}

function checkScoreSafety(): void {
  const scoreBoard = createScoreBoardState([
    { id: "blue", teamId: "blue", score: 0 },
  ]);
  if (
    awardScore(scoreBoard, "missing", 1, "unknown-entry").awarded ||
    awardScore(scoreBoard, "blue", -1, "negative-score").awarded ||
    awardScore(scoreBoard, "blue", Number.NaN, "invalid-score").awarded
  ) {
    throw new Error("Invalid score targets and amounts must be rejected.");
  }

  const firstAward = awardScore(scoreBoard, "blue", 1, "award-1");
  const duplicateAward = awardScore(scoreBoard, "blue", 1, "award-1");
  if (
    !firstAward.awarded ||
    duplicateAward.awarded ||
    duplicateAward.rejectionReason !== "duplicate" ||
    scoreBoard.entries[0]?.score !== 1
  ) {
    throw new Error("Score award keys must be idempotent.");
  }

  const mode = new DiagnosticArenaMode();
  const world = createEmptyWorldState();
  const attacker = createActorState({
    id: "blue-player",
    kind: "diagnostic",
    teamId: "blue",
  });
  const victim = createActorState({
    id: "red-target",
    kind: "diagnostic-target",
    teamId: "red",
    lifeState: "dead",
  });
  world.actors.push(attacker, victim);
  mode.initialize(world);

  const firstDeath = {
    id: "death-red-1",
    type: "actor.died",
    timeMs: 100,
    sourceActorId: attacker.id,
    targetActorId: victim.id,
    teamId: victim.teamId ?? undefined,
    payload: {
      victimActorId: victim.id,
      victimLifeId: victim.lifeId,
    },
  };
  const firstEvents = mode.handleEvent(firstDeath, world);
  const duplicateEvents = mode.handleEvent(firstDeath, world);
  if (
    firstEvents[0]?.type !== "score.awarded" ||
    duplicateEvents.length !== 0 ||
    world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !== 1
  ) {
    throw new Error("One actor life must award kill score exactly once.");
  }

  victim.lifeId += 1;
  const secondDeath = {
    ...firstDeath,
    id: "death-red-2",
    timeMs: 200,
    payload: {
      victimActorId: victim.id,
      victimLifeId: victim.lifeId,
    },
  };
  mode.handleEvent(secondDeath, world);
  if (
    world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !== 2
  ) {
    throw new Error("A respawned actor life must be scoreable once again.");
  }

  mode.update(world, 15_000);
  victim.lifeId += 1;
  mode.handleEvent({
    ...secondDeath,
    id: "death-red-after-end",
    timeMs: 15_001,
    payload: {
      victimActorId: victim.id,
      victimLifeId: victim.lifeId,
    },
  }, world);
  if (
    world.scoreBoard.entries.find((entry) => entry.id === "blue")?.score !== 2
  ) {
    throw new Error("Ended matches must reject kill score.");
  }
}

function checkTeamDeathmatchSlice(): void {
  const productionWorld = createTeamDeathmatchWorldState();
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode({
      durationMs: 120_000,
      scoreLimit: 3,
      initialScores: [
        { id: "blue", teamId: "blue", score: 0 },
        { id: "red", teamId: "red", score: 0 },
      ],
    }),
    createWorld: createCloseRangeTeamDeathmatchWorld,
  });
  const initial = runtime.initialize();
  if (
    initial.snapshot.modeId !== "team-deathmatch" ||
    initial.snapshot.objectives.length !== 0 ||
    initial.snapshot.actors.length !== 2 ||
    initial.snapshot.actors.some((actor) => actor.kind !== "player") ||
    initial.snapshot.pickups.length !== productionWorld.pickups.length ||
    initial.hudState.notices[0] !== "First to 3"
  ) {
    throw new Error("TDM must initialize players and V1 parity pickups.");
  }
  const initialBlue = productionWorld.actors.find((actor) =>
    actor.id === "blue-player"
  );
  const initialRed = productionWorld.actors.find((actor) =>
    actor.id === "red-player"
  );
  if (
    initialBlue?.spawnPosition.x !== 1350 ||
    initialRed?.spawnPosition.x !== 150 ||
    productionWorld.pickups.some((pickup) =>
      pickup.radius !== 22 ||
      pickup.respawnDelayMs !== 20_000 ||
      pickup.value !== pickupParityValue(pickup.type)
    )
  ) {
    throw new Error("Training Crossing TDM content must mirror V1 placement.");
  }

  const moved = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [
      {
        action: "move",
        phase: "held",
        actorId: "blue-player",
        direction: { x: 0, y: -1 },
        magnitude: 1,
      },
      {
        action: "move",
        phase: "held",
        actorId: "red-player",
        direction: { x: 0, y: 1 },
        magnitude: 1,
      },
    ],
  });
  const blueMoved = moved.snapshot.actors.find((actor) =>
    actor.id === "blue-player"
  );
  const redMoved = moved.snapshot.actors.find((actor) =>
    actor.id === "red-player"
  );
  if (
    !blueMoved ||
    !redMoved ||
    blueMoved.position.y >= initial.snapshot.actors[0]!.position.y ||
    redMoved.position.y <= initial.snapshot.actors[1]!.position.y
  ) {
    throw new Error("TDM inputs must control both actors independently.");
  }

  let sequence = 1;
  for (let kill = 0; kill < 3; kill++) {
    sequence = killActorWithProjectiles(
      runtime,
      "blue-player",
      "red-player",
      sequence,
    );
    const score = runtime.snapshot.scoreBoard.entries.find((entry) =>
      entry.id === "blue"
    )?.score;
    if (score !== kill + 1) {
      throw new Error("Each TDM kill must award blue exactly one point.");
    }
    if (kill < 2) {
      for (let wait = 0; wait < 27; wait++) {
        sequence++;
        runtime.advance({
          sequence,
          timeMs: sequence * 34,
          deltaMs: 34,
          actions: [],
        });
      }
      const red = runtime.snapshot.actors.find((actor) =>
        actor.id === "red-player"
      );
      if (red?.lifeState !== "active" || red.lifeId !== kill + 2) {
        throw new Error("TDM target must respawn with a new life id.");
      }
    }
  }
  if (
    runtime.snapshot.match?.phase !== "ended" ||
    runtime.snapshot.match.result?.kind !== "winner" ||
    runtime.snapshot.match.result.winnerEntryId !== "blue"
  ) {
    throw new Error("TDM score limit must end the match for blue.");
  }

  const frozenTime = runtime.snapshot.timeMs;
  const restarted = runtime.advance({
    sequence: sequence + 1,
    timeMs: frozenTime + 34,
    deltaMs: 34,
    actions: [{ action: "restartMatch", phase: "pressed" }],
  });
  if (
    restarted.snapshot.match?.phase !== "running" ||
    restarted.snapshot.timeMs !== 0 ||
    restarted.snapshot.scoreBoard.entries.some((entry) => entry.score !== 0) ||
    restarted.snapshot.actors.some((actor) =>
      actor.lifeState !== "active" || actor.lifeId !== 1
    )
  ) {
    throw new Error("TDM restart must create a clean running match.");
  }

  const timedMode = new TeamDeathmatchMode({
    durationMs: 100,
    scoreLimit: 3,
    initialScores: [
      { id: "blue", teamId: "blue", score: 0 },
      { id: "red", teamId: "red", score: 0 },
    ],
  });
  const timedRuntime = new GameplayCoreRuntime({
    mode: timedMode,
    createWorld: createTeamDeathmatchWorldState,
  });
  timedRuntime.initialize();
  const timedEnd = timedRuntime.advance({
    sequence: 1,
    timeMs: 100,
    deltaMs: 100,
    actions: [],
  });
  if (
    timedEnd.snapshot.match?.phase !== "ended" ||
    timedEnd.snapshot.match.result?.kind !== "draw"
  ) {
    throw new Error("TDM time limit must end tied matches as a draw.");
  }
  const parityPlayers = timedRuntime.snapshot.actors.filter((actor) =>
    actor.kind === "player"
  );
  if (
    parityPlayers.some((actor) =>
      actor.radius !== 16 ||
      actor.maxHealth !== 100 ||
      actor.maxArmor !== 100
    )
  ) {
    throw new Error("TDM players must retain V1 actor size and resource caps.");
  }
}

function pickupParityValue(type: PickupState["type"]): number {
  if (type === "health") return V2_ARENA_PICKUP_PARITY_CONFIG.healthValue;
  if (type === "armor") return V2_ARENA_PICKUP_PARITY_CONFIG.armorValue;
  if (type === "rocket") return V2_ARENA_PICKUP_PARITY_CONFIG.rocketValue;
  if (type === "rail") return V2_ARENA_PICKUP_PARITY_CONFIG.railValue;
  return V2_ARENA_PICKUP_PARITY_CONFIG.whipValue;
}

function createCloseRangeTeamDeathmatchWorld() {
  const world = createTeamDeathmatchWorldState();
  const blue = world.actors.find((actor) => actor.id === "blue-player");
  const red = world.actors.find((actor) => actor.id === "red-player");
  if (!blue || !red) {
    throw new Error("TDM smoke world requires both players.");
  }
  blue.position = { x: 180, y: 410 };
  blue.spawnPosition = { ...blue.position };
  blue.lastSafePosition = { ...blue.position };
  red.position = { x: 360, y: 410 };
  red.spawnPosition = { ...red.position };
  red.lastSafePosition = { ...red.position };
  return world;
}

function killActorWithProjectiles(
  runtime: GameplayCoreRuntime,
  attackerId: string,
  victimId: string,
  initialSequence: number,
): number {
  let sequence = initialSequence;
  for (let shot = 0; shot < 4; shot++) {
    const attacker = runtime.snapshot.actors.find((actor) =>
      actor.id === attackerId
    );
    const victim = runtime.snapshot.actors.find((actor) =>
      actor.id === victimId
    );
    if (!attacker || !victim) {
      throw new Error("TDM projectile test requires both players.");
    }
    const dx = victim.position.x - attacker.position.x;
    const dy = victim.position.y - attacker.position.y;
    const length = Math.hypot(dx, dy);
    sequence++;
    runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: [
        {
          action: "aim",
          phase: "held",
          actorId: attackerId,
          direction: { x: dx / length, y: dy / length },
        },
        { action: "firePrimary", phase: "held", actorId: attackerId },
      ],
    });
    for (let frame = 0; frame < 8; frame++) {
      sequence++;
      runtime.advance({
        sequence,
        timeMs: sequence * 34,
        deltaMs: 34,
        actions: [],
      });
    }
  }
  return sequence;
}

function checkBasicAutoShootParity(): void {
  const createWorld = () => {
    const world = createEmptyWorldState("team-deathmatch");
    world.geometry = {
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 600,
        maxY: 400,
      },
      solids: [],
      gaps: [],
    };
    world.actors.push(
      createActorState({
        id: "blue-player",
        kind: "player",
        teamId: "blue",
        position: { x: 100, y: 200 },
        spawnPosition: { x: 100, y: 200 },
        radius: 16,
        maxHealth: 100,
        armor: 0,
        maxArmor: 100,
      }),
      createActorState({
        id: "red-player",
        kind: "player",
        teamId: "red",
        position: { x: 300, y: 200 },
        spawnPosition: { x: 300, y: 200 },
        radius: 16,
        maxHealth: 100,
        armor: 0,
        maxArmor: 100,
      }),
    );
    return world;
  };
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld,
    basicAutoAttack: V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  let result = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: [],
  });
  if (
    result.snapshot.projectiles.length !== 2 ||
    result.snapshot.projectiles.some((projectile) =>
      projectile.damage !== 18 ||
      projectile.radius !== 9 ||
      Math.hypot(projectile.velocity.x, projectile.velocity.y) !== 286
    )
  ) {
    throw new Error("V1 basic autoshoot must fire parity bullets for both teams.");
  }
  for (let sequence = 2; sequence <= 24; sequence++) {
    result = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: [],
    });
  }
  if (result.snapshot.actors.some((actor) => actor.health !== 82)) {
    throw new Error("V1 basic autoshoot bullets must apply exactly 18 damage.");
  }
  if (result.snapshot.projectiles.length !== 0) {
    throw new Error("Basic autoshoot projectiles must be removed after impact.");
  }
}

function checkTdmBotController(): void {
  checkBotDecisionAndMovementConfig();
  checkTdmBotCombatDecision();
  checkTdmBotSpecialWeapons();
  checkGridBotNavigator();
  checkBotJumpUsesCoreSystem();
  checkTdmBotNavigation(createTeamDeathmatchWorldState, "Training Crossing");
  checkTdmBotNavigation(
    () => createTeamDeathmatchWorldState(GRAND_ARCHIVE_V2),
    "Grand Archive",
  );
  checkTdmBotNavigation(
    () => createTeamDeathmatchWorldState(FLANK_SWITCH_V2),
    "Flank Switch",
  );
}

function checkTdmBotCombatDecision(): void {
  const world = createWeaponTestWorld(200);
  const bot = world.actors[0]!;
  const target = world.actors[1]!;
  const combat = new TdmBotCombatController();
  bot.weapons.whipAmmo = 1;
  bot.weapons.rocketAmmo = 1;
  bot.weapons.railAmmo = 1;
  let action = combat.readAction(
    bot,
    target,
    createWorldSnapshot(world),
    34,
  );
  if (weaponIdFromAction(action) !== "whip") {
    throw new Error("TDM bot combat must prefer Whip in melee range.");
  }

  target.position.x = 400;
  bot.weapons.whipAmmo = 0;
  bot.weapons.railAmmo = 0;
  action = combat.readAction(bot, target, createWorldSnapshot(world), 34);
  if (weaponIdFromAction(action) !== "rocket") {
    throw new Error("TDM bot combat must use Rocket at medium range.");
  }
  if (
    combat.readAction(bot, target, createWorldSnapshot(world), 34) !== null
  ) {
    throw new Error("TDM bot Rocket decisions must honor the V1 fire cadence.");
  }

  combat.reset();
  target.position.x = 800;
  bot.weapons.railAmmo = 1;
  action = combat.readAction(bot, target, createWorldSnapshot(world), 34);
  if (weaponIdFromAction(action) !== "rail") {
    throw new Error("TDM bot combat must prefer Rail at long range.");
  }

  bot.weapons.rocketAmmo = 0;
  bot.weapons.railCooldownMs = 100;
  if (combat.readAction(bot, target, createWorldSnapshot(world), 34) !== null) {
    throw new Error("TDM bot combat must honor Rail ammo and cooldown state.");
  }
  bot.weapons.railCooldownMs = 0;
  world.geometry = {
    ...world.geometry,
    solids: [{
      id: "combat-line-of-sight-wall",
      x: 430,
      y: 60,
      width: 40,
      height: 80,
    }],
  };
  if (combat.readAction(bot, target, createWorldSnapshot(world), 34) !== null) {
    throw new Error("TDM bot combat must not fire through solid walls.");
  }
}

function checkTdmBotSpecialWeapons(): void {
  checkTdmBotWhipRuntime();
  checkTdmBotRailRuntime();
  checkTdmBotRocketRuntime();
}

function checkTdmBotWhipRuntime(): void {
  const runtime = createBotWeaponRuntime("whip", 100);
  const controller = createStationaryBotController();
  const frame = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: controller.readActions(runtime.snapshot, 34),
  });
  const red = actorById(frame.snapshot.actors, "red-player");
  const blue = actorById(frame.snapshot.actors, "blue-player");
  if (
    red.weapons.whipAmmo !== 0 ||
    red.weapons.whipCooldownMs !== 800 ||
    blue.health !== 65 ||
    !frame.events.some((event) =>
      event.type === "weapon.whipFired" &&
      event.sourceActorId === "red-player"
    )
  ) {
    throw new Error(
      "TDM bot Whip actions must apply hit, ammo, and cooldown rules.",
    );
  }
}

function checkTdmBotRailRuntime(): void {
  const runtime = createBotWeaponRuntime("rail", 600);
  const controller = createStationaryBotController();
  let frame = runtime.advance({
    sequence: 1,
    timeMs: 34,
    deltaMs: 34,
    actions: controller.readActions(runtime.snapshot, 34),
  });
  let red = actorById(frame.snapshot.actors, "red-player");
  const blue = actorById(frame.snapshot.actors, "blue-player");
  if (
    red.weapons.railAmmo !== 0 ||
    red.weapons.railCooldownMs !== 2500 ||
    blue.health !== 5 ||
    !frame.events.some((event) =>
      event.type === "weapon.railFired" &&
      event.sourceActorId === "red-player"
    )
  ) {
    throw new Error(
      "TDM bot Rail actions must apply hit, ammo, and cooldown rules.",
    );
  }
  frame = runtime.advance({
    sequence: 2,
    timeMs: 68,
    deltaMs: 34,
    actions: controller.readActions(runtime.snapshot, 34),
  });
  red = actorById(frame.snapshot.actors, "red-player");
  if (
    red.weapons.railAmmo !== 0 ||
    frame.events.some((event) => event.type === "weapon.railFired")
  ) {
    throw new Error("TDM bot Rail cooldown must reject repeated fire.");
  }
}

function checkTdmBotRocketRuntime(): void {
  const runtime = createBotWeaponRuntime("rocket", 300);
  const controller = createStationaryBotController();
  let fired = false;
  let damaged = false;
  for (let sequence = 1; sequence <= 80; sequence++) {
    const frame = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
    fired ||= frame.events.some((event) =>
      event.type === "weapon.rocketFired" &&
      event.sourceActorId === "red-player"
    );
    damaged ||= frame.events.some((event) =>
      event.type === "actor.damaged" &&
      event.sourceActorId === "red-player" &&
      event.targetActorId === "blue-player"
    );
    if (damaged) break;
  }
  const red = actorById(runtime.snapshot.actors, "red-player");
  const blue = actorById(runtime.snapshot.actors, "blue-player");
  if (
    !fired ||
    !damaged ||
    red.weapons.rocketAmmo !== 0 ||
    blue.health >= blue.maxHealth ||
    blue.velocity.x <= 0
  ) {
    throw new Error(
      "TDM bot Rocket actions must consume ammo and apply splash impact.",
    );
  }
}

function createBotWeaponRuntime(
  weaponId: "rocket" | "rail" | "whip",
  distance: number,
): GameplayCoreRuntime {
  const createWorld = () => {
    const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
    world.geometry = {
      bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 400 },
      solids: [],
      gaps: [],
    };
    const red = world.actors.find((actor) => actor.id === "red-player")!;
    const blue = world.actors.find((actor) => actor.id === "blue-player")!;
    red.position = { x: 100, y: 200 };
    red.spawnPosition = { ...red.position };
    red.lastSafePosition = { ...red.position };
    blue.position = { x: 100 + distance, y: 200 };
    blue.spawnPosition = { ...blue.position };
    blue.lastSafePosition = { ...blue.position };
    if (weaponId === "rocket") red.weapons.rocketAmmo = 1;
    if (weaponId === "rail") red.weapons.railAmmo = 1;
    if (weaponId === "whip") red.weapons.whipAmmo = 1;
    return world;
  };
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld,
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  return runtime;
}

function createStationaryBotController(): TdmBotController {
  return new TdmBotController(
    "red-player",
    "blue-player",
    { inputMagnitude: 0 },
    {
      navigate: () => ({
        direction: { x: 0, y: 0 },
        jump: false,
      }),
      reset: () => {},
    },
  );
}

function createOneFlagBotRuntime(
  map: WorldMapData,
  configureWorld?: (world: ReturnType<typeof createOneFlagWorldState>) => void,
): GameplayCoreRuntime {
  const createWorld = () => {
    const world = createOneFlagWorldState(map);
    for (const actor of world.actors) {
      zeroWeapons(actor);
    }
    configureWorld?.(world);
    return world;
  };
  const runtime = new GameplayCoreRuntime({
    mode: new OneFlagMode(map),
    createWorld,
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  return runtime;
}

function zeroWeapons(actor: ActorState): void {
  actor.weapons.rocketAmmo = 0;
  actor.weapons.railAmmo = 0;
  actor.weapons.whipAmmo = 0;
  actor.weapons.railCooldownMs = 0;
  actor.weapons.whipCooldownMs = 0;
}

function distanceBetweenPositions(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function actorById(
  actors: readonly Readonly<ActorState>[],
  actorId: string,
): Readonly<ActorState> {
  const actor = actors.find((candidate) => candidate.id === actorId);
  if (!actor) {
    throw new Error(`Missing smoke actor: ${actorId}`);
  }
  return actor;
}

function weaponIdFromAction(
  action: CoreActionIntent | null,
): unknown {
  return action?.payload && typeof action.payload === "object" &&
      "weaponId" in action.payload
    ? action.payload.weaponId
    : null;
}

function checkBotDecisionAndMovementConfig(): void {
  const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
  const mode = new TeamDeathmatchMode();
  mode.initialize(world);
  const controller = new TdmBotController(
    "red-player",
    "blue-player",
    { inputMagnitude: .5 },
    {
      navigate: () => ({
        direction: { x: 0, y: 1 },
        jump: false,
      }),
      reset: () => {},
    },
  );
  const actions = controller.readActions(createWorldSnapshot(world), 34);
  const move = actions.find((action) => action.action === "move");
  const aim = actions.find((action) => action.action === "aim");
  if (
    move?.magnitude !== .5 ||
    move.direction?.x !== 0 ||
    move.direction.y !== 1 ||
    aim?.direction?.x !== 1 ||
    aim.direction.y !== 0
  ) {
    throw new Error(
      "TDM bot decisions must delegate navigation and honor movement config.",
    );
  }
}

function checkGridBotNavigator(): void {
  const world = createEmptyWorldState("bot-navigation-smoke");
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 400, maxY: 400 },
    solids: [{
      id: "navigation-wall",
      x: 160,
      y: 80,
      width: 80,
      height: 240,
    }],
    gaps: [],
  };
  const navigator = new GridBotNavigator({
    cellSize: 40,
    repathIntervalMs: 420,
    waypointReachDistance: 24,
    obstaclePadding: 18,
  });
  const decision = navigator.navigate(
    { x: 80, y: 200 },
    { x: 320, y: 200 },
    "target:1",
    createWorldSnapshot(world),
    34,
  );
  if (
    decision.direction.x <= 0 ||
    Math.abs(decision.direction.y) < .1 ||
    Math.abs(
      Math.hypot(decision.direction.x, decision.direction.y) - 1,
    ) > .001
  ) {
    throw new Error(
      "Grid bot navigation must independently route around blockers.",
    );
  }
  navigator.reset();
  const direct = navigator.navigate(
    { x: 60, y: 60 },
    { x: 340, y: 60 },
    "target:2",
    createWorldSnapshot(world),
    34,
  );
  if (direct.direction.x <= 0 || Math.abs(direct.direction.y) > .1) {
    throw new Error("Grid bot navigation reset must allow a fresh direct path.");
  }
}

function checkBotJumpUsesCoreSystem(): void {
  const createWorld = () => {
    const world = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
    const red = world.actors.find((actor) => actor.id === "red-player")!;
    const blue = world.actors.find((actor) => actor.id === "blue-player")!;
    world.geometry = {
      bounds: { minX: 0, minY: 100, maxX: 400, maxY: 300 },
      solids: [],
      gaps: [{
        id: "jump-gap",
        x: 170,
        y: 100,
        width: 60,
        height: 200,
      }],
    };
    world.navigation = {
      jumpLinks: [{
        id: "jump-gap-west-east",
        from: { x: 140, y: 200 },
        to: { x: 260, y: 200 },
        activationRadius: 44,
      }],
    };
    red.position = { x: 80, y: 200 };
    red.spawnPosition = { ...red.position };
    red.lastSafePosition = { ...red.position };
    blue.position = { x: 320, y: 200 };
    blue.spawnPosition = { ...blue.position };
    blue.lastSafePosition = { ...blue.position };
    return world;
  };
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld,
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  const controller = new TdmBotController("red-player", "blue-player");
  let jumped = false;
  let fell = false;
  for (let sequence = 1; sequence <= 180; sequence++) {
    const frame = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions: controller.readActions(runtime.snapshot, 34),
    });
    jumped ||= frame.events.some((event) =>
      event.type === "actor.jumped" &&
      event.sourceActorId === "red-player"
    );
    const red = frame.snapshot.actors.find((actor) =>
      actor.id === "red-player"
    );
    fell ||= red?.lifeState === "falling";
    if ((red?.position.x ?? 0) >= 260) break;
  }
  const red = runtime.snapshot.actors.find((actor) =>
    actor.id === "red-player"
  );
  if (!jumped || fell || (red?.position.x ?? 0) < 260) {
    throw new Error(
      "Bot jump links must cross gaps through normal core jump actions.",
    );
  }
}

function checkTdmBotNavigation(
  createWorld: () => ReturnType<typeof createTeamDeathmatchWorldState>,
  mapName: string,
): void {
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld,
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  const controller = new TdmBotController("red-player", "blue-player");
  const initialRed = runtime.snapshot.actors.find((actor) =>
    actor.id === "red-player"
  );
  const initialBlue = runtime.snapshot.actors.find((actor) =>
    actor.id === "blue-player"
  );
  if (!initialRed || !initialBlue) {
    throw new Error("TDM bot smoke check requires both players.");
  }
  const initialDistance = Math.hypot(
    initialBlue.position.x - initialRed.position.x,
    initialBlue.position.y - initialRed.position.y,
  );
  let fell = false;
  for (let sequence = 1; sequence <= 600; sequence++) {
    const actions = controller.readActions(runtime.snapshot, 34);
    const frame = runtime.advance({
      sequence,
      timeMs: sequence * 34,
      deltaMs: 34,
      actions,
    });
    const red = frame.snapshot.actors.find((actor) =>
      actor.id === "red-player"
    );
    fell ||= red?.lifeState === "falling";
  }
  const finalRed = runtime.snapshot.actors.find((actor) =>
    actor.id === "red-player"
  );
  const finalBlue = runtime.snapshot.actors.find((actor) =>
    actor.id === "blue-player"
  );
  if (!finalRed || !finalBlue) {
    throw new Error("TDM bot actors must remain available.");
  }
  const finalDistance = Math.hypot(
    finalBlue.position.x - finalRed.position.x,
    finalBlue.position.y - finalRed.position.y,
  );
  if (finalDistance >= initialDistance - 500) {
    throw new Error(
      `${mapName} TDM bot navigation must close significant distance.`,
    );
  }
  if (fell) {
    throw new Error(
      `${mapName} TDM bot navigation must avoid authored gap zones.`,
    );
  }
}

export function checkV1WeaponParity(): void {
  checkRocketParity();
  checkRailParity();
  checkWhipParity();
}

function checkRocketParity(): void {
  const world = createWeaponTestWorld(160);
  const owner = world.actors[0]!;
  const target = world.actors[1]!;
  owner.weapons.rocketAmmo = 1;
  const fired = fireV1Weapons(world, owner, weaponInput("rocket"));
  if (
    owner.weapons.rocketAmmo !== 0 ||
    world.projectiles[0]?.weaponId !== "rocket" ||
    !fired.some((event) => event.type === "weapon.rocketFired")
  ) {
    throw new Error("Rocket must consume ammo and create a rocket projectile.");
  }
  for (let frame = 0; frame < 20 && world.projectiles.length > 0; frame++) {
    world.timeMs += 34;
    updateProjectiles(
      world.projectiles,
      world.actors,
      world.geometry,
      34,
      world.timeMs,
      V2_DIAGNOSTIC_BLASTER_CONFIG,
      V2_ACTOR_LIFECYCLE_CONFIG,
    );
  }
  if (target.health >= target.maxHealth || target.velocity.x <= 0) {
    throw new Error("Rocket splash must apply damage and outward knockback.");
  }
}

function checkRailParity(): void {
  const world = createWeaponTestWorld(400);
  const owner = world.actors[0]!;
  const target = world.actors[1]!;
  owner.weapons.railAmmo = 2;
  const events = fireV1Weapons(world, owner, weaponInput("rail"));
  if (
    owner.weapons.railAmmo !== 1 ||
    owner.weapons.railCooldownMs !== 2500 ||
    target.health !== 5 ||
    !events.some((event) => event.type === "weapon.railFired")
  ) {
    throw new Error("Railgun must mirror V1 damage, ammo, and cooldown.");
  }
  fireV1Weapons(world, owner, weaponInput("rail"));
  if (owner.weapons.railAmmo !== 1) {
    throw new Error("Railgun cooldown must reject repeated fire.");
  }
}

function checkWhipParity(): void {
  const world = createWeaponTestWorld(110);
  const owner = world.actors[0]!;
  const target = world.actors[1]!;
  owner.weapons.whipAmmo = 1;
  const events = fireV1Weapons(world, owner, weaponInput("whip"));
  if (
    owner.weapons.whipAmmo !== 0 ||
    owner.weapons.whipCooldownMs !== 800 ||
    target.health !== 65 ||
    !events.some((event) => event.type === "weapon.whipFired")
  ) {
    throw new Error("Whip must mirror V1 cone damage, ammo, and cooldown.");
  }
}

function createWeaponTestWorld(targetX: number) {
  const world = createEmptyWorldState("weapon-smoke");
  world.geometry = {
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 800 },
    solids: [],
    gaps: [],
  };
  world.actors.push(
    createActorState({
      id: "blue",
      kind: "player",
      teamId: "blue",
      position: { x: 100, y: 100 },
      radius: 16,
      maxHealth: 100,
      maxArmor: 0,
    }),
    createActorState({
      id: "red",
      kind: "player",
      teamId: "red",
      position: { x: targetX, y: 100 },
      radius: 16,
      maxHealth: 100,
      maxArmor: 0,
    }),
  );
  return world;
}

function weaponInput(weaponId: "rocket" | "rail" | "whip") {
  return {
    sequence: 1,
    timeMs: 0,
    deltaMs: 16,
    actions: [{
      action: "aim",
      phase: "held" as const,
      actorId: "blue",
      direction: { x: 1, y: 0 },
    }, {
      action: "fireWeapon",
      phase: "pressed" as const,
      actorId: "blue",
      direction: { x: 1, y: 0 },
      payload: { weaponId },
    }],
  };
}
