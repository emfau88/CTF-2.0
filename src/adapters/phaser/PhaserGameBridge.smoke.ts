import { InertCoreRuntime } from "../../core";
import { PhaserGameBridge } from "./PhaserGameBridge";

export function runPhaserGameBridgeSmokeCheck(): void {
  let renders = 0;
  let audioFrames = 0;
  let effectFrames = 0;
  let hudFrames = 0;
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
    timeMs: 16,
    deltaMs: 16,
    actions: [],
  });

  if (initial.snapshot.timeMs !== 0) {
    throw new Error("Inert bridge must initialize at time zero.");
  }
  if (next.snapshot.timeMs !== 16) {
    throw new Error("Inert bridge must advance by the input delta.");
  }
  const initialActor = initial.snapshot.actors[0];
  const nextActor = next.snapshot.actors[0];
  if (
    next.events.length !== 0 ||
    initial.snapshot.actors.length !== 1 ||
    next.snapshot.actors.length !== 1
  ) {
    throw new Error("Inert bridge must expose one diagnostic actor.");
  }
  if (
    !initialActor ||
    !nextActor ||
    initialActor.id !== "diagnostic-actor-1" ||
    nextActor.position.x !== initialActor.position.x ||
    nextActor.position.y !== initialActor.position.y
  ) {
    throw new Error("Diagnostic actor must remain static.");
  }
  if (next.hudState.phase !== "inert") {
    throw new Error("Inert bridge must expose inert HUD state.");
  }
  if (
    renders !== 2 ||
    audioFrames !== 2 ||
    effectFrames !== 2 ||
    hudFrames !== 2
  ) {
    throw new Error("Inert bridge must forward every frame to provided ports.");
  }

  bridge.dispose();
}
