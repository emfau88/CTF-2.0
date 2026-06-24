import {
  ClassicCtfMode,
  ClassicCtfBotController,
  ClassicCtfBotDecisionController,
  createArenaBotControllerGroup,
  createArenaRoster,
  createClassicCtfWorldState,
  createPickupState,
  createWorldSnapshot,
  createOneFlagWorldState,
  createTeamDeathmatchWorldState,
  FLANK_SWITCH_V2,
  GameplayCoreRuntime,
  GRAND_ARCHIVE_V2,
  GridBotNavigator,
  OneFlagMode,
  OneFlagBotController,
  OneFlagBotDecisionController,
  TdmBotController,
  TeamDeathmatchMode,
  TRAINING_CROSSING_V2,
  V2_ARENA_PICKUP_PARITY_CONFIG,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_BOT_NAVIGATION_CONFIG,
  type ArenaTeamId,
  type ArenaTeamSize,
  type ClassicCtfBotGoalKind,
  type GameMode,
  type GameModeId,
  type GameEvent,
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
  pickupCollections: number;
  specialWeaponShots: number;
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
  readonly clusteredFrames: Readonly<Record<ArenaTeamId, number>>;
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

export interface OneFlagEscortCarrierHotzoneActorMetric {
  readonly actorId: string;
  readonly role: "escort" | "chaser";
  readonly goalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>;
  readonly blockedGoalFrames: number;
  readonly pathMissCount: number;
  readonly longestNoProgressMs: number;
  readonly longestSameCellMs: number;
  readonly dynamicProjectionCount: number;
  readonly initialDistance: number;
  readonly minimumDistance: number;
  readonly finalDistance: number;
  readonly distanceReduction: number;
}

export interface OneFlagEscortCarrierHotzoneSummary {
  readonly durationMs: number;
  readonly frameDeltaMs: number;
  readonly blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>;
  readonly blockedGoalFramesByCell: ReadonlyMap<string, number>;
  readonly escort: OneFlagEscortCarrierHotzoneActorMetric;
  readonly chaser: OneFlagEscortCarrierHotzoneActorMetric;
  readonly report: string;
}

export interface ClassicCtfOwnFlagStolenMetric {
  readonly actorId: string;
  readonly carrierActorId: string;
  readonly goalFramesByKind: ReadonlyMap<ClassicCtfBotGoalKind, number>;
  readonly pathMissCount: number;
  readonly longestNoProgressMs: number;
  readonly longestSameCellMs: number;
  readonly initialCarrierDistance: number;
  readonly minimumCarrierDistance: number;
  readonly finalCarrierDistance: number;
  readonly carrierDistanceReduction: number;
  readonly travelDistance: number;
  readonly attackFlagFrames: number;
  readonly recoveryFrames: number;
}

export interface ClassicCtfOwnFlagStolenSummary {
  readonly durationMs: number;
  readonly frameDeltaMs: number;
  readonly mapId: string;
  readonly testBot: ClassicCtfOwnFlagStolenMetric;
  readonly report: string;
}

export interface TdmLowHealthVsEnemyMetric {
  readonly actorId: string;
  readonly enemyActorId: string;
  readonly healthPickupId: string;
  readonly pickupTargetFrames: number;
  readonly enemyTargetFrames: number;
  readonly pathMissCount: number;
  readonly longestNoProgressMs: number;
  readonly longestSameCellMs: number;
  readonly initialHealthDistance: number;
  readonly minimumHealthDistance: number;
  readonly finalHealthDistance: number;
  readonly healthDistanceReduction: number;
  readonly initialEnemyDistance: number;
  readonly finalEnemyDistance: number;
  readonly travelDistance: number;
  readonly pickupCollected: boolean;
  readonly finalHealth: number;
}

export interface TdmLowHealthVsEnemySummary {
  readonly durationMs: number;
  readonly frameDeltaMs: number;
  readonly mapId: string;
  readonly testBot: TdmLowHealthVsEnemyMetric;
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
  const teamSizes: readonly ArenaTeamSize[] = [1, 2, 3, 4];
  return [
    ...teamSizes.map((teamSize): ScenarioDefinition => ({
      label: `TDM Training Crossing ${teamSize}v${teamSize}`,
      modeId: "team-deathmatch",
      map: TRAINING_CROSSING_V2,
      teamSize,
      durationMs: 18_000,
      createMode: () => new TeamDeathmatchMode(),
      createWorld: (map, size) => createTeamDeathmatchWorldState(map, { teamSize: size }),
      objectiveTarget: nearestEnemyPosition,
    })),
    ...teamSizes.map((teamSize): ScenarioDefinition => ({
      label: `Classic CTF Flank Switch ${teamSize}v${teamSize}`,
      modeId: "classic-ctf",
      map: FLANK_SWITCH_V2,
      teamSize,
      durationMs: 22_000,
      createMode: () => new ClassicCtfMode(FLANK_SWITCH_V2),
      createWorld: (map, size) => createClassicCtfWorldState(map, { teamSize: size }),
      objectiveTarget: enemyFlagHomePosition,
    })),
    ...teamSizes.map((teamSize): ScenarioDefinition => ({
      label: `One Flag Grand Archive ${teamSize}v${teamSize}`,
      modeId: "one-flag",
      map: GRAND_ARCHIVE_V2,
      teamSize,
      durationMs: 18_000,
      createMode: () => new OneFlagMode(GRAND_ARCHIVE_V2),
      createWorld: (map, size) => createOneFlagWorldState(map, { teamSize: size }),
      objectiveTarget: neutralFlagHomePosition,
    })),
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
      pickupCollections: 0,
      specialWeaponShots: 0,
      intentionalHoldMs: 0,
      inactiveMs: 0,
      longestMoveIntentStallMs: 0,
      currentMoveIntentStallMs: 0,
      basicShots: 0,
      pickupCollections: 0,
      specialWeaponShots: 0,
    }]),
  );

  let awardedScores = 0;
  let flagPickups = 0;
  let flagCaptures = 0;
  let invalidPositionFrames = 0;
  let idleActionFrames = 0;
  let simulatedDurationMs = 0;
  const clusteredFrames: Record<ArenaTeamId, number> = { blue: 0, red: 0 };
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
    for (const teamId of ["blue", "red"] as const) {
      if (teamIsClustered(after, teamId)) clusteredFrames[teamId] += 1;
    }
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
      if (event.type === "pickup.collected" && event.targetActorId) {
        const metric = movementByActor.get(event.targetActorId);
        if (metric) metric.pickupCollections += 1;
      }
      if (
        (event.type === "weapon.rocketFired" ||
          event.type === "weapon.railFired" ||
          event.type === "weapon.whipFired") &&
        event.sourceActorId
      ) {
        const metric = movementByActor.get(event.sourceActorId);
        if (metric) metric.specialWeaponShots += 1;
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
    clusteredFrames,
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
      intentionalHoldMs: 0,
      inactiveMs: 0,
      longestMoveIntentStallMs: 0,
      currentMoveIntentStallMs: 0,
      basicShots: 0,
      pickupCollections: 0,
      specialWeaponShots: 0,
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
        { active: previous.lifeState === "active", moveMagnitude: null },
      );
      if (
        !Number.isFinite(current.position.x) ||
        !Number.isFinite(current.position.y)
      ) {
        invalidPositionFrames += 1;
      }
      if (previous.lifeState === "active") {
        captureNavigatorDebug(metric, navigatorDebug);
        captureControllerDebug(metric, controllerDebug, current.position);
      } else {
        resetInactiveControllerMetrics(metric);
      }
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
    clusteredFrames: { blue: 0, red: 0 },
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

export function runOneFlagEscortCarrierHotzoneScenario(
  durationMs = 3_400,
): OneFlagEscortCarrierHotzoneSummary {
  let worldRef: WorldState | null = null;
  const mode = new OneFlagMode(GRAND_ARCHIVE_V2);
  const runtime = new GameplayCoreRuntime({
    mode,
    createWorld: () => {
      worldRef = createOneFlagWorldState(GRAND_ARCHIVE_V2, { teamSize: 2 });
      return worldRef;
    },
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  if (!worldRef) throw new Error("Missing one-flag escort hotzone world.");
  const world = worldRef;
  configureEscortCarrierHotzoneWorld(world);

  const decision = new OneFlagBotDecisionController(GRAND_ARCHIVE_V2);
  const escortNavigator = new GridBotNavigator();
  const chaserNavigator = new GridBotNavigator();
  const escortController = new OneFlagBotController(
    "red-player",
    GRAND_ARCHIVE_V2,
    undefined,
    escortNavigator,
  );
  const chaserController = new OneFlagBotController(
    "blue-player",
    GRAND_ARCHIVE_V2,
    undefined,
    chaserNavigator,
  );
  const escortMetric = createHotzoneMetric("red-player", "escort");
  const chaserMetric = createHotzoneMetric("blue-player", "chaser");
  const blockedGoalFramesByKind = new Map<OneFlagBotGoalKind, number>();
  const blockedGoalFramesByCell = new Map<string, number>();
  const frameCount = Math.ceil(durationMs / FRAME_DELTA_MS);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = createWorldSnapshot(world);
    captureGoalDiagnostics(
      before,
      [escortMetric.actorId, chaserMetric.actorId],
      decision,
      blockedGoalFramesByKind,
      blockedGoalFramesByCell,
      () => {},
    );
    const actions = [
      ...escortController.readActions(before, FRAME_DELTA_MS),
      ...chaserController.readActions(before, FRAME_DELTA_MS),
    ];
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    captureHotzoneFrameMetric(
      escortMetric,
      result.snapshot,
      escortController.debugSnapshot(),
      escortNavigator.debugSnapshot(),
    );
    captureHotzoneFrameMetric(
      chaserMetric,
      result.snapshot,
      chaserController.debugSnapshot(),
      chaserNavigator.debugSnapshot(),
    );
  }

  const escort = finalizeHotzoneMetric(escortMetric);
  const chaser = finalizeHotzoneMetric(chaserMetric);
  const report = formatEscortCarrierHotzoneReport(
    durationMs,
    blockedGoalFramesByKind,
    blockedGoalFramesByCell,
    escort,
    chaser,
  );
  return {
    durationMs,
    frameDeltaMs: FRAME_DELTA_MS,
    blockedGoalFramesByKind,
    blockedGoalFramesByCell,
    escort,
    chaser,
    report,
  };
}

export function runClassicCtfOwnFlagStolenScenario(
  durationMs = 1_360,
): ClassicCtfOwnFlagStolenSummary {
  let worldRef: WorldState | null = null;
  const mode = new ClassicCtfMode(FLANK_SWITCH_V2);
  const runtime = new GameplayCoreRuntime({
    mode,
    createWorld: () => {
      worldRef = createClassicCtfWorldState(FLANK_SWITCH_V2, { teamSize: 2 });
      return worldRef;
    },
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  if (!worldRef) throw new Error("Missing classic CTF own-flag-stolen world.");
  const world = worldRef;
  configureClassicCtfOwnFlagStolenWorld(world);

  const testBotId = "red-player";
  const carrierActorId = "blue-player";
  const decision = new ClassicCtfBotDecisionController("attacker", FLANK_SWITCH_V2);
  const navigator = new GridBotNavigator();
  const controller = new ClassicCtfBotController(
    testBotId,
    "attacker",
    FLANK_SWITCH_V2,
    undefined,
    navigator,
  );
  const metric = createClassicCtfOwnFlagStolenMetric(testBotId, carrierActorId);
  const frameCount = Math.ceil(durationMs / FRAME_DELTA_MS);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = createWorldSnapshot(world);
    captureClassicCtfOwnFlagStolenDecision(metric, before, decision);
    const previousPosition = actorPosition(before, testBotId);
    const actions = controller.readActions(before, FRAME_DELTA_MS);
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    captureClassicCtfOwnFlagStolenFrame(
      metric,
      result.snapshot,
      previousPosition,
      navigator.debugSnapshot(),
    );
  }

  const finalized = finalizeClassicCtfOwnFlagStolenMetric(metric);
  return {
    durationMs,
    frameDeltaMs: FRAME_DELTA_MS,
    mapId: FLANK_SWITCH_V2.id,
    testBot: finalized,
    report: formatClassicCtfOwnFlagStolenReport(durationMs, finalized),
  };
}

export function runTdmLowHealthVsEnemyScenario(
  durationMs = 1_700,
): TdmLowHealthVsEnemySummary {
  let worldRef: WorldState | null = null;
  const runtime = new GameplayCoreRuntime({
    mode: new TeamDeathmatchMode(),
    createWorld: () => {
      worldRef = createTeamDeathmatchWorldState(TRAINING_CROSSING_V2);
      return worldRef;
    },
    allowManualPrimaryFire: false,
  });
  runtime.initialize();
  if (!worldRef) throw new Error("Missing TDM low-health scenario world.");
  const world = worldRef;
  configureTdmLowHealthVsEnemyWorld(world);

  const testBotId = "red-player";
  const enemyActorId = "blue-player";
  const healthPickupId = "scenario-health";
  const navigator = new GridBotNavigator();
  const controller = new TdmBotController(
    testBotId,
    enemyActorId,
    undefined,
    navigator,
  );
  const metric = createTdmLowHealthVsEnemyMetric(
    testBotId,
    enemyActorId,
    healthPickupId,
  );
  const frameCount = Math.ceil(durationMs / FRAME_DELTA_MS);
  let snapshot = createWorldSnapshot(world);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const before = snapshot;
    const previousPosition = actorPosition(before, testBotId);
    const actions = controller.readActions(before, FRAME_DELTA_MS);
    const result = runtime.advance({
      sequence: frame,
      timeMs: frame * FRAME_DELTA_MS,
      deltaMs: FRAME_DELTA_MS,
      actions,
    });
    captureTdmLowHealthVsEnemyFrame(
      metric,
      result.snapshot,
      previousPosition,
      navigator.debugSnapshot(),
      result.events,
    );
    snapshot = result.snapshot;
  }

  const finalized = finalizeTdmLowHealthVsEnemyMetric(metric);
  return {
    durationMs,
    frameDeltaMs: FRAME_DELTA_MS,
    mapId: TRAINING_CROSSING_V2.id,
    testBot: finalized,
    report: formatTdmLowHealthVsEnemyReport(durationMs, finalized),
  };
}

function resetInactiveControllerMetrics(metric: OneFlagNavigatorMetric): void {
  metric.currentSameCellMs = 0;
  metric.currentNoProgressMs = 0;
  metric.lastCellKey = null;
  metric.previousTargetKey = null;
  metric.previousTargetDistance = null;
}

interface MutableHotzoneActorMetric {
  actorId: string;
  role: "escort" | "chaser";
  goalFramesByKind: Map<OneFlagBotGoalKind, number>;
  blockedGoalFrames: number;
  pathMissCount: number;
  dynamicProjectionCount: number;
  initialDistance: number | null;
  minimumDistance: number | null;
  finalDistance: number | null;
  previousTargetKey: string;
  previousTargetDistance: number | null;
  currentNoProgressMs: number;
  longestNoProgressMs: number;
  lastCellKey: string | null;
  currentSameCellMs: number;
  longestSameCellMs: number;
}

function configureEscortCarrierHotzoneWorld(world: WorldState): void {
  const redCarrier = requiredActor(world, "red-player-2");
  const redEscort = requiredActor(world, "red-player");
  const blueChaser = requiredActor(world, "blue-player");
  const blueSupport = requiredActor(world, "blue-player-2");
  redCarrier.position = { x: 1257, y: 367 };
  redCarrier.velocity = { x: 0, y: 0 };
  redCarrier.lastSafePosition = { ...redCarrier.position };
  redEscort.position = { x: 900, y: 410 };
  redEscort.velocity = { x: 0, y: 0 };
  redEscort.lastSafePosition = { ...redEscort.position };
  blueChaser.position = { x: 1750, y: 210 };
  blueChaser.velocity = { x: 0, y: 0 };
  blueChaser.lastSafePosition = { ...blueChaser.position };
  blueSupport.position = { x: 2355, y: 410 };
  blueSupport.velocity = { x: 0, y: 0 };
  blueSupport.lastSafePosition = { ...blueSupport.position };

  for (const actor of [redCarrier, redEscort, blueChaser, blueSupport]) {
    actor.lifeState = "active";
    actor.health = actor.maxHealth;
    actor.armor = 0;
    actor.jump.height = 0;
    actor.jump.grounded = true;
    actor.weapons.rocketAmmo = 0;
    actor.weapons.railAmmo = 0;
    actor.weapons.whipAmmo = 0;
  }

  const flag = world.objectives.find((objective) =>
    objective.kind === "neutral-flag"
  );
  if (!flag) throw new Error("Missing neutral flag for escort hotzone scenario.");
  world.objectives = world.objectives.map((objective) =>
    objective.id === flag.id
      ? {
        ...objective,
        position: {
          x: redCarrier.position.x,
          y: redCarrier.position.y - 24,
        },
        state: {
          ...objective.state,
          status: "carried",
          interactingActorId: redCarrier.id,
        },
      }
      : objective
  );
}

function requiredActor(
  world: WorldState,
  actorId: string,
) {
  const actor = world.actors.find((candidate) => candidate.id === actorId);
  if (!actor) throw new Error(`Missing scenario actor: ${actorId}.`);
  return actor;
}

function actorPosition(
  snapshot: WorldSnapshot,
  actorId: string,
): WorldPosition {
  const actor = snapshot.actors.find((candidate) => candidate.id === actorId);
  if (!actor) throw new Error(`Missing snapshot actor: ${actorId}.`);
  return { ...actor.position };
}

function createHotzoneMetric(
  actorId: string,
  role: "escort" | "chaser",
): MutableHotzoneActorMetric {
  return {
    actorId,
    role,
    goalFramesByKind: new Map(),
    blockedGoalFrames: 0,
    pathMissCount: 0,
    dynamicProjectionCount: 0,
    initialDistance: null,
    minimumDistance: null,
    finalDistance: null,
    previousTargetKey: "",
    previousTargetDistance: null,
    currentNoProgressMs: 0,
    longestNoProgressMs: 0,
    lastCellKey: null,
    currentSameCellMs: 0,
    longestSameCellMs: 0,
  };
}

function captureHotzoneFrameMetric(
  metric: MutableHotzoneActorMetric,
  snapshot: WorldSnapshot,
  controllerDebug: OneFlagBotControllerDebugState,
  navigatorDebug: GridBotNavigatorDebugState,
): void {
  const actor = snapshot.actors.find((candidate) =>
    candidate.id === metric.actorId
  );
  if (!actor || actor.lifeState !== "active") return;
  if (controllerDebug.goalKind) {
    metric.goalFramesByKind.set(
      controllerDebug.goalKind,
      (metric.goalFramesByKind.get(controllerDebug.goalKind) ?? 0) + 1,
    );
  }
  if (navigatorDebug.goalBlocked) metric.blockedGoalFrames += 1;
  if (!navigatorDebug.pathFound) metric.pathMissCount += 1;
  if (controllerDebug.projectionApplied) metric.dynamicProjectionCount += 1;

  const distanceTarget = controllerDebug.navigationTarget ??
    controllerDebug.goalTarget;
  const targetDistance = distanceTarget
    ? distance(actor.position, distanceTarget)
    : null;
  if (targetDistance !== null) {
    metric.initialDistance ??= targetDistance;
    metric.minimumDistance = metric.minimumDistance === null
      ? targetDistance
      : Math.min(metric.minimumDistance, targetDistance);
    metric.finalDistance = targetDistance;
  }
  if (
    controllerDebug.navigationTargetKey &&
    controllerDebug.navigationTargetKey === metric.previousTargetKey &&
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
  metric.previousTargetKey = controllerDebug.navigationTargetKey;
  metric.previousTargetDistance = targetDistance;

  const cellKey = `${Math.floor(actor.position.x / V2_BOT_NAVIGATION_CONFIG.cellSize)},${Math.floor(actor.position.y / V2_BOT_NAVIGATION_CONFIG.cellSize)}`;
  if (cellKey === metric.lastCellKey) {
    metric.currentSameCellMs += FRAME_DELTA_MS;
    metric.longestSameCellMs = Math.max(
      metric.longestSameCellMs,
      metric.currentSameCellMs,
    );
  } else {
    metric.lastCellKey = cellKey;
    metric.currentSameCellMs = 0;
  }
}

function finalizeHotzoneMetric(
  metric: MutableHotzoneActorMetric,
): OneFlagEscortCarrierHotzoneActorMetric {
  const initialDistance = metric.initialDistance ?? 0;
  const minimumDistance = metric.minimumDistance ?? initialDistance;
  const finalDistance = metric.finalDistance ?? minimumDistance;
  return {
    actorId: metric.actorId,
    role: metric.role,
    goalFramesByKind: metric.goalFramesByKind,
    blockedGoalFrames: metric.blockedGoalFrames,
    pathMissCount: metric.pathMissCount,
    longestNoProgressMs: metric.longestNoProgressMs,
    longestSameCellMs: metric.longestSameCellMs,
    dynamicProjectionCount: metric.dynamicProjectionCount,
    initialDistance,
    minimumDistance,
    finalDistance,
    distanceReduction: initialDistance - minimumDistance,
  };
}

function formatEscortCarrierHotzoneReport(
  durationMs: number,
  blockedGoalFramesByKind: ReadonlyMap<OneFlagBotGoalKind, number>,
  blockedGoalFramesByCell: ReadonlyMap<string, number>,
  escort: OneFlagEscortCarrierHotzoneActorMetric,
  chaser: OneFlagEscortCarrierHotzoneActorMetric,
): string {
  return [
    "One Flag Grand Archive Escort/Carrier Hotzone Scenario",
    `durationMs=${durationMs} blockedGoalKinds=${summarizeCountMap(blockedGoalFramesByKind) || "none"} blockedGoalCells=${summarizeCountMap(blockedGoalFramesByCell, 8) || "none"}`,
    "actor | role | pathMisses | blockedGoalFrames | noProgressMs | sameCellMs | dynamicProjectionCount | initialDistance | minDistance | finalDistance | reduction | goalKinds",
    [escort, chaser].map((metric) => [
      metric.actorId,
      metric.role,
      metric.pathMissCount,
      metric.blockedGoalFrames,
      metric.longestNoProgressMs,
      metric.longestSameCellMs,
      metric.dynamicProjectionCount,
      metric.initialDistance.toFixed(1),
      metric.minimumDistance.toFixed(1),
      metric.finalDistance.toFixed(1),
      metric.distanceReduction.toFixed(1),
      summarizeCountMap(metric.goalFramesByKind, 4) || "none",
    ].join(" | ")).join("\n"),
  ].join("\n");
}

interface MutableClassicCtfOwnFlagStolenMetric {
  actorId: string;
  carrierActorId: string;
  goalFramesByKind: Map<ClassicCtfBotGoalKind, number>;
  pathMissCount: number;
  previousCarrierDistance: number | null;
  initialCarrierDistance: number | null;
  minimumCarrierDistance: number | null;
  finalCarrierDistance: number | null;
  currentNoProgressMs: number;
  longestNoProgressMs: number;
  lastCellKey: string | null;
  currentSameCellMs: number;
  longestSameCellMs: number;
  travelDistance: number;
}

function configureClassicCtfOwnFlagStolenWorld(world: WorldState): void {
  const redTestBot = requiredActor(world, "red-player");
  const redSupport = requiredActor(world, "red-player-2");
  const blueCarrier = requiredActor(world, "blue-player");
  const blueSupport = requiredActor(world, "blue-player-2");
  redTestBot.position = { x: 760, y: 410 };
  redSupport.position = { x: 150, y: 315 };
  blueCarrier.position = { x: 420, y: 410 };
  blueSupport.position = { x: 2350, y: 410 };
  for (const actor of [redTestBot, redSupport, blueCarrier, blueSupport]) {
    actor.velocity = { x: 0, y: 0 };
    actor.lastSafePosition = { ...actor.position };
    actor.lifeState = "active";
    actor.health = actor.maxHealth;
    actor.armor = 0;
    actor.jump.height = 0;
    actor.jump.grounded = true;
    actor.weapons.rocketAmmo = 0;
    actor.weapons.railAmmo = 0;
    actor.weapons.whipAmmo = 0;
  }

  const redFlag = world.objectives.find((objective) =>
    objective.id === "red-flag"
  );
  if (!redFlag) throw new Error("Missing red flag for own-flag-stolen scenario.");
  world.objectives = world.objectives.map((objective) =>
    objective.id === redFlag.id
      ? {
        ...objective,
        position: {
          x: blueCarrier.position.x,
          y: blueCarrier.position.y - 24,
        },
        state: {
          ...objective.state,
          status: "carried",
          interactingActorId: blueCarrier.id,
        },
      }
      : objective
  );
}

function createClassicCtfOwnFlagStolenMetric(
  actorId: string,
  carrierActorId: string,
): MutableClassicCtfOwnFlagStolenMetric {
  return {
    actorId,
    carrierActorId,
    goalFramesByKind: new Map(),
    pathMissCount: 0,
    previousCarrierDistance: null,
    initialCarrierDistance: null,
    minimumCarrierDistance: null,
    finalCarrierDistance: null,
    currentNoProgressMs: 0,
    longestNoProgressMs: 0,
    lastCellKey: null,
    currentSameCellMs: 0,
    longestSameCellMs: 0,
    travelDistance: 0,
  };
}

function captureClassicCtfOwnFlagStolenDecision(
  metric: MutableClassicCtfOwnFlagStolenMetric,
  snapshot: WorldSnapshot,
  decision: ClassicCtfBotDecisionController,
): void {
  const actor = snapshot.actors.find((candidate) =>
    candidate.id === metric.actorId && candidate.lifeState === "active"
  );
  if (!actor) return;
  const goal = decision.chooseGoal(actor, snapshot);
  metric.goalFramesByKind.set(
    goal.kind,
    (metric.goalFramesByKind.get(goal.kind) ?? 0) + 1,
  );
}

function captureClassicCtfOwnFlagStolenFrame(
  metric: MutableClassicCtfOwnFlagStolenMetric,
  snapshot: WorldSnapshot,
  previousPosition: WorldPosition,
  navigatorDebug: GridBotNavigatorDebugState,
): void {
  const actor = snapshot.actors.find((candidate) =>
    candidate.id === metric.actorId
  );
  const carrier = snapshot.actors.find((candidate) =>
    candidate.id === metric.carrierActorId
  );
  if (!actor || !carrier || actor.lifeState !== "active") return;
  metric.travelDistance += distance(previousPosition, actor.position);
  if (!navigatorDebug.pathFound) metric.pathMissCount += 1;

  const carrierDistance = distance(actor.position, carrier.position);
  metric.initialCarrierDistance ??= distance(previousPosition, carrier.position);
  metric.minimumCarrierDistance = metric.minimumCarrierDistance === null
    ? carrierDistance
    : Math.min(metric.minimumCarrierDistance, carrierDistance);
  metric.finalCarrierDistance = carrierDistance;
  if (
    metric.previousCarrierDistance !== null &&
    carrierDistance >= metric.previousCarrierDistance - 4
  ) {
    metric.currentNoProgressMs += FRAME_DELTA_MS;
    metric.longestNoProgressMs = Math.max(
      metric.longestNoProgressMs,
      metric.currentNoProgressMs,
    );
  } else {
    metric.currentNoProgressMs = 0;
  }
  metric.previousCarrierDistance = carrierDistance;

  const cellKey = `${Math.floor(actor.position.x / V2_BOT_NAVIGATION_CONFIG.cellSize)},${Math.floor(actor.position.y / V2_BOT_NAVIGATION_CONFIG.cellSize)}`;
  if (cellKey === metric.lastCellKey) {
    metric.currentSameCellMs += FRAME_DELTA_MS;
    metric.longestSameCellMs = Math.max(
      metric.longestSameCellMs,
      metric.currentSameCellMs,
    );
  } else {
    metric.lastCellKey = cellKey;
    metric.currentSameCellMs = 0;
  }
}

function finalizeClassicCtfOwnFlagStolenMetric(
  metric: MutableClassicCtfOwnFlagStolenMetric,
): ClassicCtfOwnFlagStolenMetric {
  const initialCarrierDistance = metric.initialCarrierDistance ?? 0;
  const minimumCarrierDistance = metric.minimumCarrierDistance ??
    initialCarrierDistance;
  const finalCarrierDistance = metric.finalCarrierDistance ??
    minimumCarrierDistance;
  const recoveryFrames =
    metric.goalFramesByKind.get("recover-own-flag") ?? 0;
  const attackFlagFrames =
    metric.goalFramesByKind.get("attack-flag") ?? 0;
  return {
    actorId: metric.actorId,
    carrierActorId: metric.carrierActorId,
    goalFramesByKind: metric.goalFramesByKind,
    pathMissCount: metric.pathMissCount,
    longestNoProgressMs: metric.longestNoProgressMs,
    longestSameCellMs: metric.longestSameCellMs,
    initialCarrierDistance,
    minimumCarrierDistance,
    finalCarrierDistance,
    carrierDistanceReduction: initialCarrierDistance - minimumCarrierDistance,
    travelDistance: metric.travelDistance,
    attackFlagFrames,
    recoveryFrames,
  };
}

function formatClassicCtfOwnFlagStolenReport(
  durationMs: number,
  metric: ClassicCtfOwnFlagStolenMetric,
): string {
  return [
    "Classic CTF Flank Switch Own Flag Stolen Scenario",
    `durationMs=${durationMs} actor=${metric.actorId} carrier=${metric.carrierActorId}`,
    "actor | carrier | pathMisses | noProgressMs | sameCellMs | initialCarrierDistance | minCarrierDistance | finalCarrierDistance | reduction | travel | recoveryFrames | attackFlagFrames | goalKinds",
    [
      metric.actorId,
      metric.carrierActorId,
      metric.pathMissCount,
      metric.longestNoProgressMs,
      metric.longestSameCellMs,
      metric.initialCarrierDistance.toFixed(1),
      metric.minimumCarrierDistance.toFixed(1),
      metric.finalCarrierDistance.toFixed(1),
      metric.carrierDistanceReduction.toFixed(1),
      metric.travelDistance.toFixed(1),
      metric.recoveryFrames,
      metric.attackFlagFrames,
      summarizeCountMap(metric.goalFramesByKind, 6) || "none",
    ].join(" | "),
  ].join("\n");
}

interface MutableTdmLowHealthVsEnemyMetric {
  actorId: string;
  enemyActorId: string;
  healthPickupId: string;
  pickupTargetFrames: number;
  enemyTargetFrames: number;
  pathMissCount: number;
  previousHealthDistance: number | null;
  initialHealthDistance: number | null;
  minimumHealthDistance: number | null;
  finalHealthDistance: number | null;
  initialEnemyDistance: number | null;
  finalEnemyDistance: number | null;
  currentNoProgressMs: number;
  longestNoProgressMs: number;
  lastCellKey: string | null;
  currentSameCellMs: number;
  longestSameCellMs: number;
  travelDistance: number;
  pickupCollected: boolean;
  finalHealth: number;
}

function configureTdmLowHealthVsEnemyWorld(world: WorldState): void {
  const testBot = requiredActor(world, "red-player");
  const enemy = requiredActor(world, "blue-player");
  testBot.position = { x: 340, y: 410 };
  enemy.position = { x: 760, y: 410 };
  for (const actor of [testBot, enemy]) {
    actor.velocity = { x: 0, y: 0 };
    actor.lastSafePosition = { ...actor.position };
    actor.lifeState = "active";
    actor.armor = 0;
    actor.jump.height = 0;
    actor.jump.grounded = true;
    actor.weapons.rocketAmmo = 0;
    actor.weapons.railAmmo = 0;
    actor.weapons.whipAmmo = 0;
  }
  testBot.health = 24;
  enemy.health = enemy.maxHealth;
  world.pickups = [createPickupState({
    id: "scenario-health",
    type: "health",
    position: { x: 520, y: 410 },
  }, V2_ARENA_PICKUP_PARITY_CONFIG)];
}

function createTdmLowHealthVsEnemyMetric(
  actorId: string,
  enemyActorId: string,
  healthPickupId: string,
): MutableTdmLowHealthVsEnemyMetric {
  return {
    actorId,
    enemyActorId,
    healthPickupId,
    pickupTargetFrames: 0,
    enemyTargetFrames: 0,
    pathMissCount: 0,
    previousHealthDistance: null,
    initialHealthDistance: null,
    minimumHealthDistance: null,
    finalHealthDistance: null,
    initialEnemyDistance: null,
    finalEnemyDistance: null,
    currentNoProgressMs: 0,
    longestNoProgressMs: 0,
    lastCellKey: null,
    currentSameCellMs: 0,
    longestSameCellMs: 0,
    travelDistance: 0,
    pickupCollected: false,
    finalHealth: 0,
  };
}

function captureTdmLowHealthVsEnemyFrame(
  metric: MutableTdmLowHealthVsEnemyMetric,
  snapshot: WorldSnapshot,
  previousPosition: WorldPosition,
  navigatorDebug: GridBotNavigatorDebugState,
  events: readonly GameEvent[],
): void {
  const actor = snapshot.actors.find((candidate) =>
    candidate.id === metric.actorId
  );
  const enemy = snapshot.actors.find((candidate) =>
    candidate.id === metric.enemyActorId
  );
  const pickup = snapshot.pickups.find((candidate) =>
    candidate.id === metric.healthPickupId
  );
  if (!actor || !enemy || actor.lifeState !== "active") return;
  metric.travelDistance += distance(previousPosition, actor.position);
  metric.finalHealth = actor.health;
  if (navigatorDebug.targetKey === `pickup:${metric.healthPickupId}`) {
    metric.pickupTargetFrames += 1;
  } else if (navigatorDebug.targetKey.includes(metric.enemyActorId)) {
    metric.enemyTargetFrames += 1;
  }
  if (!navigatorDebug.pathFound) metric.pathMissCount += 1;
  metric.pickupCollected ||= events.some((event) =>
    event.type === "pickup.collected" &&
    event.targetActorId === metric.actorId &&
    event.payload &&
    typeof event.payload === "object" &&
    "pickupId" in event.payload &&
    event.payload.pickupId === metric.healthPickupId
  );

  const healthPosition = pickup?.position ?? { x: 520, y: 410 };
  const healthDistance = distance(actor.position, healthPosition);
  const enemyDistance = distance(actor.position, enemy.position);
  metric.initialHealthDistance ??= distance(previousPosition, healthPosition);
  metric.minimumHealthDistance = metric.minimumHealthDistance === null
    ? healthDistance
    : Math.min(metric.minimumHealthDistance, healthDistance);
  metric.finalHealthDistance = healthDistance;
  metric.initialEnemyDistance ??= distance(previousPosition, enemy.position);
  metric.finalEnemyDistance = enemyDistance;
  if (
    !metric.pickupCollected &&
    metric.previousHealthDistance !== null &&
    healthDistance >= metric.previousHealthDistance - 4
  ) {
    metric.currentNoProgressMs += FRAME_DELTA_MS;
    metric.longestNoProgressMs = Math.max(
      metric.longestNoProgressMs,
      metric.currentNoProgressMs,
    );
  } else {
    metric.currentNoProgressMs = 0;
  }
  metric.previousHealthDistance = healthDistance;

  const cellKey = `${Math.floor(actor.position.x / V2_BOT_NAVIGATION_CONFIG.cellSize)},${Math.floor(actor.position.y / V2_BOT_NAVIGATION_CONFIG.cellSize)}`;
  if (cellKey === metric.lastCellKey) {
    metric.currentSameCellMs += FRAME_DELTA_MS;
    metric.longestSameCellMs = Math.max(
      metric.longestSameCellMs,
      metric.currentSameCellMs,
    );
  } else {
    metric.lastCellKey = cellKey;
    metric.currentSameCellMs = 0;
  }
}

function finalizeTdmLowHealthVsEnemyMetric(
  metric: MutableTdmLowHealthVsEnemyMetric,
): TdmLowHealthVsEnemyMetric {
  const initialHealthDistance = metric.initialHealthDistance ?? 0;
  const minimumHealthDistance = metric.minimumHealthDistance ??
    initialHealthDistance;
  const finalHealthDistance = metric.finalHealthDistance ??
    minimumHealthDistance;
  return {
    actorId: metric.actorId,
    enemyActorId: metric.enemyActorId,
    healthPickupId: metric.healthPickupId,
    pickupTargetFrames: metric.pickupTargetFrames,
    enemyTargetFrames: metric.enemyTargetFrames,
    pathMissCount: metric.pathMissCount,
    longestNoProgressMs: metric.longestNoProgressMs,
    longestSameCellMs: metric.longestSameCellMs,
    initialHealthDistance,
    minimumHealthDistance,
    finalHealthDistance,
    healthDistanceReduction: initialHealthDistance - minimumHealthDistance,
    initialEnemyDistance: metric.initialEnemyDistance ?? 0,
    finalEnemyDistance: metric.finalEnemyDistance ?? 0,
    travelDistance: metric.travelDistance,
    pickupCollected: metric.pickupCollected,
    finalHealth: metric.finalHealth,
  };
}

function formatTdmLowHealthVsEnemyReport(
  durationMs: number,
  metric: TdmLowHealthVsEnemyMetric,
): string {
  return [
    "TDM Training Crossing Low Health vs Enemy Scenario",
    `durationMs=${durationMs} actor=${metric.actorId} enemy=${metric.enemyActorId} healthPickup=${metric.healthPickupId}`,
    "actor | enemy | pickupTargetFrames | enemyTargetFrames | pathMisses | noProgressMs | sameCellMs | initialHealthDistance | minHealthDistance | finalHealthDistance | healthReduction | initialEnemyDistance | finalEnemyDistance | travel | pickupCollected | finalHealth",
    [
      metric.actorId,
      metric.enemyActorId,
      metric.pickupTargetFrames,
      metric.enemyTargetFrames,
      metric.pathMissCount,
      metric.longestNoProgressMs,
      metric.longestSameCellMs,
      metric.initialHealthDistance.toFixed(1),
      metric.minimumHealthDistance.toFixed(1),
      metric.finalHealthDistance.toFixed(1),
      metric.healthDistanceReduction.toFixed(1),
      metric.initialEnemyDistance.toFixed(1),
      metric.finalEnemyDistance.toFixed(1),
      metric.travelDistance.toFixed(1),
      metric.pickupCollected,
      metric.finalHealth,
    ].join(" | "),
  ].join("\n");
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
  pickupCollections: number;
  specialWeaponShots: number;
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
      pickupCollections: 0,
      specialWeaponShots: 0,
    },
    red: {
      bestDistanceReduction: 0,
      highestTravelDistance: 0,
      longestStationaryMs: 0,
      longestMoveIntentStallMs: 0,
      intentionalHoldMs: 0,
      inactiveMs: 0,
      basicShots: 0,
      pickupCollections: 0,
      specialWeaponShots: 0,
    },
  } satisfies Record<ArenaTeamId, {
    bestDistanceReduction: number;
    highestTravelDistance: number;
    longestStationaryMs: number;
    longestMoveIntentStallMs: number;
    intentionalHoldMs: number;
    inactiveMs: number;
    basicShots: number;
    pickupCollections: number;
    specialWeaponShots: number;
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
    target.pickupCollections += metric.pickupCollections;
    target.specialWeaponShots += metric.specialWeaponShots;
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
    "scenario | durationMs | ended | scoreEvents | basicShots | pickups | specialShots | clusteredFrames | flagPickups | flagCaptures | invalidFrames | idleFrames | bestBlueProgress | bestRedProgress | blueTravel | redTravel | blueHoldMs | redHoldMs | blueMoveStallMs | redMoveStallMs",
  ];
  for (const summary of summaries) {
    const byTeam = groupProgressByTeam(summary.movementByActor);
    lines.push([
      summary.label,
      summary.simulatedDurationMs,
      summary.matchEnded,
      summary.awardedScores,
      `${byTeam.blue.basicShots}/${byTeam.red.basicShots}`,
      `${byTeam.blue.pickupCollections}/${byTeam.red.pickupCollections}`,
      `${byTeam.blue.specialWeaponShots}/${byTeam.red.specialWeaponShots}`,
      `${summary.clusteredFrames.blue}/${summary.clusteredFrames.red}`,
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

function teamIsClustered(
  snapshot: WorldSnapshot,
  teamId: ArenaTeamId,
): boolean {
  const actors = snapshot.actors.filter((actor) =>
    actor.teamId === teamId && actor.lifeState === "active"
  );
  return actors.some((actor) =>
    actors.filter((candidate) =>
      distance(actor.position, candidate.position) <= 170
    ).length >= 3
  );
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
