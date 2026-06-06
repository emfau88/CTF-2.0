import Phaser from "phaser";
import { T } from "./config";
import type { Player } from "./player";
import type { Bot } from "./systems";

const STEP_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;
const BOT_STEP_RANGE = 420;

export class ArenaAudio {
  private stepIndex = 0;
  private stepTimer = 0;
  private botStepStates = new Map<Bot, { index: number; timer: number }>();
  private activeBotSteps = 0;

  constructor(private scene: Phaser.Scene) {}

  update(ms: number, player: Player, bots: Bot[]) {
    const walking = player.state === "alive" && player.jump.grounded() && player.speed() > 55;
    if (!walking) {
      this.stepTimer = 0;
    } else {
      this.stepTimer -= ms;
      if (this.stepTimer <= 0) {
        this.scene.sound.play(STEP_KEYS[this.stepIndex], { volume: .34 });
        this.stepIndex = (this.stepIndex + 1) % STEP_KEYS.length;
        const speedRatio = Phaser.Math.Clamp(player.speed() / T.maxSpeed, .25, 1);
        this.stepTimer = Phaser.Math.Linear(330, 190, speedRatio);
      }
    }

    this.updateBotSteps(ms, player, bots);
  }

  playJump() {
    this.scene.sound.play("playerUmf", { volume: .52 });
  }

  playPowerup() {
    this.scene.sound.play("getPowerup", { volume: .55 });
  }

  playHealthPickup() {
    const glass = this.scene.sound.add("healthGlass", { volume: .58 });
    glass.once(Phaser.Sound.Events.COMPLETE, () => {
      glass.destroy();
      this.scene.sound.play("healthAir", { volume: .56 });
    });
    glass.play();
  }

  playWeaponPickup() {
    this.scene.sound.play("weaponUp", { volume: .58 });
  }

  playRailFire() {
    this.scene.sound.play("railFire", { volume: .62 });
  }

  playRailHitConfirm() {
    this.scene.sound.play("railHitConfirm", { volume: .48 });
  }

  playWhip(hit: boolean) {
    this.scene.sound.play(hit ? "whipHit" : "whipSwing", { volume: hit ? .65 : .52 });
  }

  playRocketFire() {
    this.scene.sound.play("rocketFire", { volume: .68 });
  }

  playBulletFire() {
    this.scene.sound.play("botBulletFire", { volume: .34 });
  }

  playBotWeapon(bot: Bot, player: Player, kind: "bullet" | "rocket") {
    if (kind === "rocket") {
      this.playSpatial("rocketFire", bot, player, 950, .48);
      return;
    }
    this.playSpatial("botBulletFire", bot, player, 600, .25);
  }

  playBotDeath(bot: Bot, player: Player) {
    this.playSpatial("botDeath", bot, player, 700, .55);
  }

  playBotPickup(bot: Bot, player: Player, kind: "health" | "armor" | "rocket" | "rail" | "whip") {
    if (kind === "health") {
      this.playSpatialHealthPickup(bot, player);
      return;
    }
    this.playSpatial(kind === "armor" ? "getPowerup" : "weaponUp", bot, player, 650, .4);
  }

  private updateBotSteps(ms: number, player: Player, bots: Bot[]) {
    const nearbyMoving = bots
      .filter((bot) =>
        bot.alive &&
        bot.team !== player.team &&
        Math.hypot(bot.vx, bot.vy) > 20 &&
        Phaser.Math.Distance.Between(player.x, player.y, bot.x, bot.y) <= BOT_STEP_RANGE)
      .sort((a, b) =>
        Phaser.Math.Distance.Squared(player.x, player.y, a.x, a.y) -
        Phaser.Math.Distance.Squared(player.x, player.y, b.x, b.y))
      .slice(0, 2);

    for (const bot of nearbyMoving) {
      const state = this.botStepStates.get(bot) ?? {
        index: Math.floor(Math.random() * STEP_KEYS.length),
        timer: Math.random() * 250,
      };
      state.timer -= ms;

      if (state.timer <= 0 && this.activeBotSteps < 2) {
        const volume = this.spatialVolume(bot, player, BOT_STEP_RANGE, .3);
        if (volume > .01) {
          const sound = this.scene.sound.add(STEP_KEYS[state.index], { volume });
          this.activeBotSteps++;
          sound.once(Phaser.Sound.Events.COMPLETE, () => {
            this.activeBotSteps = Math.max(0, this.activeBotSteps - 1);
            sound.destroy();
          });
          sound.play();
        }
        state.index = (state.index + 1) % STEP_KEYS.length;
        state.timer = 380;
      }

      this.botStepStates.set(bot, state);
    }

    for (const bot of this.botStepStates.keys()) {
      if (!bot.alive) this.botStepStates.delete(bot);
    }
  }

  private playSpatialHealthPickup(bot: Bot, player: Player) {
    const volume = this.spatialVolume(bot, player, 650, .4);
    if (volume <= .01) return;

    const glass = this.scene.sound.add("healthGlass", { volume });
    glass.once(Phaser.Sound.Events.COMPLETE, () => {
      glass.destroy();
      this.scene.sound.play("healthAir", { volume: volume * .95 });
    });
    glass.play();
  }

  private playSpatial(
    key: string,
    source: { x: number; y: number },
    listener: { x: number; y: number },
    range: number,
    maxVolume: number,
  ) {
    const volume = this.spatialVolume(source, listener, range, maxVolume);
    if (volume > .01) this.scene.sound.play(key, { volume });
  }

  private spatialVolume(
    source: { x: number; y: number },
    listener: { x: number; y: number },
    range: number,
    maxVolume: number,
  ) {
    const distance = Phaser.Math.Distance.Between(source.x, source.y, listener.x, listener.y);
    const ratio = Phaser.Math.Clamp(1 - distance / range, 0, 1);
    return maxVolume * ratio * ratio;
  }
}
