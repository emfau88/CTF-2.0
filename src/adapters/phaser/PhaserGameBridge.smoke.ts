import { InertCoreRuntime } from "../../core";
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
    timeMs: 1000,
    deltaMs: 1000,
    actions: [{
      action: "move",
      phase: "held",
      direction: { x: 1, y: 0 },
    }],
  });

  if (initial.snapshot.timeMs !== 0) {
    throw new Error("Inert bridge must initialize at time zero.");
  }
  if (next.snapshot.timeMs !== 1000) {
    throw new Error("Inert bridge must advance by the input delta.");
  }
  const initialActor = initial.snapshot.actors[0];
  const nextActor = next.snapshot.actors[0];
  if (
    next.events.length !== 1 ||
    initial.snapshot.actors.length !== 1 ||
    next.snapshot.actors.length !== 1
  ) {
    throw new Error("Inert bridge must expose one diagnostic actor.");
  }
  if (
    !initialActor ||
    !nextActor ||
    initialActor.id !== "diagnostic-actor-1" ||
    nextActor.position.x !== initialActor.position.x + 160 ||
    nextActor.position.y !== initialActor.position.y ||
    nextActor.velocity.x !== 160 ||
    nextActor.velocity.y !== 0
  ) {
    throw new Error("Diagnostic actor must move at constant diagnostic speed.");
  }
  if (next.events[0]?.type !== "diagnostic.actorMoved") {
    throw new Error("Diagnostic movement must emit a serializable event.");
  }
  if (next.hudState.phase !== "inert") {
    throw new Error("Inert bridge must expose inert HUD state.");
  }
  if (
    renders !== 2 ||
    audioFrames !== 2 ||
    effectFrames !== 2 ||
    hudFrames !== 2
    || diagnosticFrames !== 2
  ) {
    throw new Error("Inert bridge must forward every frame to provided ports.");
  }

  bridge.dispose();
}
