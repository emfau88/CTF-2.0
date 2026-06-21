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
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_BOT_NAVIGATION_CONFIG,
  type ArenaTeamId,
  type ArenaTeamSize,
  type GameMode,
  type GameModeId,
  type GridBotNavigatorDebugState,
  type OneFlagBotControllerDebugState,
  type OneFlagBotGoalKind,
  type WorldMapData,
  type WorldPosition,
  type WorldSnapshot,
  type WorldState,
} from "../src/core";

export const FRAME_DELTA_MS = 34;

export interface BotMovementMetric {
  readonly actorId: string;
  readonly teamId: ArenaTeamId;
  initialDistanceToObjective: number | null;
  minimumDistanceToObjective: number | null;
  totalTravelDistance: number;
  longestStationaryMs: number;
  currentStationaryMs: number;
  intentionalHoldMs: number;
  inactiveMs: number;
  longestMoveIntentStallMs: number;
  currentMoveIntentStallMs: number;
  basicShots: number;
}

export interface SimulationSummary {
  readonly label: string;
  readonly modeId: GameModeId;
  readonly mapId: string;
  readonly teamSize: ArenaTeamSize;
  readonly awardedScores: number;
  readonly flagPickups: number;
  readonly flagCaptures: number;
  readonly invalidPositionFrames: number;
  readonly idleActionFrames: number;
  readonly simulatedDurationMs: number;
  readonly matchEnded: boolean;
  readonly movementByActor: ReadonlyMap<string, BotMovementMetric>;
}

export interface OneFlagNavigatorMetric extends BotMovementMetric {
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
  goalFramesByKind: Map<OneFlagBotGoalKind, number>;
  goalSwitchCount: number;
  lastGoalKind: OneFlagBotGoalKind | null;
  dynamicProjectionCount: number;
  totalProjectionDistance: number;
  maxProjectionDistance: number;
  standoffByKey: Map<string, number>;
  longestNoProgressMs: number;
  currentNoProgressMs: number;
  previousTargetDistance: number | null;
  previousTargetKey: string;
  longestSameCellMs: number;
  currentSameCellMs: number;
  lastCellKey: string | null;
}

export interface OneFlagEventTimelineEntry {
  readonly timeMs: number;
  readonly type: "flagPickedUp" | "flagCaptured";
  readonly actorId: string | null;
  readonly teamId: string | null;
}

export interface OneFlagNavigatorSummary {
  readonly summary: SimulationSummary;
  readonly movementByActor: ReadonlyMap<string, OneFlagNavigatorMetric>;
  readonly blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>;
  readonly blockedGoalFramesByCell: ReadonlyMap<string, number>;
  readonly takeCenterBlockedFrames: number;
  readonly chaseBlockedFrames: number;
  readonly timeline: readonly OneFlagEventTimelineEntry[];
  readonly report: string;
}

export interface ScenarioDefinition {
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
}

export function createSimulationScenarios(): readonly ScenarioDefinition[] {
  return [
    {
      label: "TDM Training Crossing 2v2",
      modeId: "team-deathmatch",
      map: TRAINING_CROSSING_V2,
      teamSize: 2,
      durationMs: 18_000,
      createMode: () => new TeamDeathmatchMode(),
      createWorld: (map, teamSize) => createTeamDeathmatchWorldState(map, { teamSize }),
      objectiveTarget: nearestEnemyPosition,
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
    },
  ];
}

export function runSimulationScenario(
  scenario: ScenarioDefinition,
): SimulationSummary {
  const participants = createArenaRoster(scenario.teamSize);
  const runtime = new GameplayCoreRuntime({
    mode: scenario.createMode(),
    createWorld: () => scenario.createWorld(scenario.map, scenario.teamSize),
    basicAutoAttack: V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
    autoBasicAttackActorIds: participants.map(
      (participant) => participant.actorId,
    ),
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
      intentionalHoldMs: 0,
      inactiveMs: 0,
      longestMoveIntentStallMs: 0,
      currentMoveIntentStallMs: 0,
      basicShots: 0,
      intentionalHoldMs: 0,
      inactiveMs: 0,
      longestMoveIntentStallMs: 0,
      currentMoveIntentStallMs: 0,
      basicShots: 0,
    }]),
  );

  let awardedScores = 0;
  let flagPickups = 0;
  let flagCaptures = 0;
  let invalidPositionFrames = 0;
  let idleActionFrames = 0;
  let simulatedDurationMs = 0;
  const frameCount = Math.ceil(scenario.durationMs / FRAME_DELTA_MS);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = runtime.snapshot;
    const actions = bots.readActions(before, FRAME_DELTA_MS);
    const moveMagnitudeByActor = new Map(
      actions.filter((action) => action.action === "move").map((action) => [
        action.actorId,
        action.magnitude ?? 0,
      ]),
    );
    if (actions.length === 0) idleActionFrames += 1;
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    const after = result.snapshot;
    simulatedDurationMs = frame * FRAME_DELTA_MS;
    awardedScores += result.events.filter((event) =>
      event.type === "score.awarded"
    ).length;
    flagPickups += result.events.filter((event) =>
      event.type === "objective.flagPickedUp"
    ).length;
    flagCaptures += result.events.filter((event) =>
      event.type === "objective.flagCaptured"
    ).length;
    for (const event of result.events) {
      if (
        event.type === "projectile.spawned" &&
        event.sourceActorId &&
        readWeaponId(event.payload) === "basic-autoshoot"
      ) {
        const metric = movementByActor.get(event.sourceActorId);
        if (metric) metric.basicShots += 1;
      }
    }

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
      updateMovementMetric(
        metric,
        previous.position,
        current.position,
        scenario.objectiveTarget?.(after, participant.actorId) ?? null,
        {
          active: previous.lifeState === "active",
          moveMagnitude: moveMagnitudeByActor.get(participant.actorId) ?? null,
        },
      );
    }
    if (after.match?.phase === "ended") break;
  }

  return {
    label: scenario.label,
    modeId: scenario.modeId,
    mapId: scenario.map.id,
    teamSize: scenario.teamSize,
    awardedScores,
    flagPickups,
    flagCaptures,
    invalidPositionFrames,
    idleActionFrames,
    simulatedDurationMs,
    matchEnded: runtime.snapshot.match?.phase === "ended",
    movementByActor,
  };
}

export function runSimulationMatrix(): readonly SimulationSummary[] {
  return createSimulationScenarios().map(runSimulationScenario);
}

export function runOneFlagNavigatorDiagnostics(
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
      goalFramesByKind: new Map(),
      goalSwitchCount: 0,
      lastGoalKind: null,
      dynamicProjectionCount: 0,
      totalProjectionDistance: 0,
      maxProjectionDistance: 0,
      standoffByKey: new Map(),
      longestNoProgressMs: 0,
      currentNoProgressMs: 0,
      previousTargetDistance: null,
      previousTargetKey: "",
      longestSameCellMs: 0,
      currentSameCellMs: 0,
      lastCellKey: null,
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
  const timeline: OneFlagEventTimelineEntry[] = [];
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
    for (const event of result.events) {
      if (event.type === "objective.flagPickedUp") {
        flagPickups += 1;
        timeline.push({
          timeMs: event.timeMs,
          type: "flagPickedUp",
          actorId: event.sourceActorId ?? null,
          teamId: event.teamId ?? null,
        });
      }
      if (event.type === "objective.flagCaptured") {
        flagCaptures += 1;
        timeline.push({
          timeMs: event.timeMs,
          type: "flagCaptured",
          actorId: event.sourceActorId ?? null,
          teamId: event.teamId ?? null,
        });
      }
    }

    for (const participant of participants) {
      const metric = movementByActor.get(participant.actorId);
      const navigator = navigators.get(participant.actorId);
      const controller = controllers.find((candidate) =>
        candidate.debugSnapshot().actorId === participant.actorId
      );
      const previous = before.actors.find((actor) => actor.id === participant.actorId);
      const current = after.actors.find((actor) => actor.id === participant.actorId);
      if (!metric || !navigator || !controller || !previous || !current) {
        throw new Error(`Missing one-flag diagnostic state for ${participant.actorId}.`);
      }
      const controllerDebug = controller.debugSnapshot();
      const navigatorDebug = navigator.debugSnapshot();
      updateMovementMetric(
        metric,
        previous.position,
        current.position,
        neutralFlagHomePosition(after, participant.actorId),
      );
      if (
        !Number.isFinite(current.position.x) ||
        !Number.isFinite(current.position.y)
      ) {
        invalidPositionFrames += 1;
      }
      captureNavigatorDebug(metric, navigatorDebug);
      captureControllerDebug(metric, controllerDebug, current.position);
    }
  }

  const summary: SimulationSummary = {
    label: "One Flag Grand Archive Detailed 2v2",
    modeId: "one-flag",
    mapId: GRAND_ARCHIVE_V2.id,
    teamSize,
    awardedScores,
    flagPickups,
    flagCaptures,
    invalidPositionFrames,
    idleActionFrames,
    simulatedDurationMs: durationMs,
    matchEnded: runtime.snapshot.match?.phase === "ended",
    movementByActor,
  };

  return {
    summary,
    movementByActor,
    blockedGoalFramesByKind,
    blockedGoalFramesByCell,
    takeCenterBlockedFrames,
    chaseBlockedFrames,
    timeline,
    report: formatOneFlagNavigatorReport(
      summary,
      movementByActor,
      blockedGoalFramesByKind,
      blockedGoalFramesByCell,
      timeline,
    ),
  };
}

export function groupProgressByTeam(
  movementByActor: ReadonlyMap<string, BotMovementMetric>,
): Record<ArenaTeamId, {
  bestDistanceReduction: number;
  highestTravelDistance: number;
  longestStationaryMs: number;
  longestMoveIntentStallMs: number;
  intentionalHoldMs: number;
  inactiveMs: number;
  basicShots: number;
}> {
  const grouped = {
    blue: {
      bestDistanceReduction: 0,
      highestTravelDistance: 0,
      longestStationaryMs: 0,
      longestMoveIntentStallMs: 0,
      intentionalHoldMs: 0,
      inactiveMs: 0,
      basicShots: 0,
    },
    red: {
      bestDistanceReduction: 0,
      highestTravelDistance: 0,
      longestStationaryMs: 0,
      longestMoveIntentStallMs: 0,
      intentionalHoldMs: 0,
      inactiveMs: 0,
      basicShots: 0,
    },
  } satisfies Record<ArenaTeamId, {
    bestDistanceReduction: number;
    highestTravelDistance: number;
    longestStationaryMs: number;
    longestMoveIntentStallMs: number;
    intentionalHoldMs: number;
    inactiveMs: number;
    basicShots: number;
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
    target.longestMoveIntentStallMs = Math.max(
      target.longestMoveIntentStallMs,
      metric.longestMoveIntentStallMs,
    );
    target.intentionalHoldMs = Math.max(
      target.intentionalHoldMs,
      metric.intentionalHoldMs,
    );
    target.inactiveMs = Math.max(target.inactiveMs, metric.inactiveMs);
    target.basicShots += metric.basicShots;
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

export function formatMatrixReport(
  summaries: readonly SimulationSummary[],
): string {
  const lines = [
    "Bot Simulation Matrix",
    "scenario | durationMs | ended | scoreEvents | basicShots | flagPickups | flagCaptures | invalidFrames | idleFrames | bestBlueProgress | bestRedProgress | blueTravel | redTravel | blueHoldMs | redHoldMs | blueMoveStallMs | redMoveStallMs",
  ];
  for (const summary of summaries) {
    const byTeam = groupProgressByTeam(summary.movementByActor);
    lines.push([
      summary.label,
      summary.simulatedDurationMs,
      summary.matchEnded,
      summary.awardedScores,
      `${byTeam.blue.basicShots}/${byTeam.red.basicShots}`,
      summary.flagPickups,
      summary.flagCaptures,
      summary.invalidPositionFrames,
      summary.idleActionFrames,
      byTeam.blue.bestDistanceReduction.toFixed(1),
      byTeam.red.bestDistanceReduction.toFixed(1),
      byTeam.blue.highestTravelDistance.toFixed(1),
      byTeam.red.highestTravelDistance.toFixed(1),
      byTeam.blue.intentionalHoldMs,
      byTeam.red.intentionalHoldMs,
      byTeam.blue.longestMoveIntentStallMs,
      byTeam.red.longestMoveIntentStallMs,
    ].join(" | "));
  }
  return lines.join("\n");
}

export function generateBotDiagnosticsReport(): {
  readonly matrix: readonly SimulationSummary[];
  readonly oneFlag: OneFlagNavigatorSummary;
  readonly report: string;
} {
  const matrix = runSimulationMatrix();
  const oneFlag = runOneFlagNavigatorDiagnostics(2, 18_000);
  const report = [
    formatMatrixReport(matrix),
    "",
    oneFlag.report,
  ].join("\n");
  return { matrix, oneFlag, report };
}

export function bothTeamsExceed(
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

function updateMovementMetric(
  metric: BotMovementMetric,
  previousPosition: WorldPosition,
  currentPosition: WorldPosition,
  objectiveTarget: WorldPosition | null,
  intent?: {
    readonly active: boolean;
    readonly moveMagnitude: number | null;
  },
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
  if (intent && !intent.active) {
    metric.inactiveMs += FRAME_DELTA_MS;
    metric.currentMoveIntentStallMs = 0;
  } else if (intent?.moveMagnitude !== null && intent?.moveMagnitude !== undefined) {
    if (intent.moveMagnitude <= 0) {
      metric.intentionalHoldMs += FRAME_DELTA_MS;
      metric.currentMoveIntentStallMs = 0;
    } else if (stepDistance < 1) {
      metric.currentMoveIntentStallMs += FRAME_DELTA_MS;
      metric.longestMoveIntentStallMs = Math.max(
        metric.longestMoveIntentStallMs,
        metric.currentMoveIntentStallMs,
      );
    } else {
      metric.currentMoveIntentStallMs = 0;
    }
  }
  if (objectiveTarget) {
    const objectiveDistance = distance(currentPosition, objectiveTarget);
    metric.initialDistanceToObjective ??= distance(previousPosition, objectiveTarget);
    metric.minimumDistanceToObjective = metric.minimumDistanceToObjective === null
      ? objectiveDistance
      : Math.min(metric.minimumDistanceToObjective, objectiveDistance);
  }
}

function readWeaponId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("weaponId" in payload)) {
    return null;
  }
  const weaponId = (payload as { weaponId?: unknown }).weaponId;
  return typeof weaponId === "string" ? weaponId : null;
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

function captureControllerDebug(
  metric: OneFlagNavigatorMetric,
  debug: OneFlagBotControllerDebugState,
  currentPosition: WorldPosition,
): void {
  if (debug.goalKind) {
    metric.goalFramesByKind.set(
      debug.goalKind,
      (metric.goalFramesByKind.get(debug.goalKind) ?? 0) + 1,
    );
  }
  if (metric.lastGoalKind && debug.goalKind && metric.lastGoalKind !== debug.goalKind) {
    metric.goalSwitchCount += 1;
  }
  metric.lastGoalKind = debug.goalKind;
  if (debug.projectionApplied) {
    metric.dynamicProjectionCount += 1;
    metric.totalProjectionDistance += debug.projectionDistance;
    metric.maxProjectionDistance = Math.max(
      metric.maxProjectionDistance,
      debug.projectionDistance,
    );
  }
  if (debug.standoffKey) {
    metric.standoffByKey.set(
      debug.standoffKey,
      (metric.standoffByKey.get(debug.standoffKey) ?? 0) + 1,
    );
  }
  const cellKey = `${Math.floor(currentPosition.x / V2_BOT_NAVIGATION_CONFIG.cellSize)},${Math.floor(currentPosition.y / V2_BOT_NAVIGATION_CONFIG.cellSize)}`;
  if (metric.lastCellKey === cellKey) {
    metric.currentSameCellMs += FRAME_DELTA_MS;
    metric.longestSameCellMs = Math.max(
      metric.longestSameCellMs,
      metric.currentSameCellMs,
    );
  } else {
    metric.lastCellKey = cellKey;
    metric.currentSameCellMs = 0;
  }
  const targetDistance = debug.navigationTarget
    ? distance(currentPosition, debug.navigationTarget)
    : null;
  if (
    debug.navigationTargetKey &&
    debug.navigationTargetKey === metric.previousTargetKey &&
    targetDistance !== null &&
    metric.previousTargetDistance !== null &&
    targetDistance >= metric.previousTargetDistance - 4
  ) {
    metric.currentNoProgressMs += FRAME_DELTA_MS;
    metric.longestNoProgressMs = Math.max(
      metric.longestNoProgressMs,
      metric.currentNoProgressMs,
    );
  } else {
    metric.currentNoProgressMs = 0;
  }
  metric.previousTargetKey = debug.navigationTargetKey;
  metric.previousTargetDistance = targetDistance;
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

function formatOneFlagNavigatorReport(
  summary: SimulationSummary,
  movementByActor: ReadonlyMap<string, OneFlagNavigatorMetric>,
  blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>,
  blockedGoalFramesByCell: ReadonlyMap<string, number>,
  timeline: readonly OneFlagEventTimelineEntry[],
): string {
  const blockedKindSummary = summarizeCountMap(blockedGoalFramesByKind);
  const blockedCellSummary = summarizeCountMap(blockedGoalFramesByCell, 6);
  const lines = [
    "One Flag Grand Archive Navigator Report",
    `mode=${summary.modeId} map=${summary.mapId} teamSize=${summary.teamSize} flagPickups=${summary.flagPickups} flagCaptures=${summary.flagCaptures} invalidFrames=${summary.invalidPositionFrames} idleFrames=${summary.idleActionFrames}`,
    `blockedGoalKinds=${blockedKindSummary || "none"} blockedGoalCells=${blockedCellSummary || "none"}`,
    `timeline=${timeline.map((entry) => `${entry.timeMs}:${entry.type}:${entry.teamId ?? "none"}:${entry.actorId ?? "none"}`).join(", ") || "none"}`,
    "actor | repaths | pathMisses | goalSwitches | blockedGoalFrames | noProgressMs | sameCellMs | dynamicProjectionCount | avgProjection | maxProjection | standoff | goalKinds",
  ];
  for (const metric of [...movementByActor.values()].sort((left, right) =>
    left.actorId.localeCompare(right.actorId)
  )) {
    const averageProjection = metric.dynamicProjectionCount > 0
      ? metric.totalProjectionDistance / metric.dynamicProjectionCount
      : 0;
    lines.push([
      metric.actorId,
      metric.repathCount,
      metric.pathMissCount,
      metric.goalSwitchCount,
      metric.blockedGoalFrames,
      metric.longestNoProgressMs,
      metric.longestSameCellMs,
      metric.dynamicProjectionCount,
      averageProjection.toFixed(1),
      metric.maxProjectionDistance.toFixed(1),
      summarizeCountMap(metric.standoffByKey, 4) || "none",
      summarizeCountMap(metric.goalFramesByKind, 6) || "none",
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

function distance(left: WorldPosition, right: WorldPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
