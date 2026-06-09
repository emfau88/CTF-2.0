import type { ActorId, TeamId } from "../actors";

export interface GameEvent<
  Type extends string = string,
  Payload = unknown,
> {
  readonly id: string;
  readonly type: Type;
  readonly timeMs: number;
  readonly payload: Payload;
  readonly sourceActorId?: ActorId;
  readonly targetActorId?: ActorId;
  readonly teamId?: TeamId;
}
