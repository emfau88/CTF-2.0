import type {
  CoreFrameResult,
  CoreInputFrame,
  CoreRuntime,
  GameEvent,
  ModeHudState,
  WorldSnapshot,
} from "../../core";
import type { AudioPort } from "../audio";
import type { FrameDiagnosticsPort } from "../debugging";
import type { EffectsPort } from "../effects";
import type { HudPort } from "../hud";
import type { RendererPort } from "../rendering";

export interface PhaserGameBridgePorts {
  readonly renderer?: RendererPort;
  readonly audio?: AudioPort;
  readonly diagnostics?: FrameDiagnosticsPort;
  readonly effects?: EffectsPort;
  readonly hud?: HudPort;
}

interface AdapterLifecycle {
  reset(): void;
  dispose(): void;
}

export class PhaserGameBridge {
  private currentResult: CoreFrameResult | null = null;
  private frameCount = 0;

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
    for (const port of this.lifecyclePorts()) {
      port.reset();
    }
    this.frameCount = 0;
    return this.publish(this.runtime.initialize(), null);
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    this.frameCount++;
    return this.publish(this.runtime.advance(input), input);
  }

  dispose(): void {
    for (const port of this.lifecyclePorts()) {
      port.dispose();
    }
    this.currentResult = null;
  }

  private publish(
    result: CoreFrameResult,
    input: CoreInputFrame | null,
  ): CoreFrameResult {
    this.currentResult = result;
    this.ports.renderer?.render(result.snapshot);
    this.ports.audio?.handleEvents(result.events, result.snapshot);
    this.ports.effects?.handleEvents(result.events, result.snapshot);
    this.ports.effects?.update(input?.deltaMs ?? 0, result.snapshot);
    this.ports.hud?.render(result.hudState, result.snapshot);
    this.ports.diagnostics?.renderFrame(this.frameCount, input, result);
    return result;
  }

  private lifecyclePorts(): readonly AdapterLifecycle[] {
    const ports: Array<AdapterLifecycle | undefined> = [
      this.ports.renderer,
      this.ports.audio,
      this.ports.diagnostics,
      this.ports.effects,
      this.ports.hud,
    ];
    return [...new Set(
      ports.filter((port): port is AdapterLifecycle => port !== undefined),
    )];
  }
}
