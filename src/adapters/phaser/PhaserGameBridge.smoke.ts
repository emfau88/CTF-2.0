import {
  applyWorldCollision,
  awardScore,
  createActorState,
  createEmptyWorldState,
  createPickupState,
  createScoreBoardState,
  createTeamDeathmatchWorldState,
  DiagnosticArenaMode,
  GameplayCoreRuntime,
  TeamDeathmatchMode,
  updatePickups,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
} from "../../core";
import type {
  ActorState,
  CoreActionIntent,
  PickupState,
} from "../../core";
import type { WorldGeometry } from "../../core";
import { PhaserGameBridge } from "./PhaserGameBridge";

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
    initialActor.id !== "diagnostic-actor-1" ||
    initialActor.position.x !== 150 ||
    initialActor.position.y !== 410 ||
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
  checkTeamDeathmatchSlice();
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
}

function runJumpSequence(heldFrames: number): {
  maxHeight: number;
  maxPlannedMs: number;
  airborneFrames: number;
  horizontalDistance: number;
  landed: boolean;
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
    respawnedActor.position.x !== 150 ||
    respawnedActor.position.y !== 410
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
  const runtime = new GameplayCoreRuntime();
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
        direction: { x: 1, y: 0 },
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
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode({
      durationMs: 120_000,
      scoreLimit: 3,
      initialScores: [
        { id: "blue", teamId: "blue", score: 0 },
        { id: "red", teamId: "red", score: 0 },
      ],
    }),
    createWorld: createTeamDeathmatchWorldState,
  });
  const initial = runtime.initialize();
  if (
    initial.snapshot.modeId !== "team-deathmatch" ||
    initial.snapshot.actors.length !== 2 ||
    initial.snapshot.actors.some((actor) => actor.kind !== "player") ||
    initial.hudState.notices[0] !== "First to 3"
  ) {
    throw new Error("TDM must initialize two local player actors.");
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
