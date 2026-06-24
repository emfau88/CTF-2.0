import type { ActorState } from "../actors";
import type { GameEvent } from "../events";

export interface MatchStatEntry {
  readonly actorId: string;
  readonly teamId: string | null;
  kills: number;
  deaths: number;
  flagPickups: number;
  flagCaptures: number;
  flagReturns: number;
}

export interface MatchStatsState {
  entries: MatchStatEntry[];
  processedEventIds: string[];
}

export function createMatchStatsState(
  actors: readonly Readonly<ActorState>[] = [],
): MatchStatsState {
  return {
    entries: actors.map((actor) => ({
      actorId: actor.id,
      teamId: actor.teamId,
      kills: 0,
      deaths: 0,
      flagPickups: 0,
      flagCaptures: 0,
      flagReturns: 0,
    })),
    processedEventIds: [],
  };
}

export function recordMatchEvents(
  state: MatchStatsState,
  actors: readonly Readonly<ActorState>[],
  events: readonly GameEvent[],
): void {
  const processed = new Set(state.processedEventIds);
  for (const event of events) {
    if (processed.has(event.id)) continue;
    processed.add(event.id);
    state.processedEventIds.push(event.id);
    if (event.type === "actor.died") {
      const victim = entryFor(state, event.targetActorId);
      if (victim) victim.deaths += 1;
      const source = actors.find((actor) => actor.id === event.sourceActorId);
      const target = actors.find((actor) => actor.id === event.targetActorId);
      if (
        source &&
        target &&
        source.id !== target.id &&
        source.teamId !== target.teamId
      ) {
        const killer = entryFor(state, source.id);
        if (killer) killer.kills += 1;
      }
    } else if (event.type === "objective.flagPickedUp") {
      const entry = entryFor(state, event.sourceActorId);
      if (entry) entry.flagPickups += 1;
    } else if (event.type === "objective.flagCaptured") {
      const entry = entryFor(state, event.sourceActorId);
      if (entry) entry.flagCaptures += 1;
    } else if (
      event.type === "objective.flagReset" &&
      readReason(event.payload) === "owner-return"
    ) {
      const entry = entryFor(state, event.sourceActorId);
      if (entry) entry.flagReturns += 1;
    }
  }
}

function entryFor(
  state: MatchStatsState,
  actorId: string | undefined,
): MatchStatEntry | undefined {
  return actorId
    ? state.entries.find((entry) => entry.actorId === actorId)
    : undefined;
}

function readReason(payload: unknown): string | undefined {
  return payload && typeof payload === "object" && "reason" in payload
    ? String((payload as { reason?: unknown }).reason)
    : undefined;
}
