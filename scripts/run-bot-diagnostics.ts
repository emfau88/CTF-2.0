import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAllModeMapTeamSizeSmokeScenarios,
  FRAME_DELTA_MS,
  generateBotDiagnosticsReport,
  groupProgressByTeam,
  runClassicCtfOwnFlagStolenScenario,
  runOneFlagEscortCarrierHotzoneScenario,
  runTdmArmorAndWeaponPickupScenario,
  runTdmCombatStandoffScenario,
  runTdmLowHealthVsEnemyScenario,
  runSimulationScenario,
  type BotMovementMetric,
  type ClassicCtfOwnFlagStolenSummary,
  type OneFlagEscortCarrierHotzoneSummary,
  type OneFlagNavigatorMetric,
  type SimulationSummary,
  type TdmCombatStandoffSummary,
  type TdmPickupIntentSummary,
  type TdmLowHealthVsEnemySummary,
} from "../tests/bot-diagnostics";

const diagnostics = generateBotDiagnosticsReport();

process.stdout.write(`${diagnostics.report}\n`);

const artifact = createDiagnosticsArtifact();
const diagnosticsDir = join(process.cwd(), "diagnostics", "bots");
const historyDir = join(diagnosticsDir, "history");

mkdirSync(historyDir, { recursive: true });

const json = `${JSON.stringify(artifact, null, 2)}\n`;
writeFileSync(join(diagnosticsDir, "latest.json"), json, "utf8");
writeFileSync(join(historyDir, `${artifact.runId}.json`), json, "utf8");
writeFileSync(join(diagnosticsDir, "latest.md"), formatMarkdownReport(artifact), "utf8");

type BotIntentMode = "team-deathmatch" | "classic-ctf" | "one-flag";

interface BotIntentSummary {
  readonly actorId: string;
  readonly mode: BotIntentMode;
  readonly framesByIntent: Record<string, number>;
  readonly primaryIntent: string | null;
  readonly totalMeasuredFrames: number;
  readonly unmeasured: readonly string[];
}

function createDiagnosticsArtifact() {
  const timestamp = new Date().toISOString();
  const git = readGitMetadata();
  const matrix = diagnostics.matrix.map(serializeSimulationSummary);
  const fullSmokeMatrix = createAllModeMapTeamSizeSmokeScenarios()
    .map(runSimulationScenario)
    .map(serializeSimulationSummary);
  const scenarioBaselines = {
    oneFlagEscortCarrier: serializeOneFlagEscortCarrierScenario(
      runOneFlagEscortCarrierHotzoneScenario(),
    ),
    classicCtfOwnFlagStolen: serializeClassicCtfOwnFlagStolenScenario(
      runClassicCtfOwnFlagStolenScenario(),
    ),
    tdmLowHealthVsEnemy: serializeTdmLowHealthVsEnemyScenario(
      runTdmLowHealthVsEnemyScenario(),
    ),
    tdmArmorAndWeaponPickup: serializeTdmArmorAndWeaponPickupScenario(
      runTdmArmorAndWeaponPickupScenario(),
    ),
    tdmCombatStandoff: serializeTdmCombatStandoffScenario(
      runTdmCombatStandoffScenario(),
    ),
  };
  const oneFlag = {
    summary: serializeSimulationSummary(diagnostics.oneFlag.summary),
    blockedGoalFramesByKind: mapToRecord(diagnostics.oneFlag.blockedGoalFramesByKind),
    blockedGoalFramesByCell: mapToRecord(diagnostics.oneFlag.blockedGoalFramesByCell),
    takeCenterBlockedFrames: diagnostics.oneFlag.takeCenterBlockedFrames,
    chaseBlockedFrames: diagnostics.oneFlag.chaseBlockedFrames,
    timeline: diagnostics.oneFlag.timeline,
    movementByActor: [...diagnostics.oneFlag.movementByActor.values()].map(
      serializeOneFlagMetric,
    ),
  };
  const warnings = [
    ...collectWarnings(matrix, oneFlag),
    ...collectFullSmokeWarnings(fullSmokeMatrix),
    ...collectScenarioWarnings(scenarioBaselines),
  ];

  return {
    schemaVersion: 1,
    runId: timestamp.replace(/[:.]/g, "-"),
    timestamp,
    git,
    diagnosticsConfig: {
      command: "npm.cmd run bot:diagnostics",
      frameDeltaMs: FRAME_DELTA_MS,
      seed: null,
      seedStatus: "not_available",
      scenarios: diagnostics.matrix.map((summary) => ({
        label: summary.label,
        mode: summary.modeId,
        map: summary.mapId,
        teamSize: summary.teamSize,
        durationMs: summary.simulatedDurationMs,
        frames: Math.ceil(summary.simulatedDurationMs / FRAME_DELTA_MS),
      })),
      detailedOneFlag: {
        mode: diagnostics.oneFlag.summary.modeId,
        map: diagnostics.oneFlag.summary.mapId,
        teamSize: diagnostics.oneFlag.summary.teamSize,
        durationMs: diagnostics.oneFlag.summary.simulatedDurationMs,
        frames: Math.ceil(diagnostics.oneFlag.summary.simulatedDurationMs / FRAME_DELTA_MS),
      },
      scenarioBaselines: {
        oneFlagEscortCarrier: {
          mode: "one-flag",
          map: diagnostics.oneFlag.summary.mapId,
          durationMs: scenarioBaselines.oneFlagEscortCarrier.durationMs,
          frames: Math.ceil(
            scenarioBaselines.oneFlagEscortCarrier.durationMs / FRAME_DELTA_MS,
          ),
        },
        classicCtfOwnFlagStolen: {
          mode: "classic-ctf",
          map: scenarioBaselines.classicCtfOwnFlagStolen.map,
          durationMs: scenarioBaselines.classicCtfOwnFlagStolen.durationMs,
          frames: Math.ceil(
            scenarioBaselines.classicCtfOwnFlagStolen.durationMs / FRAME_DELTA_MS,
          ),
        },
        tdmLowHealthVsEnemy: {
          mode: "team-deathmatch",
          map: scenarioBaselines.tdmLowHealthVsEnemy.map,
          durationMs: scenarioBaselines.tdmLowHealthVsEnemy.durationMs,
          frames: Math.ceil(
            scenarioBaselines.tdmLowHealthVsEnemy.durationMs / FRAME_DELTA_MS,
          ),
        },
        tdmArmorAndWeaponPickup: {
          mode: "team-deathmatch",
          map: scenarioBaselines.tdmArmorAndWeaponPickup.map,
          durationMs: scenarioBaselines.tdmArmorAndWeaponPickup.durationMs,
          frames: Math.ceil(
            scenarioBaselines.tdmArmorAndWeaponPickup.durationMs / FRAME_DELTA_MS,
          ),
        },
        tdmCombatStandoff: {
          mode: "team-deathmatch",
          map: scenarioBaselines.tdmCombatStandoff.map,
          durationMs: scenarioBaselines.tdmCombatStandoff.durationMs,
          frames: Math.ceil(
            scenarioBaselines.tdmCombatStandoff.durationMs / FRAME_DELTA_MS,
          ),
        },
      },
    },
    reports: {
      stdout: diagnostics.report,
      matrix,
      fullSmokeMatrix,
      oneFlag,
      scenarioBaselines,
    },
    warnings,
    passHints: collectPassHints(matrix, fullSmokeMatrix, warnings),
    notMeasured: [
      "damage_caused_per_bot",
      "damage_received_per_bot",
      "reaction_time_to_flag_event",
      "pickup_contention_per_target",
      "stuck_recovery_count",
      "goal_switches_for_tdm_and_classic_ctf",
      "browser_visual_playability",
      "mobile_human_playtest_quality",
      "deterministic_seed_or_replay_file",
    ],
  };
}

function serializeOneFlagEscortCarrierScenario(
  summary: OneFlagEscortCarrierHotzoneSummary,
) {
  return {
    label: "One Flag Grand Archive Escort/Carrier Hotzone",
    mode: "one-flag",
    map: "grand-archive-v2",
    durationMs: summary.durationMs,
    frameDeltaMs: summary.frameDeltaMs,
    blockedGoalFramesByKind: mapToRecord(summary.blockedGoalFramesByKind),
    blockedGoalFramesByCell: mapToRecord(summary.blockedGoalFramesByCell),
    escort: {
      ...summary.escort,
      goalFramesByKind: mapToRecord(summary.escort.goalFramesByKind),
      intent: createIntentSummary(
        summary.escort.actorId,
        "one-flag",
        mapToRecord(summary.escort.goalFramesByKind),
        ["combat_priority_score", "utility_score"],
      ),
    },
    chaser: {
      ...summary.chaser,
      goalFramesByKind: mapToRecord(summary.chaser.goalFramesByKind),
      intent: createIntentSummary(
        summary.chaser.actorId,
        "one-flag",
        mapToRecord(summary.chaser.goalFramesByKind),
        ["combat_priority_score", "utility_score"],
      ),
    },
    passHints: [
      summary.escort.pathMissCount === 0 ? "escort_path_found" : null,
      summary.chaser.pathMissCount === 0 ? "chaser_path_found" : null,
      summary.escort.distanceReduction > 80 ? "escort_progress" : null,
      summary.chaser.distanceReduction > 80 ? "chaser_progress" : null,
    ].filter((hint): hint is string => hint !== null),
  };
}

function serializeClassicCtfOwnFlagStolenScenario(
  summary: ClassicCtfOwnFlagStolenSummary,
) {
  return {
    label: "Classic CTF Flank Switch Own Flag Stolen",
    mode: "classic-ctf",
    map: summary.mapId,
    durationMs: summary.durationMs,
    frameDeltaMs: summary.frameDeltaMs,
    testBot: {
      ...summary.testBot,
      goalFramesByKind: mapToRecord(summary.testBot.goalFramesByKind),
      intent: createIntentSummary(
        summary.testBot.actorId,
        "classic-ctf",
        mapToRecord(summary.testBot.goalFramesByKind),
        ["combat_priority_score", "role_utility_score"],
      ),
    },
    passHints: [
      summary.testBot.pathMissCount === 0 ? "path_found" : null,
      summary.testBot.recoveryFrames > 0 ? "recovery_goal_selected" : null,
      summary.testBot.carrierDistanceReduction > 100 ? "carrier_distance_reduced" : null,
      summary.testBot.attackFlagFrames === 0 ? "no_attack_flag_drift" : null,
    ].filter((hint): hint is string => hint !== null),
  };
}

function serializeTdmLowHealthVsEnemyScenario(
  summary: TdmLowHealthVsEnemySummary,
) {
  return {
    label: "TDM Training Crossing Low Health vs Enemy",
    mode: "team-deathmatch",
    map: summary.mapId,
    durationMs: summary.durationMs,
    frameDeltaMs: summary.frameDeltaMs,
    testBot: {
      ...summary.testBot,
      intentFramesByKind: mapToRecord(summary.testBot.intentFramesByKind),
      intent: createIntentSummary(
        summary.testBot.actorId,
        "team-deathmatch",
        mapToRecord(summary.testBot.intentFramesByKind),
        [
          "seek-armor",
          "seek-weapon",
          "hold-standoff",
          "combat_priority_score",
        ],
      ),
    },
    passHints: [
      summary.testBot.pathMissCount === 0 ? "path_found" : null,
      summary.testBot.pickupTargetFrames > summary.testBot.enemyTargetFrames
        ? "pickup_prioritized"
        : null,
      summary.testBot.healthDistanceReduction > 120 ? "health_distance_reduced" : null,
      summary.testBot.pickupCollected ? "pickup_collected" : null,
      summary.testBot.finalHealth > 24 ? "health_restored" : null,
    ].filter((hint): hint is string => hint !== null),
  };
}

function serializeTdmArmorAndWeaponPickupScenario(
  summary: TdmPickupIntentSummary,
) {
  return {
    label: "TDM Training Crossing Armor/Weapon Pickup Intents",
    mode: "team-deathmatch",
    map: summary.mapId,
    durationMs: summary.durationMs,
    frameDeltaMs: summary.frameDeltaMs,
    cases: summary.cases.map((metric) => ({
      ...metric,
      intentFramesByKind: mapToRecord(metric.intentFramesByKind),
      intent: createIntentSummary(
        metric.actorId,
        "team-deathmatch",
        mapToRecord(metric.intentFramesByKind),
        ["utility_score", "pickup_contention"],
      ),
    })),
    passHints: [
      summary.cases.every((metric) => metric.pathMissCount === 0)
        ? "paths_found"
        : null,
      summary.cases.every((metric) =>
        (metric.intentFramesByKind.get(metric.expectedIntent) ?? 0) > 0
      )
        ? "expected_intents_seen"
        : null,
      summary.cases.every((metric) => metric.pickupCollected)
        ? "pickups_collected"
        : null,
    ].filter((hint): hint is string => hint !== null),
  };
}

function serializeTdmCombatStandoffScenario(
  summary: TdmCombatStandoffSummary,
) {
  return {
    label: "TDM Training Crossing Combat Standoff",
    mode: "team-deathmatch",
    map: summary.mapId,
    durationMs: summary.durationMs,
    frameDeltaMs: summary.frameDeltaMs,
    testBot: {
      ...summary.testBot,
      intentFramesByKind: mapToRecord(summary.testBot.intentFramesByKind),
      intent: createIntentSummary(
        summary.testBot.actorId,
        "team-deathmatch",
        mapToRecord(summary.testBot.intentFramesByKind),
        ["combat_accuracy", "damage_traded"],
      ),
    },
    passHints: [
      summary.testBot.pathMissCount === 0 ? "path_not_needed_or_found" : null,
      summary.testBot.holdFrames > summary.testBot.movingFrames
        ? "hold_dominates_move"
        : null,
      summary.testBot.travelDistance < 48 ? "position_held" : null,
    ].filter((hint): hint is string => hint !== null),
  };
}

function createIntentSummary(
  actorId: string,
  mode: BotIntentMode,
  framesByIntent: Record<string, number>,
  unmeasured: readonly string[],
): BotIntentSummary {
  const measuredFrames = Object.fromEntries(
    Object.entries(framesByIntent).filter(([, frames]) => frames > 0),
  );
  const primaryIntent = Object.entries(measuredFrames)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ??
    null;
  return {
    actorId,
    mode,
    framesByIntent: measuredFrames,
    primaryIntent,
    totalMeasuredFrames: Object.values(measuredFrames).reduce(
      (total, frames) => total + frames,
      0,
    ),
    unmeasured,
  };
}

function serializeSimulationSummary(summary: SimulationSummary) {
  const byTeam = groupProgressByTeam(summary.movementByActor);
  return {
    label: summary.label,
    mode: summary.modeId,
    map: summary.mapId,
    teamSize: summary.teamSize,
    durationMs: summary.simulatedDurationMs,
    frames: Math.ceil(summary.simulatedDurationMs / FRAME_DELTA_MS),
    matchEnded: summary.matchEnded,
    scoreEvents: summary.awardedScores,
    flagPickups: summary.flagPickups,
    flagCaptures: summary.flagCaptures,
    invalidPositionFrames: summary.invalidPositionFrames,
    idleActionFrames: summary.idleActionFrames,
    clusteredFrames: summary.clusteredFrames,
    teamMetrics: byTeam,
    actors: [...summary.movementByActor.values()].map(serializeMovementMetric),
  };
}

function serializeMovementMetric(metric: BotMovementMetric) {
  return {
    actorId: metric.actorId,
    teamId: metric.teamId,
    initialDistanceToObjective: metric.initialDistanceToObjective,
    minimumDistanceToObjective: metric.minimumDistanceToObjective,
    bestDistanceReduction:
      metric.initialDistanceToObjective !== null &&
        metric.minimumDistanceToObjective !== null
        ? metric.initialDistanceToObjective - metric.minimumDistanceToObjective
        : null,
    totalTravelDistance: metric.totalTravelDistance,
    longestStationaryMs: metric.longestStationaryMs,
    intentionalHoldMs: metric.intentionalHoldMs,
    inactiveMs: metric.inactiveMs,
    longestMoveIntentStallMs: metric.longestMoveIntentStallMs,
    basicShots: metric.basicShots,
    pickupCollections: metric.pickupCollections,
    specialWeaponShots: metric.specialWeaponShots,
  };
}

function serializeOneFlagMetric(metric: OneFlagNavigatorMetric) {
  return {
    ...serializeMovementMetric(metric),
    repathCount: metric.repathCount,
    pathMissCount: metric.pathMissCount,
    blockedGoalFrames: metric.blockedGoalFrames,
    jumpFrames: metric.jumpFrames,
    longestPathLength: metric.longestPathLength,
    longestPathMissStreak: metric.longestPathMissStreak,
    lastGoalCell: metric.lastGoalCell,
    distinctGoalCells: [...metric.distinctGoalCells],
    repathReasons: mapToRecord(metric.repathReasons),
    goalFramesByKind: mapToRecord(metric.goalFramesByKind),
    goalSwitchCount: metric.goalSwitchCount,
    lastGoalKind: metric.lastGoalKind,
    dynamicProjectionCount: metric.dynamicProjectionCount,
    totalProjectionDistance: metric.totalProjectionDistance,
    maxProjectionDistance: metric.maxProjectionDistance,
    standoffByKey: mapToRecord(metric.standoffByKey),
    longestNoProgressMs: metric.longestNoProgressMs,
    longestSameCellMs: metric.longestSameCellMs,
  };
}

function readGitMetadata(): {
  readonly branch: string | null;
  readonly commit: string | null;
  readonly dirty: boolean | null;
  readonly statusShort: string | null;
} {
  const branch = readGit(["branch", "--show-current"]);
  const commit = readGit(["rev-parse", "--short", "HEAD"]);
  const statusShort = readGit(["status", "--short"]);
  return {
    branch: branch || null,
    commit: commit || null,
    dirty: statusShort === null ? null : statusShort.length > 0,
    statusShort,
  };
}

function readGit(args: readonly string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function collectWarnings(
  matrix: ReturnType<typeof serializeSimulationSummary>[],
  oneFlag: {
    readonly chaseBlockedFrames: number;
    readonly takeCenterBlockedFrames: number;
    readonly blockedGoalFramesByKind: Record<string, number>;
  },
): readonly string[] {
  const warnings: string[] = [];
  for (const summary of matrix) {
    if (summary.invalidPositionFrames > 0) {
      warnings.push(`${summary.label}: invalidPositionFrames=${summary.invalidPositionFrames}`);
    }
    if (summary.idleActionFrames > 0) {
      warnings.push(`${summary.label}: idleActionFrames=${summary.idleActionFrames}`);
    }
    if (summary.mode === "team-deathmatch" && summary.teamSize === 4) {
      const clusterLimit = Math.ceil(summary.frames * .4);
      if (
        summary.clusteredFrames.blue >= clusterLimit ||
        summary.clusteredFrames.red >= clusterLimit
      ) {
        warnings.push(
          `${summary.label}: clusteredFrames near/above 40% threshold ` +
            `(${summary.clusteredFrames.blue}/${summary.clusteredFrames.red})`,
        );
      }
    }
  }
  if (oneFlag.takeCenterBlockedFrames > 0) {
    warnings.push(`One Flag Grand Archive: take-center-flag blocked frames=${oneFlag.takeCenterBlockedFrames}`);
  }
  if (oneFlag.chaseBlockedFrames > 0) {
    warnings.push(`One Flag Grand Archive: chase-enemy-carrier blocked frames=${oneFlag.chaseBlockedFrames}`);
  }
  for (const [kind, count] of Object.entries(oneFlag.blockedGoalFramesByKind)) {
    if (count > 0) warnings.push(`One Flag Grand Archive: blocked ${kind} frames=${count}`);
  }
  return warnings;
}

function collectScenarioWarnings(scenarios: {
  readonly oneFlagEscortCarrier: ReturnType<typeof serializeOneFlagEscortCarrierScenario>;
  readonly classicCtfOwnFlagStolen: ReturnType<typeof serializeClassicCtfOwnFlagStolenScenario>;
  readonly tdmLowHealthVsEnemy: ReturnType<typeof serializeTdmLowHealthVsEnemyScenario>;
  readonly tdmArmorAndWeaponPickup: ReturnType<typeof serializeTdmArmorAndWeaponPickupScenario>;
  readonly tdmCombatStandoff: ReturnType<typeof serializeTdmCombatStandoffScenario>;
}): readonly string[] {
  const warnings: string[] = [];
  if (scenarios.oneFlagEscortCarrier.escort.pathMissCount > 0) {
    warnings.push(
      `${scenarios.oneFlagEscortCarrier.label}: escort pathMissCount=${scenarios.oneFlagEscortCarrier.escort.pathMissCount}`,
    );
  }
  if (scenarios.oneFlagEscortCarrier.chaser.pathMissCount > 0) {
    warnings.push(
      `${scenarios.oneFlagEscortCarrier.label}: chaser pathMissCount=${scenarios.oneFlagEscortCarrier.chaser.pathMissCount}`,
    );
  }
  if (scenarios.oneFlagEscortCarrier.escort.distanceReduction <= 80) {
    warnings.push(
      `${scenarios.oneFlagEscortCarrier.label}: escort distanceReduction=${scenarios.oneFlagEscortCarrier.escort.distanceReduction.toFixed(1)}`,
    );
  }
  if (scenarios.oneFlagEscortCarrier.chaser.distanceReduction <= 80) {
    warnings.push(
      `${scenarios.oneFlagEscortCarrier.label}: chaser distanceReduction=${scenarios.oneFlagEscortCarrier.chaser.distanceReduction.toFixed(1)}`,
    );
  }
  if (scenarios.classicCtfOwnFlagStolen.testBot.pathMissCount > 0) {
    warnings.push(
      `${scenarios.classicCtfOwnFlagStolen.label}: pathMissCount=${scenarios.classicCtfOwnFlagStolen.testBot.pathMissCount}`,
    );
  }
  if (scenarios.classicCtfOwnFlagStolen.testBot.recoveryFrames <= 0) {
    warnings.push(`${scenarios.classicCtfOwnFlagStolen.label}: no recovery goal frames`);
  }
  if (scenarios.classicCtfOwnFlagStolen.testBot.carrierDistanceReduction <= 100) {
    warnings.push(
      `${scenarios.classicCtfOwnFlagStolen.label}: carrierDistanceReduction=${scenarios.classicCtfOwnFlagStolen.testBot.carrierDistanceReduction.toFixed(1)}`,
    );
  }
  if (scenarios.tdmLowHealthVsEnemy.testBot.pathMissCount > 0) {
    warnings.push(
      `${scenarios.tdmLowHealthVsEnemy.label}: pathMissCount=${scenarios.tdmLowHealthVsEnemy.testBot.pathMissCount}`,
    );
  }
  if (
    scenarios.tdmLowHealthVsEnemy.testBot.pickupTargetFrames <=
      scenarios.tdmLowHealthVsEnemy.testBot.enemyTargetFrames
  ) {
    warnings.push(
      `${scenarios.tdmLowHealthVsEnemy.label}: pickupTargetFrames=${scenarios.tdmLowHealthVsEnemy.testBot.pickupTargetFrames}, enemyTargetFrames=${scenarios.tdmLowHealthVsEnemy.testBot.enemyTargetFrames}`,
    );
  }
  if (!scenarios.tdmLowHealthVsEnemy.testBot.pickupCollected) {
    warnings.push(`${scenarios.tdmLowHealthVsEnemy.label}: health pickup not collected`);
  }
  for (const metric of scenarios.tdmArmorAndWeaponPickup.cases) {
    if (metric.pathMissCount > 0) {
      warnings.push(
        `${scenarios.tdmArmorAndWeaponPickup.label} ${metric.label}: pathMissCount=${metric.pathMissCount}`,
      );
    }
    if ((metric.intentFramesByKind[metric.expectedIntent] ?? 0) <= 0) {
      warnings.push(
        `${scenarios.tdmArmorAndWeaponPickup.label} ${metric.label}: expected intent ${metric.expectedIntent} not observed`,
      );
    }
    if (!metric.pickupCollected) {
      warnings.push(
        `${scenarios.tdmArmorAndWeaponPickup.label} ${metric.label}: pickup not collected`,
      );
    }
  }
  if (scenarios.tdmCombatStandoff.testBot.holdFrames <= scenarios.tdmCombatStandoff.testBot.movingFrames) {
    warnings.push(
      `${scenarios.tdmCombatStandoff.label}: holdFrames=${scenarios.tdmCombatStandoff.testBot.holdFrames}, movingFrames=${scenarios.tdmCombatStandoff.testBot.movingFrames}`,
    );
  }
  if (scenarios.tdmCombatStandoff.testBot.travelDistance >= 48) {
    warnings.push(
      `${scenarios.tdmCombatStandoff.label}: travelDistance=${scenarios.tdmCombatStandoff.testBot.travelDistance.toFixed(1)}`,
    );
  }
  return warnings;
}

function collectFullSmokeWarnings(
  fullSmokeMatrix: ReturnType<typeof serializeSimulationSummary>[],
): readonly string[] {
  const warnings: string[] = [];
  for (const summary of fullSmokeMatrix) {
    const teamMetrics = summary.teamMetrics;
    if (summary.invalidPositionFrames > 0) {
      warnings.push(`${summary.label}: smoke invalidPositionFrames=${summary.invalidPositionFrames}`);
    }
    if (summary.idleActionFrames > 0) {
      warnings.push(`${summary.label}: smoke idleActionFrames=${summary.idleActionFrames}`);
    }
    if (
      teamMetrics.blue.highestTravelDistance <= 60 ||
      teamMetrics.red.highestTravelDistance <= 60
    ) {
      warnings.push(
        `${summary.label}: smoke low travel ${teamMetrics.blue.highestTravelDistance.toFixed(1)}/${teamMetrics.red.highestTravelDistance.toFixed(1)}`,
      );
    }
  }
  return warnings;
}

function collectPassHints(
  matrix: ReturnType<typeof serializeSimulationSummary>[],
  fullSmokeMatrix: ReturnType<typeof serializeSimulationSummary>[],
  warnings: readonly string[],
): readonly string[] {
  const passHints = [
    "diagnostics_completed",
    "stdout_report_generated",
    "json_artifact_written",
    "markdown_artifact_written",
  ];
  if (matrix.every((summary) => summary.invalidPositionFrames === 0)) {
    passHints.push("no_invalid_positions_in_matrix");
  }
  if (matrix.every((summary) => summary.idleActionFrames === 0)) {
    passHints.push("no_idle_action_frames_in_matrix");
  }
  if (fullSmokeMatrix.length === 60) {
    passHints.push("full_mode_map_team_smoke_matrix_60_cases");
  }
  if (
    fullSmokeMatrix.every((summary) =>
      summary.invalidPositionFrames === 0 &&
      summary.idleActionFrames === 0 &&
      summary.teamMetrics.blue.highestTravelDistance > 60 &&
      summary.teamMetrics.red.highestTravelDistance > 60
    )
  ) {
    passHints.push("full_smoke_matrix_passed");
  }
  if (warnings.length === 0) passHints.push("no_hotzone_warnings");
  return passHints;
}

function formatMarkdownReport(
  artifact: ReturnType<typeof createDiagnosticsArtifact>,
): string {
  const lines = [
    "# Bot Diagnostics Baseline",
    "",
    `Timestamp: ${artifact.timestamp}`,
    `Git: branch=${artifact.git.branch ?? "not_available"}, commit=${artifact.git.commit ?? "not_available"}, dirty=${artifact.git.dirty ?? "not_available"}`,
    "",
    "## Kurzurteil",
    "",
    artifact.warnings.length === 0
      ? "Die Diagnose lief ohne automatisch markierte Hotzones durch. Das ist eine technische Baseline, kein Gameplay-Qualitaetsbeweis."
      : `Die Diagnose lief durch, markiert aber ${artifact.warnings.length} Hotzone-Hinweis(e).`,
    "",
    "## Modus-/Map-Matrix",
    "",
    "| Scenario | Mode | Map | Team | Duration | Score | Pickups | Special | Invalid | Idle |",
    "|---|---|---|---:|---:|---:|---|---|---:|---:|",
  ];

  for (const summary of artifact.reports.matrix) {
    lines.push([
      summary.label,
      summary.mode,
      summary.map,
      `${summary.teamSize}v${summary.teamSize}`,
      `${summary.durationMs}ms`,
      String(summary.scoreEvents),
      `${summary.teamMetrics.blue.pickupCollections}/${summary.teamMetrics.red.pickupCollections}`,
      `${summary.teamMetrics.blue.specialWeaponShots}/${summary.teamMetrics.red.specialWeaponShots}`,
      String(summary.invalidPositionFrames),
      String(summary.idleActionFrames),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  lines.push(
    "",
    "## Full Smoke Matrix",
    "",
    `- Kombinationen: ${artifact.reports.fullSmokeMatrix.length}`,
    `- Modi: ${uniqueCount(artifact.reports.fullSmokeMatrix.map((summary) => summary.mode))}`,
    `- Maps: ${uniqueCount(artifact.reports.fullSmokeMatrix.map((summary) => summary.map))}`,
    `- Teamgroessen: ${uniqueCount(artifact.reports.fullSmokeMatrix.map((summary) => `${summary.teamSize}v${summary.teamSize}`))}`,
    `- Invalid Position Frames: ${sumNumbers(artifact.reports.fullSmokeMatrix.map((summary) => summary.invalidPositionFrames))}`,
    `- Idle Action Frames: ${sumNumbers(artifact.reports.fullSmokeMatrix.map((summary) => summary.idleActionFrames))}`,
    "",
    "Diese Matrix prueft Startbarkeit, gueltige Positionen, Bot-Aktionen und Mindestbewegung fuer alle Modi, registrierten V2-Maps und Teamgroessen. Sie ist kein finaler Gameplay-Qualitaetsbeweis.",
    "",
    "## Auffaellige Hotzones",
    "",
    ...(artifact.warnings.length > 0
      ? artifact.warnings.map((warning) => `- ${warning}`)
      : ["- Keine automatisch markierten Hotzones in diesem Lauf."]),
    "",
    "## Wichtigste Metriken",
    "",
    `- Frame-Delta: ${artifact.diagnosticsConfig.frameDeltaMs}ms`,
    `- Matrix-Szenarien: ${artifact.reports.matrix.length}`,
    `- One-Flag Detail: ${artifact.reports.oneFlag.summary.map}, ${artifact.reports.oneFlag.summary.teamSize}v${artifact.reports.oneFlag.summary.teamSize}`,
    `- One-Flag chaseBlockedFrames: ${artifact.reports.oneFlag.chaseBlockedFrames}`,
    `- One-Flag takeCenterBlockedFrames: ${artifact.reports.oneFlag.takeCenterBlockedFrames}`,
    "",
    "## Szenario-Baselines",
    "",
    "| Scenario | Mode | Map | Duration | Primary intent | Primary check | Path misses | Progress | Result |",
    "|---|---|---|---:|---|---|---:|---:|---|",
    [
      artifact.reports.scenarioBaselines.oneFlagEscortCarrier.label,
      artifact.reports.scenarioBaselines.oneFlagEscortCarrier.mode,
      artifact.reports.scenarioBaselines.oneFlagEscortCarrier.map,
      `${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.durationMs}ms`,
      `escort=${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.escort.intent.primaryIntent ?? "none"}, chaser=${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.chaser.intent.primaryIntent ?? "none"}`,
      "escort/chaser progress",
      `${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.escort.pathMissCount}/${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.chaser.pathMissCount}`,
      `${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.escort.distanceReduction.toFixed(1)}/${artifact.reports.scenarioBaselines.oneFlagEscortCarrier.chaser.distanceReduction.toFixed(1)}`,
      artifact.reports.scenarioBaselines.oneFlagEscortCarrier.passHints.join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    [
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.label,
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.mode,
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.map,
      `${artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.durationMs}ms`,
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.testBot.intent.primaryIntent ?? "none",
      "recover own flag",
      String(artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.testBot.pathMissCount),
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.testBot.carrierDistanceReduction.toFixed(1),
      artifact.reports.scenarioBaselines.classicCtfOwnFlagStolen.passHints.join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    [
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.label,
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.mode,
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.map,
      `${artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.durationMs}ms`,
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.testBot.intent.primaryIntent ?? "none",
      "seek health before fight",
      String(artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.testBot.pathMissCount),
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.testBot.healthDistanceReduction.toFixed(1),
      artifact.reports.scenarioBaselines.tdmLowHealthVsEnemy.passHints.join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    [
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.label,
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.mode,
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.map,
      `${artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.durationMs}ms`,
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.cases
        .map((metric) => `${metric.label}=${metric.intent.primaryIntent ?? "none"}`)
        .join(", "),
      "seek armor/weapon pickups",
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.cases
        .map((metric) => `${metric.label}:${metric.pathMissCount}`)
        .join(", "),
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.cases
        .map((metric) => `${metric.label}:${metric.pickupDistanceReduction.toFixed(1)}`)
        .join(", "),
      artifact.reports.scenarioBaselines.tdmArmorAndWeaponPickup.passHints.join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    [
      artifact.reports.scenarioBaselines.tdmCombatStandoff.label,
      artifact.reports.scenarioBaselines.tdmCombatStandoff.mode,
      artifact.reports.scenarioBaselines.tdmCombatStandoff.map,
      `${artifact.reports.scenarioBaselines.tdmCombatStandoff.durationMs}ms`,
      artifact.reports.scenarioBaselines.tdmCombatStandoff.testBot.intent.primaryIntent ?? "none",
      "hold ideal combat range",
      String(artifact.reports.scenarioBaselines.tdmCombatStandoff.testBot.pathMissCount),
      `hold:${artifact.reports.scenarioBaselines.tdmCombatStandoff.testBot.holdFrames}, move:${artifact.reports.scenarioBaselines.tdmCombatStandoff.testBot.movingFrames}`,
      artifact.reports.scenarioBaselines.tdmCombatStandoff.passHints.join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    "",
    "### Intent-Sichtbarkeit",
    "",
    "- One Flag und Classic CTF nutzen aktuell die vorhandenen Goal-Frames als Intent-Baseline.",
    "- TDM nutzt aktuell Controller-Debug-Intents wie `seek-health`, `hold-standoff` und `fight-enemy`.",
    "- Noch nicht gemessen: Utility-Scores, Zielbindungsbonus, Combat-Prioritaet und Team-Claims.",
    "",
    "## Aktuell NICHT gemessen",
    "",
    ...artifact.notMeasured.map((item) => `- ${item}`),
    "",
  );

  return `${lines.join("\n")}\n`;
}

function mapToRecord<TValue>(
  map: ReadonlyMap<string, TValue>,
): Record<string, TValue> {
  return Object.fromEntries(map.entries());
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function sumNumbers(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
