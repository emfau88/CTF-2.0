import type { CoreInputFrame } from "../../core";

export interface InputAdapterPort {
  readFrame(deltaMs: number): CoreInputFrame;
  reset(): void;
  dispose(): void;
}
