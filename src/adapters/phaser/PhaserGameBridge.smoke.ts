import {
  applyWorldCollision,
  awardScore,
  createActorState,
  createClassicCtfWorldState,
  createEmptyWorldState,
  createWorldSnapshot,
  createPickupState,
  createScoreBoardState,
  createTeamDeathmatchWorldState,
  DiagnosticArenaMode,
  fireV1Weapons,
  FLANK_SWITCH_V2,
  GRAND_ARCHIVE_V2,
  getWorldMap,
  GameplayCoreRuntime,
  ClassicCtfMode,
  resolveWorldMap,
  TeamDeathmatchMode,
  TdmBotController,
  TRAINING_CROSSING_V2,
  updatePickups,
  updateProjectiles,
  V2_ACTOR_LIFECYCLE_CONFIG,
  V2_ARENA_PICKUP_PARITY_CONFIG,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
} from "../../core";
import type {
  ActorState,
  CoreActionIntent,
  PickupState,
} from "../../core";
import type { WorldGeometry } from "../../core";
import { createDiagnosticWorldState } from "../../core/runtime/createDiagnosticWorldState";
import { PhaserGameBridge } from "./PhaserGameBridge";
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
    nextActor.velocity.x >= 335 ||
    nextActor.velocity.y !== 0
  ) {
    throw new Error("Diagnostic actor must accelerate with V2 ground movement.");
  }
  if (next.events[0]?.type !== "diagnostic.actorMoved") {
    throw new Error("Diagnostic movement must emit a serializable event.");
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
  checkCollisionAndGapGroundwork();
  checkActorLifecycle();
  checkProjectilePipeline();
  checkPickupPipeline();
  checkMatchLifecycle();
  checkScoreSafety();
  checkMobileWeaponTapTargeting();
  checkWorldMapRegistry();
  checkClassicCtfMode();
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
    x: TRAINING_CROSSING_V2.presentation.redBase.x +
      TRAINING_CROSSING_V2.presentation.redBase.width / 2,
    y: TRAINING_CROSSING_V2.presentation.redBase.y +
      TRAINING_CROSSING_V2.presentation.redBase.height / 2,
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
    type: "diagnostic.actorFell",
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
    x: TRAINING_CROSSING_V2.presentation.blueBase.x +
      TRAINING_CROSSING_V2.presentation.blueBase.width / 2,
    y: TRAINING_CROSSING_V2.presentation.blueBase.y +
      TRAINING_CROSSING_V2.presentation.blueBase.height / 2,
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

function checkJumpParity(): void {
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
    fallResult.events[0]?.type !== "diagnostic.actorFell"
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
    timeMs: 15_034,
    deltaMs: 15_000,
    actions: [],
  });
  if (
    ended.snapshot.match?.phase !== "ended" ||
    ended.snapshot.match.remainingMs !== 0 ||
    ended.snapshot.match.result?.kind !== "winner" ||
    ended.snapshot.match.result.winnerEntryId !== "blue" ||
    !ended.events.some((event) => event.type === "match.ended")
  ) {
    throw new Error("Diagnostic match must end by timer with a result.");
  }

  const rejectedScore = runtime.advance({
    sequence: 3,
    timeMs: 15_068,
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
    rejectedScore.snapshot.timeMs !== ended.snapshot.timeMs ||
    rejectedScore.snapshot.projectiles.length !==
      ended.snapshot.projectiles.length ||
    rejectedScore.snapshot.actors[0]?.position.x !==
      ended.snapshot.actors[0]?.position.x ||
    rejectedScore.snapshot.actors[0]?.position.y !==
      ended.snapshot.actors[0]?.position.y
  ) {
    throw new Error("Ended matches must freeze gameplay simulation.");
  }

  const drawRuntime = new GameplayCoreRuntime();
  drawRuntime.initialize();
  const draw = drawRuntime.advance({
    sequence: 1,
    timeMs: 15_000,
    deltaMs: 15_000,
    actions: [],
  });
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
  checkTdmBotNavigation(createTeamDeathmatchWorldState, "Training Crossing");
  checkTdmBotNavigation(
    () => createTeamDeathmatchWorldState(FLANK_SWITCH_V2),
    "Flank Switch",
  );
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
