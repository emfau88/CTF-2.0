import assert from "node:assert/strict";
import test from "node:test";
import {
  ClassicCtfMode,
  createArenaBotControllerGroup,
  createArenaRoster,
  createClassicCtfWorldState,
  createOneFlagWorldState,
  createTeamDeathmatchWorldState,
  FLANK_SWITCH_V2,
  GameplayCoreRuntime,
  GRAND_ARCHIVE_V2,
  GridBotNavigator,
  OneFlagMode,
  OneFlagBotController,
  OneFlagBotDecisionController,
  TeamDeathmatchMode,
  TRAINING_CROSSING_V2,
  V2_BOT_NAVIGATION_CONFIG,
  type ArenaTeamId,
  type ArenaTeamSize,
  type GameMode,
  type GameModeId,
  type GridBotNavigatorDebugState,
  type OneFlagBotGoalKind,
  type WorldMapData,
  type WorldPosition,
  type WorldSnapshot,
  type WorldState,
} from "../src/core";

const FRAME_DELTA_MS = 34;

interface BotMovementMetric {
  readonly actorId: string;
  readonly teamId: ArenaTeamId;
  initialDistanceToObjective: number | null;
  minimumDistanceToObjective: number | null;
  totalTravelDistance: number;
  longestStationaryMs: number;
  currentStationaryMs: number;
}

interface SimulationSummary {
  readonly modeId: GameModeId;
  readonly mapId: string;
  readonly teamSize: ArenaTeamSize;
  readonly awardedScores: number;
  readonly flagPickups: number;
  readonly flagCaptures: number;
  readonly invalidPositionFrames: number;
  readonly idleActionFrames: number;
  readonly movementByActor: ReadonlyMap<string, BotMovementMetric>;
}

interface OneFlagNavigatorMetric extends BotMovementMetric {
  repathCount: number;
  pathMissCount: number;
  blockedGoalFrames: number;
  jumpFrames: number;
  longestPathLength: number;
  longestPathMissStreak: number;
  currentPathMissStreak: number;
  lastGoalCell: string | null;
  distinctGoalCells: Set<string>;
  repathReasons: Map<string, number>;
}

interface OneFlagNavigatorSummary {
  readonly summary: SimulationSummary;
  readonly movementByActor: ReadonlyMap<string, OneFlagNavigatorMetric>;
  readonly blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>;
  readonly blockedGoalFramesByCell: ReadonlyMap<string, number>;
  readonly takeCenterBlockedFrames: number;
  readonly chaseBlockedFrames: number;
  readonly report: string;
}

interface ScenarioDefinition {
  readonly label: string;
  readonly modeId: GameModeId;
  readonly map: WorldMapData;
  readonly teamSize: ArenaTeamSize;
  readonly durationMs: number;
  readonly createMode: () => GameMode;
  readonly createWorld: (map: WorldMapData, teamSize: ArenaTeamSize) => WorldState;
  readonly objectiveTarget?: (
    snapshot: WorldSnapshot,
    actorId: string,
  ) => WorldPosition | null;
  readonly assertSummary: (summary: SimulationSummary) => void;
}

test("headless bot simulation matrix keeps bots active across arena modes", () => {
  const scenarios: readonly ScenarioDefinition[] = [
    {
      label: "TDM Training Crossing 2v2",
      modeId: "team-deathmatch",
      map: TRAINING_CROSSING_V2,
      teamSize: 2,
      durationMs: 18_000,
      createMode: () => new TeamDeathmatchMode(),
      createWorld: (map, teamSize) => createTeamDeathmatchWorldState(map, { teamSize }),
      objectiveTarget: nearestEnemyPosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          bothTeamsExceed(teamProgress, "bestDistanceReduction", 140),
          true,
          "TDM 2v2 did not close distance to active enemies enough",
        );
        assertTravel(summary, 320);
      },
    },
    {
      label: "TDM Training Crossing 4v4",
      modeId: "team-deathmatch",
      map: TRAINING_CROSSING_V2,
      teamSize: 4,
      durationMs: 18_000,
      createMode: () => new TeamDeathmatchMode(),
      createWorld: (map, teamSize) => createTeamDeathmatchWorldState(map, { teamSize }),
      objectiveTarget: nearestEnemyPosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          bothTeamsExceed(teamProgress, "bestDistanceReduction", 140),
          true,
          "TDM 4v4 did not close distance to active enemies enough",
        );
        assertTravel(summary, 320);
      },
    },
    {
      label: "Classic CTF Flank Switch 2v2",
      modeId: "classic-ctf",
      map: FLANK_SWITCH_V2,
      teamSize: 2,
      durationMs: 22_000,
      createMode: () => new ClassicCtfMode(FLANK_SWITCH_V2),
      createWorld: (map, teamSize) => createClassicCtfWorldState(map, { teamSize }),
      objectiveTarget: enemyFlagHomePosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          summary.flagPickups > 0 || bothTeamsExceed(teamProgress, "bestDistanceReduction", 280),
          true,
          "Classic CTF 2v2 showed neither flag pressure nor enough flag approach progress",
        );
        assertTravelAndStall(summary, 1_000, 7_500);
      },
    },
    {
      label: "Classic CTF Flank Switch 4v4",
      modeId: "classic-ctf",
      map: FLANK_SWITCH_V2,
      teamSize: 4,
      durationMs: 22_000,
      createMode: () => new ClassicCtfMode(FLANK_SWITCH_V2),
      createWorld: (map, teamSize) => createClassicCtfWorldState(map, { teamSize }),
      objectiveTarget: enemyFlagHomePosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          summary.flagPickups > 0 || bothTeamsExceed(teamProgress, "bestDistanceReduction", 280),
          true,
          "Classic CTF 4v4 showed neither flag pressure nor enough flag approach progress",
        );
        assertTravelAndStall(summary, 1_100, 7_500);
      },
    },
    {
      label: "One Flag Grand Archive 2v2",
      modeId: "one-flag",
      map: GRAND_ARCHIVE_V2,
      teamSize: 2,
      durationMs: 18_000,
      createMode: () => new OneFlagMode(GRAND_ARCHIVE_V2),
      createWorld: (map, teamSize) => createOneFlagWorldState(map, { teamSize }),
      objectiveTarget: neutralFlagHomePosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          bothTeamsExceed(teamProgress, "bestDistanceReduction", 250),
          true,
          "One Flag 2v2 did not make enough center-flag progress",
        );
        assertTravelAndStall(summary, 900, 7_000);
      },
    },
    {
      label: "One Flag Grand Archive 4v4",
      modeId: "one-flag",
      map: GRAND_ARCHIVE_V2,
      teamSize: 4,
      durationMs: 18_000,
      createMode: () => new OneFlagMode(GRAND_ARCHIVE_V2),
      createWorld: (map, teamSize) => createOneFlagWorldState(map, { teamSize }),
      objectiveTarget: neutralFlagHomePosition,
      assertSummary: (summary) => {
        const teamProgress = groupProgressByTeam(summary.movementByActor);
        assert.equal(
          bothTeamsExceed(teamProgress, "bestDistanceReduction", 250),
          true,
          "One Flag 4v4 did not make enough center-flag progress",
        );
        assertTravelAndStall(summary, 900, 7_000);
      },
    },
  ];

  for (const scenario of scenarios) {
    const summary = runSimulation(scenario);
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
    scenario.assertSummary(summary);
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
    diagnostic.report.includes("actor | repaths"),
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
});

function runSimulation(scenario: ScenarioDefinition): SimulationSummary {
  const participants = createArenaRoster(scenario.teamSize);
  const runtime = new GameplayCoreRuntime({
    mode: scenario.createMode(),
    createWorld: () => scenario.createWorld(scenario.map, scenario.teamSize),
  });
  runtime.initialize();
  const bots = createArenaBotControllerGroup(
    scenario.modeId,
    scenario.map,
    participants,
  );
  const movementByActor = new Map<string, BotMovementMetric>(
    participants.map((participant) => [participant.actorId, {
      actorId: participant.actorId,
      teamId: participant.teamId,
      initialDistanceToObjective: null,
      minimumDistanceToObjective: null,
      totalTravelDistance: 0,
      longestStationaryMs: 0,
      currentStationaryMs: 0,
    }]),
  );

  let awardedScores = 0;
  let flagPickups = 0;
  let flagCaptures = 0;
  let invalidPositionFrames = 0;
  let idleActionFrames = 0;
  const frameCount = Math.ceil(scenario.durationMs / FRAME_DELTA_MS);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = runtime.snapshot;
    const actions = bots.readActions(before, FRAME_DELTA_MS);
    if (actions.length === 0) idleActionFrames += 1;
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    const after = result.snapshot;
    awardedScores += result.events.filter((event) =>
      event.type === "score.awarded"
    ).length;
    flagPickups += result.events.filter((event) =>
      event.type === "objective.flagPickedUp"
    ).length;
    flagCaptures += result.events.filter((event) =>
      event.type === "objective.flagCaptured"
    ).length;

    for (const participant of participants) {
      const metric = movementByActor.get(participant.actorId);
      const previous = before.actors.find((actor) => actor.id === participant.actorId);
      const current = after.actors.find((actor) => actor.id === participant.actorId);
      if (!metric || !previous || !current) {
        throw new Error(`Missing simulation actor state for ${participant.actorId}.`);
      }
      if (
        !Number.isFinite(current.position.x) ||
        !Number.isFinite(current.position.y)
      ) {
        invalidPositionFrames += 1;
        continue;
      }
      const stepDistance = distance(previous.position, current.position);
      metric.totalTravelDistance += stepDistance;
      if (stepDistance < 1) {
        metric.currentStationaryMs += FRAME_DELTA_MS;
        metric.longestStationaryMs = Math.max(
          metric.longestStationaryMs,
          metric.currentStationaryMs,
        );
      } else {
        metric.currentStationaryMs = 0;
      }
      const objectiveTarget = scenario.objectiveTarget?.(after, participant.actorId);
      if (objectiveTarget) {
        const objectiveDistance = distance(current.position, objectiveTarget);
        metric.initialDistanceToObjective ??= distance(previous.position, objectiveTarget);
        metric.minimumDistanceToObjective = metric.minimumDistanceToObjective === null
          ? objectiveDistance
          : Math.min(metric.minimumDistanceToObjective, objectiveDistance);
      }
    }
  }

  return {
    modeId: scenario.modeId,
    mapId: scenario.map.id,
    teamSize: scenario.teamSize,
    awardedScores,
    flagPickups,
    flagCaptures,
    invalidPositionFrames,
    idleActionFrames,
    movementByActor,
  };
}

function runOneFlagNavigatorDiagnostics(
  teamSize: ArenaTeamSize,
  durationMs: number,
): OneFlagNavigatorSummary {
  const participants = createArenaRoster(teamSize);
  const runtime = new GameplayCoreRuntime({
    mode: new OneFlagMode(GRAND_ARCHIVE_V2),
    createWorld: () => createOneFlagWorldState(GRAND_ARCHIVE_V2, { teamSize }),
  });
  runtime.initialize();
  const decision = new OneFlagBotDecisionController(GRAND_ARCHIVE_V2);
  const navigators = new Map<string, GridBotNavigator>();
  const controllers = participants.map((participant) => {
    const navigator = new GridBotNavigator();
    navigators.set(participant.actorId, navigator);
    return new OneFlagBotController(
      participant.actorId,
      GRAND_ARCHIVE_V2,
      undefined,
      navigator,
    );
  });
  const movementByActor = new Map<string, OneFlagNavigatorMetric>(
    participants.map((participant) => [participant.actorId, {
      actorId: participant.actorId,
      teamId: participant.teamId,
      initialDistanceToObjective: null,
      minimumDistanceToObjective: null,
      totalTravelDistance: 0,
      longestStationaryMs: 0,
      currentStationaryMs: 0,
      repathCount: 0,
      pathMissCount: 0,
      blockedGoalFrames: 0,
      jumpFrames: 0,
      longestPathLength: 0,
      longestPathMissStreak: 0,
      currentPathMissStreak: 0,
      lastGoalCell: null,
      distinctGoalCells: new Set<string>(),
      repathReasons: new Map<string, number>(),
    }]),
  );

  let awardedScores = 0;
  let flagPickups = 0;
  let flagCaptures = 0;
  let invalidPositionFrames = 0;
  let idleActionFrames = 0;
  let takeCenterBlockedFrames = 0;
  let chaseBlockedFrames = 0;
  const blockedGoalFramesByKind = new Map<OneFlagBotGoalKind, number>();
  const blockedGoalFramesByCell = new Map<string, number>();
  const frameCount = Math.ceil(durationMs / FRAME_DELTA_MS);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = runtime.snapshot;
    captureGoalDiagnostics(
      before,
      participants.map((participant) => participant.actorId),
      decision,
      blockedGoalFramesByKind,
      blockedGoalFramesByCell,
      (goalKind) => {
        if (goalKind === "take-center-flag") takeCenterBlockedFrames += 1;
        if (goalKind === "chase-enemy-carrier") chaseBlockedFrames += 1;
      },
    );
    const actions = controllers.flatMap((controller) =>
      controller.readActions(before, FRAME_DELTA_MS)
    );
    if (actions.length === 0) idleActionFrames += 1;
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    const after = result.snapshot;
    awardedScores += result.events.filter((event) =>
      event.type === "score.awarded"
    ).length;
    flagPickups += result.events.filter((event) =>
      event.type === "objective.flagPickedUp"
    ).length;
    flagCaptures += result.events.filter((event) =>
      event.type === "objective.flagCaptured"
    ).length;

    for (const participant of participants) {
      const metric = movementByActor.get(participant.actorId);
      const navigator = navigators.get(participant.actorId);
      const previous = before.actors.find((actor) => actor.id === participant.actorId);
      const current = after.actors.find((actor) => actor.id === participant.actorId);
      if (!metric || !navigator || !previous || !current) {
        throw new Error(`Missing one-flag diagnostic state for ${participant.actorId}.`);
      }
      updateMovementMetric(metric, previous.position, current.position, neutralFlagHomePosition(after, participant.actorId));
      if (
        !Number.isFinite(current.position.x) ||
        !Number.isFinite(current.position.y)
      ) {
        invalidPositionFrames += 1;
      }
      captureNavigatorDebug(metric, navigator.debugSnapshot());
    }
  }

  const summary: SimulationSummary = {
    modeId: "one-flag",
    mapId: GRAND_ARCHIVE_V2.id,
    teamSize,
    awardedScores,
    flagPickups,
    flagCaptures,
    invalidPositionFrames,
    idleActionFrames,
    movementByActor,
  };

  return {
    summary,
    movementByActor,
    blockedGoalFramesByKind,
    blockedGoalFramesByCell,
    takeCenterBlockedFrames,
    chaseBlockedFrames,
    report: formatOneFlagNavigatorReport(
      summary,
      movementByActor,
      blockedGoalFramesByKind,
      blockedGoalFramesByCell,
    ),
  };
}

function neutralFlagHomePosition(
  snapshot: WorldSnapshot,
  _actorId: string,
): WorldPosition | null {
  const flag = snapshot.objectives.find((objective) =>
    objective.kind === "neutral-flag"
  );
  return flag ? { ...flag.position } : null;
}

function enemyFlagHomePosition(
  snapshot: WorldSnapshot,
  actorId: string,
): WorldPosition | null {
  const actor = snapshot.actors.find((candidate) => candidate.id === actorId);
  if (!actor?.teamId) return null;
  const enemyFlag = snapshot.objectives.find((objective) =>
    objective.kind === "team-flag" &&
    objective.state.controllingTeamId &&
    objective.state.controllingTeamId !== actor.teamId
  );
  return enemyFlag ? { ...enemyFlag.position } : null;
}

function nearestEnemyPosition(
  snapshot: WorldSnapshot,
  actorId: string,
): WorldPosition | null {
  const actor = snapshot.actors.find((candidate) => candidate.id === actorId);
  if (!actor?.teamId) return null;
  let nearest: { position: WorldPosition; distance: number } | null = null;
  for (const candidate of snapshot.actors) {
    if (
      candidate.id === actorId ||
      candidate.lifeState !== "active" ||
      candidate.teamId === actor.teamId
    ) {
      continue;
    }
    const candidateDistance = distance(actor.position, candidate.position);
    if (!nearest || candidateDistance < nearest.distance) {
      nearest = {
        position: { ...candidate.position },
        distance: candidateDistance,
      };
    }
  }
  return nearest?.position ?? null;
}

function captureNavigatorDebug(
  metric: OneFlagNavigatorMetric,
  debug: GridBotNavigatorDebugState,
): void {
  if (debug.repathed) {
    metric.repathCount += 1;
    metric.repathReasons.set(
      debug.repathReason,
      (metric.repathReasons.get(debug.repathReason) ?? 0) + 1,
    );
  }
  if (!debug.pathFound) {
    metric.pathMissCount += 1;
    metric.currentPathMissStreak += 1;
    metric.longestPathMissStreak = Math.max(
      metric.longestPathMissStreak,
      metric.currentPathMissStreak,
    );
  } else {
    metric.currentPathMissStreak = 0;
  }
  if (debug.goalBlocked) metric.blockedGoalFrames += 1;
  if (debug.jumpLinkActive) metric.jumpFrames += 1;
  metric.longestPathLength = Math.max(metric.longestPathLength, debug.pathLength);
  if (debug.goalCell) {
    const goalCellKey = `${debug.goalCell.x},${debug.goalCell.y}`;
    metric.lastGoalCell = goalCellKey;
    metric.distinctGoalCells.add(goalCellKey);
  }
}

function captureGoalDiagnostics(
  snapshot: WorldSnapshot,
  actorIds: readonly string[],
  decision: OneFlagBotDecisionController,
  blockedGoalFramesByKind: Map<OneFlagBotGoalKind, number>,
  blockedGoalFramesByCell: Map<string, number>,
  onBlockedGoalKind: (goalKind: OneFlagBotGoalKind) => void,
): void {
  for (const actorId of actorIds) {
    const actor = snapshot.actors.find((candidate) =>
      candidate.id === actorId && candidate.lifeState === "active"
    );
    if (!actor) continue;
    const goal = decision.chooseGoal(actor, snapshot);
    if (!isBlockedGoal(goal.position, snapshot)) continue;
    blockedGoalFramesByKind.set(
      goal.kind,
      (blockedGoalFramesByKind.get(goal.kind) ?? 0) + 1,
    );
    const cell = cellForPosition(goal.position);
    const key = `${goal.kind}@${cell.x},${cell.y}`;
    blockedGoalFramesByCell.set(
      key,
      (blockedGoalFramesByCell.get(key) ?? 0) + 1,
    );
    onBlockedGoalKind(goal.kind);
  }
}

function groupProgressByTeam(
  movementByActor: ReadonlyMap<string, BotMovementMetric>,
): Record<ArenaTeamId, {
  bestDistanceReduction: number;
  highestTravelDistance: number;
  longestStationaryMs: number;
}> {
  const grouped = {
    blue: {
      bestDistanceReduction: 0,
      highestTravelDistance: 0,
      longestStationaryMs: 0,
    },
    red: {
      bestDistanceReduction: 0,
      highestTravelDistance: 0,
      longestStationaryMs: 0,
    },
  } satisfies Record<ArenaTeamId, {
    bestDistanceReduction: number;
    highestTravelDistance: number;
    longestStationaryMs: number;
  }>;

  for (const metric of movementByActor.values()) {
    const target = grouped[metric.teamId];
    target.highestTravelDistance = Math.max(
      target.highestTravelDistance,
      metric.totalTravelDistance,
    );
    target.longestStationaryMs = Math.max(
      target.longestStationaryMs,
      metric.longestStationaryMs,
    );
    if (
      metric.minimumDistanceToObjective !== null &&
      metric.initialDistanceToObjective !== null
    ) {
      target.bestDistanceReduction = Math.max(
        target.bestDistanceReduction,
        metric.initialDistanceToObjective - metric.minimumDistanceToObjective,
      );
    }
  }

  return grouped;
}

function updateMovementMetric(
  metric: BotMovementMetric,
  previousPosition: WorldPosition,
  currentPosition: WorldPosition,
  objectiveTarget: WorldPosition | null,
): void {
  const stepDistance = distance(previousPosition, currentPosition);
  metric.totalTravelDistance += stepDistance;
  if (stepDistance < 1) {
    metric.currentStationaryMs += FRAME_DELTA_MS;
    metric.longestStationaryMs = Math.max(
      metric.longestStationaryMs,
      metric.currentStationaryMs,
    );
  } else {
    metric.currentStationaryMs = 0;
  }
  if (objectiveTarget) {
    const objectiveDistance = distance(currentPosition, objectiveTarget);
    metric.initialDistanceToObjective ??= distance(previousPosition, objectiveTarget);
    metric.minimumDistanceToObjective = metric.minimumDistanceToObjective === null
      ? objectiveDistance
      : Math.min(metric.minimumDistanceToObjective, objectiveDistance);
  }
}

function formatOneFlagNavigatorReport(
  summary: SimulationSummary,
  movementByActor: ReadonlyMap<string, OneFlagNavigatorMetric>,
  blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>,
  blockedGoalFramesByCell: ReadonlyMap<string, number>,
): string {
  const blockedKindSummary = summarizeCountMap(blockedGoalFramesByKind);
  const blockedCellSummary = summarizeCountMap(blockedGoalFramesByCell, 6);
  const lines = [
    "One Flag Grand Archive Navigator Report",
    `mode=${summary.modeId} map=${summary.mapId} teamSize=${summary.teamSize} flagPickups=${summary.flagPickups} flagCaptures=${summary.flagCaptures} invalidFrames=${summary.invalidPositionFrames} idleFrames=${summary.idleActionFrames}`,
    `blockedGoalKinds=${blockedKindSummary || "none"} blockedGoalCells=${blockedCellSummary || "none"}`,
    "actor | repaths | pathMisses | longestMissStreak | blockedGoalFrames | longestPath | longestStationaryMs | bestDistanceReduction | goalCells | repathReasons",
  ];
  for (const metric of [...movementByActor.values()].sort((left, right) =>
    left.actorId.localeCompare(right.actorId)
  )) {
    const bestDistanceReduction =
      metric.initialDistanceToObjective !== null &&
        metric.minimumDistanceToObjective !== null
        ? metric.initialDistanceToObjective - metric.minimumDistanceToObjective
        : 0;
    lines.push([
      metric.actorId,
      metric.repathCount,
      metric.pathMissCount,
      metric.longestPathMissStreak,
      metric.blockedGoalFrames,
      metric.longestPathLength,
      metric.longestStationaryMs,
      bestDistanceReduction.toFixed(1),
      metric.distinctGoalCells.size,
      [...metric.repathReasons.entries()].map(([reason, count]) =>
        `${reason}:${count}`
      ).join(",") || "none",
    ].join(" | "));
  }
  return lines.join("\n");
}

function isBlockedGoal(
  point: WorldPosition,
  snapshot: WorldSnapshot,
): boolean {
  return [...snapshot.geometry.solids, ...snapshot.geometry.gaps].some((rect) =>
    point.x >= rect.x - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.x <= rect.x + rect.width + V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.y >= rect.y - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.y <= rect.y + rect.height + V2_BOT_NAVIGATION_CONFIG.obstaclePadding
  );
}

function cellForPosition(
  point: WorldPosition,
): { x: number; y: number } {
  return {
    x: Math.max(
      0,
      Math.floor(
        (point.x - GRAND_ARCHIVE_V2.geometry.bounds.minX) /
          V2_BOT_NAVIGATION_CONFIG.cellSize,
      ),
    ),
    y: Math.max(
      0,
      Math.floor(
        (point.y - GRAND_ARCHIVE_V2.geometry.bounds.minY) /
          V2_BOT_NAVIGATION_CONFIG.cellSize,
      ),
    ),
  };
}

function summarizeCountMap(
  counts: ReadonlyMap<string, number>,
  limit = 10,
): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}

function bothTeamsExceed(
  teamMetrics: Record<ArenaTeamId, {
    bestDistanceReduction: number;
    highestTravelDistance: number;
    longestStationaryMs: number;
  }>,
  field: "bestDistanceReduction" | "highestTravelDistance",
  threshold: number,
): boolean {
  return teamMetrics.blue[field] > threshold && teamMetrics.red[field] > threshold;
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

function distance(left: WorldPosition, right: WorldPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
