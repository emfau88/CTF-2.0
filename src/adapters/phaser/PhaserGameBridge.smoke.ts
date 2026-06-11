import {
  applyWorldCollision,
  createActorState,
  createPickupState,
  InertCoreRuntime,
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
  const bridge = new PhaserGameBridge(new InertCoreRuntime(), {
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
    initial.snapshot.geometry.gaps.length !== 2
  ) {
    throw new Error("V2 shell must initialize Training Crossing geometry.");
  }
  if (next.snapshot.timeMs !== 34) {
    throw new Error("Inert bridge must advance by the input delta.");
  }
  const initialActor = initial.snapshot.actors[0];
  const nextActor = next.snapshot.actors[0];
  if (
    next.events.length !== 1 ||
    initial.snapshot.actors.length !== 2 ||
    next.snapshot.actors.length !== 2
  ) {
    throw new Error("Inert bridge must expose actor and target diagnostics.");
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
  if (next.hudState.phase !== "inert") {
    throw new Error("Inert bridge must expose inert HUD state.");
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
  const runtime = new InertCoreRuntime();
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
  const runtime = new InertCoreRuntime();
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
): Parameters<InertCoreRuntime["advance"]>[0] {
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
  const runtime = new InertCoreRuntime();
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

  const expiryRuntime = new InertCoreRuntime();
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
