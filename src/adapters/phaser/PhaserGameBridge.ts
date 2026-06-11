import type {
  CoreFrameResult,
  CoreInputFrame,
  CoreRuntime,
  GameEvent,
  ModeHudState,
  WorldSnapshot,
} from "../../core";
import type { AudioPort } from "../audio";
import type { EffectsPort } from "../effects";
import type { HudPort } from "../hud";
import type { RendererPort } from "../rendering";

export interface PhaserGameBridgePorts {
  readonly renderer?: RendererPort;
  readonly audio?: AudioPort;
  readonly effects?: EffectsPort;
  readonly hud?: HudPort;
}

export class PhaserGameBridge {
  private currentResult: CoreFrameResult | null = null;

  constructor(
    private readonly runtime: CoreRuntime,
    private readonly ports: PhaserGameBridgePorts = {},
  ) {}

  get result(): CoreFrameResult | null {
    return this.currentResult;
  }

  get snapshot(): WorldSnapshot {
    return this.currentResult?.snapshot ?? this.runtime.snapshot;
  }

  get events(): readonly GameEvent[] {
    return this.currentResult?.events ?? [];
  }

  get hudState(): ModeHudState | null {
    return this.currentResult?.hudState ?? null;
  }

  initialize(): CoreFrameResult {
    this.ports.renderer?.reset();
    this.ports.audio?.reset();
    this.ports.effects?.reset();
    this.ports.hud?.reset();
    return this.publish(this.runtime.initialize(), 0);
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    return this.publish(this.runtime.advance(input), input.deltaMs);
  }

  dispose(): void {
    this.ports.renderer?.dispose();
    this.ports.audio?.dispose();
    this.ports.effects?.dispose();
    this.ports.hud?.dispose();
    this.currentResult = null;
  }

  private publish(
    result: CoreFrameResult,
    deltaMs: number,
  ): CoreFrameResult {
    this.currentResult = result;
    this.ports.renderer?.render(result.snapshot);
    this.ports.audio?.handleEvents(result.events, result.snapshot);
    this.ports.effects?.handleEvents(result.events, result.snapshot);
    this.ports.effects?.update(deltaMs, result.snapshot);
    this.ports.hud?.render(result.hudState, result.snapshot);
    return result;
  }
}
