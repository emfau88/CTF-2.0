import assert from "node:assert/strict";
import test from "node:test";
import {
  bothTeamsExceed,
  createSimulationScenarios,
  groupProgressByTeam,
  runOneFlagNavigatorDiagnostics,
  runSimulationScenario,
  type SimulationSummary,
} from "./bot-diagnostics";

test("headless bot simulation matrix keeps bots active across arena modes", () => {
  for (const scenario of createSimulationScenarios()) {
    const summary = runSimulationScenario(scenario);
    assert.equal(
      summary.invalidPositionFrames,
      0,
      `${scenario.label} produced invalid actor positions`,
    );
    assert.equal(
      summary.idleActionFrames,
      0,
      `${scenario.label} yielded frames without bot actions`,
    );
    assertScenarioSummary(summary);
  }
});

test("one-flag grand archive navigator diagnostics stay within expected bounds", () => {
  const diagnostic = runOneFlagNavigatorDiagnostics(2, 18_000);
  const teamProgress = groupProgressByTeam(diagnostic.movementByActor);

  assert.equal(
    bothTeamsExceed(teamProgress, "bestDistanceReduction", 250),
    true,
    `One Flag navigator diagnostics lost center-flag progress\n${diagnostic.report}`,
  );
  for (const metric of diagnostic.movementByActor.values()) {
    assert.equal(
      metric.pathMissCount < 25,
      true,
      `Too many path misses for ${metric.actorId}\n${diagnostic.report}`,
    );
    assert.equal(
      metric.blockedGoalFrames < 200,
      true,
      `Goal stayed blocked too often for ${metric.actorId}\n${diagnostic.report}`,
    );
    assert.equal(
      metric.longestPathMissStreak < 8,
      true,
      `Path miss streak too long for ${metric.actorId}\n${diagnostic.report}`,
    );
    assert.equal(
      metric.repathCount > 0,
      true,
      `Navigator never repathed for ${metric.actorId}\n${diagnostic.report}`,
    );
  }
  assert.equal(
    diagnostic.report.includes("One Flag Grand Archive Navigator Report"),
    true,
  );
  assert.equal(
    diagnostic.takeCenterBlockedFrames,
    0,
    `Center-flag targets should not be blocked by geometry padding\n${diagnostic.report}`,
  );
  assert.equal(
    diagnostic.chaseBlockedFrames > 0,
    true,
    `Expected to observe at least some blocked chase frames for carrier pursuit analysis\n${diagnostic.report}`,
  );
  const escortMetrics = [...diagnostic.movementByActor.values()].filter(
    (metric) => (metric.goalFramesByKind.get("escort-carrier") ?? 0) > 0,
  );
  assert.equal(escortMetrics.length > 0, true, diagnostic.report);
  for (const metric of escortMetrics) {
    assert.equal(metric.dynamicProjectionCount > 0, true, diagnostic.report);
    assert.equal(metric.blockedGoalFrames, 0, diagnostic.report);
    assert.equal(metric.longestNoProgressMs < 1_500, true, diagnostic.report);
  }
});

function assertScenarioSummary(summary: SimulationSummary): void {
  const teamProgress = groupProgressByTeam(summary.movementByActor);
  if (summary.modeId === "team-deathmatch") {
    assert.equal(
      bothTeamsExceed(teamProgress, "bestDistanceReduction", 140),
      true,
      `${summary.label} did not close distance to active enemies enough`,
    );
    assert.equal(
      teamProgress.blue.basicShots > 0 && teamProgress.red.basicShots > 0,
      true,
      `${summary.label} did not exercise bot basic auto-fire`,
    );
    assert.equal(
      teamProgress.blue.longestMoveIntentStallMs < 1_000 &&
        teamProgress.red.longestMoveIntentStallMs < 1_000,
      true,
      `${summary.label} produced a real movement-intent stall`,
    );
    assertTravel(summary, 320);
    return;
  }
  if (summary.modeId === "classic-ctf") {
    assert.equal(
      summary.flagPickups > 0 || bothTeamsExceed(teamProgress, "bestDistanceReduction", 280),
      true,
      `${summary.label} showed neither flag pressure nor enough flag approach progress`,
    );
    assertTravelAndStall(summary, summary.teamSize === 2 ? 1_000 : 1_100, 7_500);
    return;
  }
  assert.equal(
    bothTeamsExceed(teamProgress, "bestDistanceReduction", 250),
    true,
    `${summary.label} did not make enough center-flag progress`,
  );
  assertTravelAndStall(summary, 900, 7_000);
}

function assertTravelAndStall(
  summary: SimulationSummary,
  minTravelDistance: number,
  maxStationaryMs: number,
): void {
  const byTeam = groupProgressByTeam(summary.movementByActor);
  assertTravel(summary, minTravelDistance);
  assert.equal(
    byTeam.blue.longestStationaryMs < maxStationaryMs,
    true,
    `${summary.modeId} ${summary.teamSize}v${summary.teamSize} blue stalled too long (${byTeam.blue.longestStationaryMs} ms)`,
  );
  assert.equal(
    byTeam.red.longestStationaryMs < maxStationaryMs,
    true,
    `${summary.modeId} ${summary.teamSize}v${summary.teamSize} red stalled too long (${byTeam.red.longestStationaryMs} ms)`,
  );
}

function assertTravel(
  summary: SimulationSummary,
  minTravelDistance: number,
): void {
  const byTeam = groupProgressByTeam(summary.movementByActor);
  assert.equal(
    bothTeamsExceed(byTeam, "highestTravelDistance", minTravelDistance),
    true,
    `${summary.modeId} ${summary.teamSize}v${summary.teamSize} travel stayed too low`,
  );
}
