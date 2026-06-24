import type { CoreActionIntent } from "../input";
import type { GameModeId } from "../modes";
import type { ArenaParticipant, ArenaTeamSlot } from "../spawning";
import type { WorldMapData, WorldSnapshot } from "../world";
import {
  ClassicCtfBotController,
} from "./ClassicCtfBotController";
import type { ClassicCtfBotRole } from "./ClassicCtfBotDecisionController";
import { OneFlagBotController } from "./OneFlagBotController";
import { TdmBotController } from "./TdmBotController";

export interface BotActionSource {
  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[];
  reset(): void;
}

export class ArenaBotControllerGroup implements BotActionSource {
  constructor(private readonly controllers: readonly BotActionSource[]) {}

  get size(): number {
    return this.controllers.length;
  }

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    return this.controllers.flatMap((controller) =>
      controller.readActions(snapshot, deltaMs)
    );
  }

  reset(): void {
    for (const controller of this.controllers) controller.reset();
  }
}

export function createArenaBotControllerGroup(
  modeId: GameModeId,
  map: WorldMapData,
  participants: readonly ArenaParticipant[],
): ArenaBotControllerGroup {
  return new ArenaBotControllerGroup(participants.map((participant) => {
    if (modeId === "team-deathmatch") {
      return new TdmBotController(
        participant.actorId,
        undefined,
        undefined,
        undefined,
        undefined,
        participant.slot,
      );
    }
    if (modeId === "classic-ctf") {
      return new ClassicCtfBotController(
        participant.actorId,
        classicCtfRoleForSlot(participant.slot),
        map,
      );
    }
    if (modeId === "one-flag") {
      return new OneFlagBotController(participant.actorId, map);
    }
    throw new Error(`Unsupported arena bot mode: ${modeId}.`);
  }));
}

export function classicCtfRoleForSlot(
  slot: ArenaTeamSlot,
): ClassicCtfBotRole {
  if (slot === 2) return "defender";
  if (slot === 3) return "support";
  return "attacker";
}
