import type Phaser from "phaser";
import type {
  CoreActionIntent,
  CoreFrameResult,
  CoreInputFrame,
  ModeHudState,
  WorldSnapshot,
} from "../../core";
import type { FrameDiagnosticsPort } from "../debugging";
import type { HudPort } from "../hud";

export class PhaserDiagnosticHudPort
implements HudPort, FrameDiagnosticsPort {
  private hudState: ModeHudState | null = null;
  private snapshot: WorldSnapshot | null = null;
  private input: CoreInputFrame | null = null;
  private frameCount = 0;
  private eventCount = 0;
  private lastLifecycleEvent = "none";

  constructor(private readonly text: Phaser.GameObjects.Text) {}

  render(state: ModeHudState, snapshot: WorldSnapshot): void {
    this.hudState = state;
    this.snapshot = snapshot;
    this.refresh();
  }

  renderFrame(
    frameCount: number,
    input: CoreInputFrame | null,
    result: CoreFrameResult,
  ): void {
    this.frameCount = frameCount;
    this.input = input;
    this.eventCount = result.events.length;
    const lifecycleEvent = [...result.events].reverse().find((event) =>
      event.type === "actor.damaged" ||
      event.type === "actor.died" ||
      event.type === "actor.respawned"
    );
    if (lifecycleEvent) {
      this.lastLifecycleEvent = lifecycleEvent.type;
    }
    this.refresh();
  }

  reset(): void {
    this.hudState = null;
    this.snapshot = null;
    this.input = null;
    this.frameCount = 0;
    this.eventCount = 0;
    this.lastLifecycleEvent = "none";
    this.text.setText("Gameplay Core V2 Shell");
  }

  dispose(): void {
    this.text.destroy();
  }

  private refresh(): void {
    if (!this.hudState || !this.snapshot) {
      return;
    }

    const move = this.directionFor("move");
    const aim = this.directionFor("aim");
    const actor = this.snapshot.actors[0];
    this.text.setText([
      "Gameplay Core V2 Shell",
      `mode: ${this.hudState.modeId}`,
      `map: ${this.snapshot.map?.id ?? "none"}`,
      `mapName: ${this.snapshot.map?.displayName ?? "none"}`,
      `phase: ${this.hudState.phase}`,
      `frame: ${this.frameCount}`,
      `last dt: ${this.formatNumber(this.input?.deltaMs ?? 0)} ms`,
      `runtime: ${Math.floor(this.snapshot.timeMs)} ms`,
      "movement: V2 ground parity",
      "jump: V2 short/held parity",
      `actors: ${this.snapshot.actors.length}`,
      `events: ${this.eventCount}`,
      `positionX: ${this.formatNumber(actor?.position.x ?? 0)}`,
      `positionY: ${this.formatNumber(actor?.position.y ?? 0)}`,
      `velocityX: ${this.formatNumber(actor?.velocity.x ?? 0)}`,
      `velocityY: ${this.formatNumber(actor?.velocity.y ?? 0)}`,
      `speed: ${this.formatNumber(Math.hypot(
        actor?.velocity.x ?? 0,
        actor?.velocity.y ?? 0,
      ))}`,
      `jumpState: ${actor?.jump.phase ?? "ready"}`,
      `grounded: ${actor?.jump.grounded ?? true}`,
      `jumpElapsed: ${this.formatNumber(actor?.jump.elapsedMs ?? 0)} ms`,
      `jumpPlanned: ${this.formatNumber(
        actor?.jump.plannedDurationMs ?? 0,
      )} ms`,
      `jumpHeight: ${this.formatNumber(actor?.jump.height ?? 0)}`,
      `health: ${this.formatNumber(actor?.health ?? 0)}`,
      `armor: ${this.formatNumber(actor?.armor ?? 0)}`,
      `alive: ${actor?.lifeState === "active"}`,
      `lifeState: ${actor?.lifeState ?? "inactive"}`,
      `overGap: ${actor?.overGap ?? false}`,
      `lastSafeX: ${this.formatNumber(actor?.lastSafePosition.x ?? 0)}`,
      `lastSafeY: ${this.formatNumber(actor?.lastSafePosition.y ?? 0)}`,
      `respawn: ${this.formatNumber(actor?.respawn?.remainingMs ?? 0)} ms`,
      `respawnReason: ${actor?.respawn?.reason ?? "none"}`,
      `lastLifecycleEvent: ${this.lastLifecycleEvent}`,
      "",
      `moveX: ${this.formatNumber(move.x)}`,
      `moveY: ${this.formatNumber(move.y)}`,
      `jumpPressed: ${this.hasAction("jump", "pressed")}`,
      `jumpHeld: ${this.hasAction("jump", "held")}`,
      `jumpReleased: ${this.hasAction("jump", "released")}`,
      `firePrimary: ${this.hasAction("firePrimary")}`,
      `fireSpecial: ${this.hasAction("fireSpecial")}`,
      `debugDamage: ${this.hasAction("debugDamage", "pressed")}`,
      `aimX: ${this.formatNumber(aim.x)}`,
      `aimY: ${this.formatNumber(aim.y)}`,
      "status: inert / non-playable",
      "debug: press K to apply 35 damage",
    ]);
  }

  private actionFor(action: string): CoreActionIntent | undefined {
    return this.input?.actions.find((intent) => intent.action === action);
  }

  private directionFor(action: string): { x: number; y: number } {
    return this.actionFor(action)?.direction ?? { x: 0, y: 0 };
  }

  private hasAction(action: string, phase?: CoreActionIntent["phase"]): boolean {
    return this.input?.actions.some((intent) =>
      intent.action === action && (!phase || intent.phase === phase)
    ) ?? false;
  }

  private formatNumber(value: number): string {
    return value.toFixed(2);
  }
}
