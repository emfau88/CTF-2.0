import Phaser from "phaser";
import type { AudioPort } from "../audio";
import type { GameEvent } from "../../core";

export class PhaserWeaponAudioPort implements AudioPort {
  constructor(private readonly scene: Phaser.Scene) {}

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "weapon.rocketFired") {
        this.play("rocketFire", .68);
      } else if (event.type === "weapon.railFired") {
        this.play("railFire", .62);
        if (readBoolean(event.payload, "hit")) {
          this.play("railHitConfirm", .48);
        }
      } else if (event.type === "weapon.whipFired") {
        this.play(
          readBoolean(event.payload, "hit") ? "whipHit" : "whipSwing",
          readBoolean(event.payload, "hit") ? .65 : .52,
        );
      } else if (
        event.type === "pickup.collected" &&
        isWeaponPickup(event.payload)
      ) {
        this.play("weaponUp", .52);
      }
    }
  }

  reset(): void {}
  dispose(): void {}

  private play(key: string, volume: number): void {
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key, { volume });
    }
  }
}

function readBoolean(payload: unknown, key: string): boolean {
  return Boolean(
    payload && typeof payload === "object" &&
      key in payload &&
      (payload as Record<string, unknown>)[key],
  );
}

function isWeaponPickup(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || !("pickupType" in payload)) {
    return false;
  }
  const type = (payload as { pickupType?: unknown }).pickupType;
  return type === "rocket" || type === "rail" || type === "whip";
}
