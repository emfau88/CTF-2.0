import Phaser from "phaser";
import type {
  ActorId,
  ActorState,
  GameEvent,
  WorldSnapshot,
} from "../../core";
import type { AudioPort } from "../audio";

const STEP_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;
const MAX_ACTOR_SPEED = 335;
const ENEMY_STEP_RANGE = 420;

type PickupType = "health" | "armor" | "rocket" | "rail" | "whip";

interface StepState {
  index: number;
  timerMs: number;
}

export class PhaserArenaAudioPort implements AudioPort {
  private ownStepIndex = 0;
  private ownStepTimerMs = 0;
  private readonly enemyStepStates = new Map<ActorId, StepState>();
  private readonly activeSounds = new Set<Phaser.Sound.BaseSound>();
  private activeEnemySteps = 0;
  private lastUpdateTimeMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly listenerActorId = "blue-player",
  ) {}

  handleEvents(
    events: readonly GameEvent[],
    snapshot: WorldSnapshot,
  ): void {
    const listener = actorById(snapshot, this.listenerActorId);
    for (const event of events) {
      this.handleEvent(event, snapshot, listener);
    }
    this.updateSteps(snapshot, listener);
  }

  reset(): void {
    this.stopActiveSounds();
    this.ownStepIndex = 0;
    this.ownStepTimerMs = 0;
    this.enemyStepStates.clear();
    this.activeEnemySteps = 0;
    this.lastUpdateTimeMs = 0;
  }

  dispose(): void {
    this.reset();
  }

  private handleEvent(
    event: GameEvent,
    snapshot: WorldSnapshot,
    listener: Readonly<ActorState> | undefined,
  ): void {
    const source = event.sourceActorId
      ? actorById(snapshot, event.sourceActorId)
      : undefined;
    const target = event.targetActorId
      ? actorById(snapshot, event.targetActorId)
      : undefined;
    const ownSource = event.sourceActorId === this.listenerActorId;
    const ownTarget = event.targetActorId === this.listenerActorId;

    if (event.type === "actor.jumped") {
      if (ownSource) {
        this.play("playerUmf", .52);
      }
      return;
    }
    if (
      event.type === "projectile.spawned" &&
      readString(event.payload, "weaponId") === "basic-autoshoot"
    ) {
      if (ownSource) {
        this.play("botBulletFire", .34);
      } else {
        this.playSpatial("botBulletFire", source, listener, 600, .25);
      }
      return;
    }
    if (event.type === "weapon.rocketFired") {
      if (ownSource) {
        this.play("rocketFire", .68);
      } else {
        this.playSpatial("rocketFire", source, listener, 950, .48);
      }
      return;
    }
    if (event.type === "weapon.railFired") {
      if (ownSource) {
        this.play("railFire", .62);
        if (readBoolean(event.payload, "hit")) {
          this.play("railHitConfirm", .48);
        }
      } else {
        this.playSpatial("railFire", source, listener, 950, .44);
      }
      return;
    }
    if (event.type === "weapon.whipFired") {
      const hit = readBoolean(event.payload, "hit");
      if (ownSource) {
        this.play(hit ? "whipHit" : "whipSwing", hit ? .65 : .52);
      } else {
        this.playSpatial(
          hit ? "whipHit" : "whipSwing",
          source,
          listener,
          420,
          hit ? .48 : .36,
        );
      }
      return;
    }
    if (event.type === "actor.died") {
      if (ownTarget) {
        this.play("botDeath", .55);
      } else {
        this.playSpatial("botDeath", target, listener, 700, .55);
      }
      return;
    }
    if (event.type === "pickup.collected") {
      const pickupType = readPickupType(event.payload);
      if (!pickupType) {
        return;
      }
      if (ownTarget) {
        this.playLocalPickup(pickupType);
      } else {
        const volume = spatialVolume(target, listener, 650, .4);
        if (volume > .01) {
          this.playSpatialPickup(pickupType, volume);
        }
      }
    }
  }

  private updateSteps(
    snapshot: WorldSnapshot,
    listener: Readonly<ActorState> | undefined,
  ): void {
    const now = this.scene.time.now;
    const deltaMs = this.lastUpdateTimeMs > 0
      ? Math.min(100, Math.max(0, now - this.lastUpdateTimeMs))
      : 0;
    this.lastUpdateTimeMs = now;
    if (!listener) {
      return;
    }

    const listenerSpeed = speed(listener);
    const listenerWalking = listener.lifeState === "active" &&
      listener.jump.grounded &&
      listenerSpeed > 55;
    if (!listenerWalking) {
      this.ownStepTimerMs = 0;
    } else {
      this.ownStepTimerMs -= deltaMs;
      if (this.ownStepTimerMs <= 0) {
        this.play(STEP_KEYS[this.ownStepIndex], .34);
        this.ownStepIndex = (this.ownStepIndex + 1) % STEP_KEYS.length;
        const speedRatio = Phaser.Math.Clamp(
          listenerSpeed / MAX_ACTOR_SPEED,
          .25,
          1,
        );
        this.ownStepTimerMs = Phaser.Math.Linear(330, 190, speedRatio);
      }
    }

    const nearbyEnemies = snapshot.actors
      .filter((actor) =>
        actor.id !== listener.id &&
        actor.lifeState === "active" &&
        actor.jump.grounded &&
        actor.teamId !== listener.teamId &&
        speed(actor) > 20 &&
        distance(actor, listener) <= ENEMY_STEP_RANGE
      )
      .sort((left, right) =>
        distance(left, listener) - distance(right, listener)
      )
      .slice(0, 2);
    const nearbyIds = new Set(nearbyEnemies.map((actor) => actor.id));

    for (const actor of nearbyEnemies) {
      const state = this.enemyStepStates.get(actor.id) ?? {
        index: Math.floor(Math.random() * STEP_KEYS.length),
        timerMs: Math.random() * 250,
      };
      state.timerMs -= deltaMs;
      if (state.timerMs <= 0 && this.activeEnemySteps < 2) {
        const volume = spatialVolume(
          actor,
          listener,
          ENEMY_STEP_RANGE,
          .3,
        );
        if (volume > .01) {
          this.playTracked(
            STEP_KEYS[state.index],
            volume,
            () => {
              this.activeEnemySteps = Math.max(0, this.activeEnemySteps - 1);
            },
          );
          this.activeEnemySteps++;
        }
        state.index = (state.index + 1) % STEP_KEYS.length;
        state.timerMs = 380;
      }
      this.enemyStepStates.set(actor.id, state);
    }
    for (const actorId of this.enemyStepStates.keys()) {
      if (!nearbyIds.has(actorId)) {
        this.enemyStepStates.delete(actorId);
      }
    }
  }

  private playLocalPickup(type: PickupType): void {
    if (type === "health") {
      this.playHealthPickup(.58, .56);
    } else if (type === "armor") {
      this.play("getPowerup", .55);
    } else {
      this.play("weaponUp", .58);
    }
  }

  private playSpatialPickup(type: PickupType, volume: number): void {
    if (type === "health") {
      this.playHealthPickup(volume, volume * .95);
    } else if (type === "armor") {
      this.play("getPowerup", volume);
    } else {
      this.play("weaponUp", volume);
    }
  }

  private playHealthPickup(glassVolume: number, airVolume: number): void {
    const glass = this.createSound("healthGlass", glassVolume);
    if (!glass) {
      return;
    }
    glass.once(Phaser.Sound.Events.COMPLETE, () => {
      this.releaseSound(glass);
      this.play("healthAir", airVolume);
    });
    glass.play();
  }

  private playSpatial(
    key: string,
    source: Readonly<ActorState> | undefined,
    listener: Readonly<ActorState> | undefined,
    range: number,
    maxVolume: number,
  ): void {
    const volume = spatialVolume(source, listener, range, maxVolume);
    if (volume > .01) {
      this.play(key, volume);
    }
  }

  private play(key: string, volume: number): void {
    this.playTracked(key, volume);
  }

  private playTracked(
    key: string,
    volume: number,
    onComplete?: () => void,
  ): void {
    const sound = this.createSound(key, volume);
    if (!sound) {
      return;
    }
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      this.releaseSound(sound);
      onComplete?.();
    });
    sound.play();
  }

  private createSound(
    key: string,
    volume: number,
  ): Phaser.Sound.BaseSound | null {
    if (!this.scene.cache.audio.exists(key)) {
      return null;
    }
    const sound = this.scene.sound.add(key, { volume });
    this.activeSounds.add(sound);
    return sound;
  }

  private releaseSound(sound: Phaser.Sound.BaseSound): void {
    this.activeSounds.delete(sound);
    sound.destroy();
  }

  private stopActiveSounds(): void {
    for (const sound of this.activeSounds) {
      sound.stop();
      sound.destroy();
    }
    this.activeSounds.clear();
  }
}

function actorById(
  snapshot: WorldSnapshot,
  actorId: ActorId,
): Readonly<ActorState> | undefined {
  return snapshot.actors.find((actor) => actor.id === actorId);
}

function speed(actor: Readonly<ActorState>): number {
  return Math.hypot(actor.velocity.x, actor.velocity.y);
}

function distance(
  source: Readonly<ActorState>,
  listener: Readonly<ActorState>,
): number {
  return Phaser.Math.Distance.Between(
    source.position.x,
    source.position.y,
    listener.position.x,
    listener.position.y,
  );
}

function spatialVolume(
  source: Readonly<ActorState> | undefined,
  listener: Readonly<ActorState> | undefined,
  range: number,
  maxVolume: number,
): number {
  if (!source || !listener) {
    return 0;
  }
  const ratio = Phaser.Math.Clamp(1 - distance(source, listener) / range, 0, 1);
  return maxVolume * ratio * ratio;
}

function readBoolean(payload: unknown, key: string): boolean {
  return Boolean(
    payload && typeof payload === "object" &&
      key in payload &&
      (payload as Record<string, unknown>)[key],
  );
}

function readString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readPickupType(payload: unknown): PickupType | null {
  const type = readString(payload, "pickupType");
  return type === "health" ||
      type === "armor" ||
      type === "rocket" ||
      type === "rail" ||
      type === "whip"
    ? type
    : null;
}
