import type { CoreFrameResult, CoreInputFrame } from "../../core";

export interface FrameDiagnosticsPort {
  renderFrame(
    frameCount: number,
    input: CoreInputFrame | null,
    result: CoreFrameResult,
  ): void;
  reset(): void;
  dispose(): void;
}
