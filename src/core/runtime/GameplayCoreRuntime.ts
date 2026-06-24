import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import { fireBasicAttack, type BasicAutoAttackConfig } from "../combat";
import {
  DiagnosticArenaMode,
  type GameMode,
  type ModeHudState,
} from "../modes";
import {
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
} from "../movement";
import {
  createWorldSnapshot,
  type WorldSnapshot,
  type WorldState,
} from "../world";
import type { CoreFrameResult, CoreRuntime } from "./coreRuntime";
import { createDiagnosticWorldState } from "./createDiagnosticWorldState";
import { dispatchModeEvents } from "./dispatchModeEvents";
import { createMatchStatsState, recordMatchEvents } from "../stats";
import { clampRuntimeDeltaMs } from "./GameplayRuntimeTiming";
import { updateActorWorld } from "./updateActorWorld";
import { updateCombatWorld } from "./updateCombatWorld";
import { updateDiagnosticControlledActor } from "./updateDiagnosticControlledActor";
import { updateDiagnosticModeInput } from "./updateDiagnosticModeInput";
import { updatePickupWorld } from "./updatePickupWorld";

export interface GameplayCoreRuntimeOptions {
  readonly mode?: GameMode;
  readonly createWorld?: () => WorldState;
  readonly basicAutoAttack?: BasicAutoAttackConfig;
  readonly manualBasicAttackActorIds?: readonly string[];
  readonly autoBasicAttackActorIds?: readonly string[];
  readonly allowManualPrimaryFire?: boolean;
}

export class GameplayCoreRuntime implements CoreRuntime {
  private readonly mode: GameMode;
  private readonly createWorld: () => WorldState;
  private readonly basicAutoAttack?: BasicAutoAttackConfig;
  private readonly manualBasicAttackActorIds: ReadonlySet<string>;
  private readonly autoBasicAttackActorIds?: readonly string[];
  private readonly allowManualPrimaryFire: boolean;
  private world: WorldState;
  private currentSnapshot: WorldSnapshot;
  private currentEvents: readonly GameEvent[] = [];

  constructor(options: GameplayCoreRuntimeOptions = {}) {
    this.mode = options.mode ?? new DiagnosticArenaMode();
    this.createWorld = options.createWorld ?? createDiagnosticWorldState;
    this.basicAutoAttack = options.basicAutoAttack;
    this.manualBasicAttackActorIds = new Set(
      options.manualBasicAttackActorIds ?? [],
    );
    this.autoBasicAttackActorIds = options.autoBasicAttackActorIds;
    this.allowManualPrimaryFire = options.allowManualPrimaryFire ?? true;
    this.world = this.createWorld();
    this.world.matchStats = createMatchStatsState(this.world.actors);
    this.currentSnapshot = createWorldSnapshot(this.world);
  }

  get snapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  initialize(): CoreFrameResult {
    this.world = this.createWorld();
    this.world.matchStats = createMatchStatsState(this.world.actors);
    this.currentEvents = this.mode.initialize(this.world);
    return this.createFrameResult();
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    const deltaMs = clampRuntimeDeltaMs(input.deltaMs);
    const sanitizedInput = {
      ...input,
      deltaMs,
    };
    if (isMatchEnded(this.world) && hasRestartAction(input)) {
      return this.initialize();
    }
    if (isMatchEnded(this.world)) {
      this.currentEvents = [];
      return this.createFrameResult();
    }

    this.world.timeMs += deltaMs;
    const events: GameEvent[] = [];
    events.push(...this.mode.update(this.world, deltaMs));
    if (isMatchEnded(this.world)) {
      this.currentEvents = events;
      return this.createFrameResult();
    }

    updateActorWorld(this.world, this.mode, deltaMs, events);
    if (isMatchEnded(this.world)) {
      return this.finishFrame(events);
    }
    updateDiagnosticModeInput(this.world, this.mode, sanitizedInput, events);
    this.updateControlledActor(sanitizedInput, events);
    if (isMatchEnded(this.world)) {
      return this.finishFrame(events);
    }
    updateCombatWorld(
      this.world,
      this.mode,
      deltaMs,
      events,
      this.basicAutoAttack,
      this.autoBasicAttackActorIds,
    );
    if (isMatchEnded(this.world)) {
      return this.finishFrame(events);
    }
    updatePickupWorld(this.world, this.mode, deltaMs, events);

    return this.finishFrame(events);
  }

  private updateControlledActor(
    input: CoreInputFrame,
    events: GameEvent[],
  ): void {
    const defaultActorId = this.world.actors[0]?.id;
    for (const actor of this.world.actors) {
      const actorInput = inputForActor(input, actor.id, defaultActorId);
      if (actor.lifeState === "falling") {
        const collision = applyWorldCollision(
          actor,
          this.world.geometry,
          actorInput.deltaMs,
          this.world.timeMs,
          V2_COLLISION_GROUNDWORK_CONFIG,
        );
        dispatchModeEvents(this.mode, this.world, events, collision.events);
      } else if (actor.lifeState === "active") {
        dispatchModeEvents(
          this.mode,
          this.world,
          events,
          updateDiagnosticControlledActor(
            this.world,
            actor,
            actorInput,
            this.allowManualPrimaryFire,
          ),
        );
        if (
          this.basicAutoAttack &&
          this.manualBasicAttackActorIds.has(actor.id) &&
          actorInput.actions.some((intent) =>
            intent.action === "firePrimary" && intent.phase === "held"
          )
        ) {
          dispatchModeEvents(
            this.mode,
            this.world,
            events,
            fireBasicAttack(this.world, actor, this.basicAutoAttack),
          );
        }
      }
    }
  }

  private createFrameResult(): CoreFrameResult {
    recordMatchEvents(
      this.world.matchStats,
      this.world.actors,
      this.currentEvents,
    );
    this.currentSnapshot = createWorldSnapshot(this.world);
    return {
      snapshot: this.currentSnapshot,
      events: this.currentEvents,
      hudState: this.createHudState(),
    };
  }

  private finishFrame(events: readonly GameEvent[]): CoreFrameResult {
    this.currentEvents = events;
    return this.createFrameResult();
  }

  private createHudState(): ModeHudState {
    return this.mode.getHudState(this.currentSnapshot);
  }
}

function isMatchEnded(world: WorldState): boolean {
  return world.match?.phase === "ended";
}

function hasRestartAction(input: CoreInputFrame): boolean {
  return input.actions.some((intent) =>
    intent.action === "restartMatch" && intent.phase === "pressed"
  );
}

function inputForActor(
  input: CoreInputFrame,
  actorId: string,
  defaultActorId: string | undefined,
): CoreInputFrame {
  return {
    ...input,
    actions: input.actions.filter((intent) =>
      intent.actorId === actorId ||
      (!intent.actorId && actorId === defaultActorId)
    ),
  };
}
