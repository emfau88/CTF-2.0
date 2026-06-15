import assert from "node:assert/strict";
import test from "node:test";
import {
  runPhaserGameBridgeSmokeCheck,
} from "../src/adapters/phaser/PhaserGameBridge.smoke";
import {
  clampRuntimeDeltaMs,
  V2_GAMEPLAY_RUNTIME_TIMING_CONFIG,
} from "../src/core";
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
