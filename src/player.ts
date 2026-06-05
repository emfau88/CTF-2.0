import { T, type TeamId } from "./config";
import type { Vec2 } from "./math";
import { len } from "./math";

export type PlayerState = "alive" | "falling" | "dead";

export class Player {
  radius = T.playerRadius;
  x: number; y: number; prevX: number; prevY: number;
  vx = 0; vy = 0; hp = T.playerMaxHp; armor = 0; rocketAmmo = 0; railAmmo = 0; railCooldown = 0;
  state: PlayerState = "alive"; stateTimer = 0;
  team: TeamId; carriedFlag: TeamId | null = null;
  lastSafe: Vec2; safeTimer = 0; lastMoveDir: Vec2 = { x: 1, y: 0 }; overGap = false;
  jump = new JumpSystem(this);
  movement = new MovementController(this);

  constructor(x: number, y: number, team: TeamId) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y; this.team = team; this.lastSafe = { x, y };
  }
  speed() { return len(this.vx, this.vy); }
  fall() { if (this.state !== "alive") return; this.state = "falling"; this.stateTimer = T.fallRespawnMs; this.vx *= .18; this.vy *= .18; this.jump.cancel(); }
  heal(v: number) { this.hp = Math.min(T.playerMaxHp, this.hp + v); }
  addArmor(v: number) { this.armor = Math.min(T.playerMaxHp, this.armor + v); }
  damage(v: number) {
    if (this.state !== "alive") return;
    const armorHit = Math.min(this.armor, v);
    this.armor -= armorHit;
    this.hp -= v - armorHit;
    if (this.hp <= 0) { this.state = "dead"; this.stateTimer = T.respawnDelay; this.vx = 0; this.vy = 0; this.armor = 0; this.jump.cancel(); }
  }
  respawn(p: Vec2) { this.x = p.x; this.y = p.y; this.prevX = p.x; this.prevY = p.y; this.vx = 0; this.vy = 0; this.hp = T.playerMaxHp; this.armor = 0; this.rocketAmmo = 0; this.railAmmo = 0; this.railCooldown = 0; this.state = "alive"; this.stateTimer = 0; this.lastSafe = { ...p }; this.jump.reset(); }
}

export class JumpSystem {
  active = false; held = false; elapsed = 0; planned = T.jumpMinDuration; cooldown = 0; height = 0;
  constructor(private p: Player) {}
  start() {
    if (this.active || this.cooldown > 0 || this.p.state !== "alive") return false;
    if (this.p.speed() < 34) { this.p.vx += this.p.lastMoveDir.x * T.lowSpeedJumpBoost; this.p.vy += this.p.lastMoveDir.y * T.lowSpeedJumpBoost; }
    this.active = true; this.held = true; this.elapsed = 0; this.planned = T.jumpMinDuration; this.cooldown = T.jumpCooldown; return true;
  }
  release() { this.held = false; }
  update(ms: number) {
    this.cooldown = Math.max(0, this.cooldown - ms);
    if (!this.active) { this.height = 0; return; }
    this.elapsed += ms;
    if (this.held) {
      this.planned = Math.min(T.jumpMaxDuration, this.planned + ms * T.jumpHoldExtendRate);
      if (this.planned >= T.jumpMaxDuration) this.held = false;
    }
    const t = Math.min(1, this.elapsed / this.planned);
    this.height = Math.sin(t * Math.PI) * T.jumpHeight;
    if (t >= 1) this.cancel();
  }
  grounded() { return !this.active; }
  clearsGap() { return this.active && this.height >= T.jumpHeight * T.jumpClearHeightRatio; }
  charge() { return Math.min(1, this.planned / T.jumpMaxDuration); }
  state() { return this.active ? (this.held ? "Hold" : "Air") : this.cooldown > 0 ? "Cooldown" : "Ready"; }
  cancel() { this.active = false; this.held = false; this.elapsed = 0; this.height = 0; }
  reset() { this.cancel(); this.cooldown = 0; }
}

export class MovementController {
  currentFriction = T.friction;
  constructor(private p: Player) {}
  update(dt: number, input: { x: number; y: number; length: number }) {
    const grounded = this.p.jump.grounded();
    const speed = this.p.speed();
    const hasInput = input.length > .05;
    if (hasInput) {
      let accel = T.acceleration * input.length * (grounded ? 1 : T.airControl);
      if (speed > 20) {
        const dot = (this.p.vx / speed) * input.x + (this.p.vy / speed) * input.y;
        if (grounded && dot < T.turnPenaltyDot) {
          const s = Math.max(.62, 1 - -dot * T.turnPenalty * dt);
          this.p.vx *= s; this.p.vy *= s;
        } else if (grounded && dot > -.15 && dot < .72) accel *= T.strafeBonus;
      }
      this.p.vx += input.x * accel * dt; this.p.vy += input.y * accel * dt;
    }
    const friction = grounded ? (hasInput ? T.inputFriction : T.friction) : T.airFriction;
    this.currentFriction = friction;
    const drag = Math.max(0, 1 - friction * dt);
    this.p.vx *= drag; this.p.vy *= drag;
    const max = grounded ? T.maxSpeed : T.maxSpeed * 1.08;
    const v = this.p.speed();
    if (v > max) { this.p.vx = this.p.vx / v * max; this.p.vy = this.p.vy / v * max; }
  }
}
