import type { AudioPort } from "../audio";
import type { EffectsPort } from "../effects";
import type { RendererPort } from "../rendering";

export class NoopRendererPort implements RendererPort {
  render(): void {}
  reset(): void {}
  dispose(): void {}
}

export class NoopAudioPort implements AudioPort {
  handleEvents(): void {}
  reset(): void {}
  dispose(): void {}
}

export class NoopEffectsPort implements EffectsPort {
  handleEvents(): void {}
  update(): void {}
  reset(): void {}
  dispose(): void {}
}
