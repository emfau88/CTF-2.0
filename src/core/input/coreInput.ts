import type { ActorId, WorldPosition } from "../actors";

export type CoreActionPhase = "pressed" | "held" | "released" | "changed";

export interface CoreActionIntent<Payload = unknown> {
  readonly action: string;
  readonly phase: CoreActionPhase;
  readonly actorId?: ActorId;
  readonly direction?: WorldPosition;
  readonly magnitude?: number;
  readonly payload?: Payload;
}

export interface CoreInputFrame {
  readonly sequence: number;
  readonly timeMs: number;
  readonly deltaMs: number;
  readonly actions: readonly CoreActionIntent[];
}
