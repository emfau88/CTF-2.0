import assert from "node:assert/strict";
import test from "node:test";
import { runPhaserGameBridgeSmokeCheck } from "../src/adapters/phaser/PhaserGameBridge.smoke";
import {
  ClassicCtfMode,
  createClassicCtfWorldState,
  createOneFlagWorldState,
  createTeamDeathmatchWorldState,
  GameplayCoreRuntime,
  OneFlagMode,
  TeamDeathmatchMode,
  TRAINING_CROSSING_V2,
  clampRuntimeDeltaMs,
  V2_GAMEPLAY_RUNTIME_TIMING_CONFIG,
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
