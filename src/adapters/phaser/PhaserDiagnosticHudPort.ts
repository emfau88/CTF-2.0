import type Phaser from "phaser";
import type { ModeHudState, WorldSnapshot } from "../../core";
import type { HudPort } from "../hud";

export class PhaserDiagnosticHudPort implements HudPort {
  constructor(private readonly text: Phaser.GameObjects.Text) {}

  render(state: ModeHudState, snapshot: WorldSnapshot): void {
    this.text.setText([
      "Gameplay Core V2 Shell",
      `mode: ${state.modeId}`,
      `phase: ${state.phase}`,
      `time: ${Math.floor(snapshot.timeMs)} ms`,
      "status: inert / non-playable",
    ]);
  }

  reset(): void {
    this.text.setText("Gameplay Core V2 Shell");
  }

  dispose(): void {
    this.text.destroy();
  }
}
