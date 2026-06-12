import type {
  CoreActionIntent,
  CoreInputFrame,
  WorldSnapshot,
} from "../../core";
import type { InputAdapterPort } from "./InputAdapterPort";

export interface SupplementalActionSource {
  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[];
  reset(): void;
}

export class AugmentedInputAdapter implements InputAdapterPort {
  constructor(
    private readonly primary: InputAdapterPort,
    private readonly snapshot: () => WorldSnapshot,
    private readonly supplemental: SupplementalActionSource,
  ) {}

  readFrame(deltaMs: number): CoreInputFrame {
    const frame = this.primary.readFrame(deltaMs);
    return {
      ...frame,
      actions: [
        ...frame.actions,
        ...this.supplemental.readActions(this.snapshot(), deltaMs),
      ],
    };
  }

  reset(): void {
    this.primary.reset();
    this.supplemental.reset();
  }

  dispose(): void {
    this.primary.dispose();
    this.supplemental.reset();
  }
}
