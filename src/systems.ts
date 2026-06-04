import Phaser from "phaser";
import { T, type TeamId } from "./config";
import type { LevelData } from "./level";
import { circleRect, len, pointInRect, resolveCircleRect, type Rect, type Vec2 } from "./math";
import { Player } from "./player";

export type FlagCarrier = {
  x: number;
  y: number;
  team: TeamId;
  carriedFlag: TeamId | null;
  jump?: { height: number };
};

export class CollisionSystem {
  constructor(private level: LevelData) {}

  update(p: Player, ms: number) {
    if (p.state !== "alive") return;
    p.x = Math.max(p.radius, Math.min(p.x, T.worldWidth - p.radius));
    p.y = Math.max(p.radius, Math.min(p.y, T.worldHeight - p.radius));
    if (!(p.jump.active && p.jump.height > T.jumpHeight * .5)) {
      const pos = { x: p.x, y: p.y };
      for (let pass = 0; pass < 3; pass++) {
        let hit = false;
        for (const w of this.level.walls) {
          const h = resolveCircleRect(pos, p.radius, w);
          if (!h) continue;
          pos.x += h.x * (h.depth + .1); pos.y += h.y * (h.depth + .1);
          const into = p.vx * h.x + p.vy * h.y;
          if (into < 0) { p.vx -= into * h.x; p.vy -= into * h.y; }
          hit = true;
        }
        if (!hit) break;
      }
      p.x = pos.x; p.y = pos.y;
    }
    p.overGap = this.level.gaps.some(g => circleRect(p.x, p.y, p.radius * .68, g));
    if (this.level.gaps.some(g => pointInRect(p.x, p.y, g)) && !p.jump.clearsGap()) p.fall();
    p.safeTimer += ms;
    if (p.safeTimer >= T.safePointInterval && p.jump.grounded() && !p.overGap) { p.safeTimer = 0; p.lastSafe = { x: p.x, y: p.y }; }
  }
}

export class FlagSystem {
  redScore = 0; blueScore = 0;
  flags: Record<TeamId, { team: TeamId; home: Vec2; x: number; y: number; carrier: FlagCarrier | null }>;

  constructor(private level: LevelData) {
    this.flags = {
      red: { team: "red", home: level.redFlag, x: level.redFlag.x, y: level.redFlag.y, carrier: null },
      blue: { team: "blue", home: level.blueFlag, x: level.blueFlag.x, y: level.blueFlag.y, carrier: null },
    };
  }

  update(carrier: FlagCarrier, active = true) {
    for (const f of Object.values(this.flags)) {
      if (f.carrier) {
        f.x = f.carrier.x;
        f.y = f.carrier.y - 24 - (f.carrier.jump?.height ?? 0);
      }
    }
    if (!active) return;
    const enemy: TeamId = carrier.team === "red" ? "blue" : "red";
    const f = this.flags[enemy];
    if (!carrier.carriedFlag && !f.carrier && len(carrier.x - f.x, carrier.y - f.y) < 36) {
      f.carrier = carrier;
      carrier.carriedFlag = enemy;
    }
    if (carrier.carriedFlag && this.inOwnBase(carrier)) {
      if (carrier.team === "red") this.redScore++;
      else this.blueScore++;
      this.reset(carrier.carriedFlag);
      carrier.carriedFlag = null;
    }
  }
  failed(p: FlagCarrier) { if (p.carriedFlag) { this.reset(p.carriedFlag); p.carriedFlag = null; } }
  reset(team: TeamId) { const f = this.flags[team]; f.x = f.home.x; f.y = f.home.y; f.carrier = null; }
  text(p: Player) {
    if (p.carriedFlag) return "Enemy flag carried - return to red base";
    if (this.flags.red.carrier) return "Red flag stolen - stop the carrier";
    return "Enemy flag available";
  }
  capture(p: Player) { return p.carriedFlag ? "Bring it home" : "Find blue flag"; }
  private inOwnBase(carrier: FlagCarrier) {
    return pointInRect(carrier.x, carrier.y, carrier.team === "red" ? this.level.redBase : this.level.blueBase);
  }
}

export class Bot {
  radius = 15; vx = 0; vy = 0; hp = T.botMaxHp; alive = true; respawnTimer = 0; carriedFlag: TeamId | null = null;
  private routeIndex = 0;
  constructor(
    public x: number,
    public y: number,
    public team: TeamId,
    public role: "attacker" | "defender",
    private level: LevelData,
    private spawn = { x, y },
  ) {}
  update(dt: number, ms: number, blockers: Rect[], flags: FlagSystem, player: Player) {
    if (!this.alive) {
      this.respawnTimer -= ms;
      if (this.respawnTimer <= 0) {
        this.x = this.spawn.x; this.y = this.spawn.y; this.hp = T.botMaxHp; this.alive = true; this.routeIndex = 0;
      }
      return;
    }

    const target = this.chooseTarget(player);
    this.moveToward(target, dt, blockers);
    flags.update(this, this.alive);
  }
  damage(v: number) { if (!this.alive) return; this.hp -= v; if (this.hp <= 0) { this.alive = false; this.respawnTimer = T.respawnDelay; } }
  private chooseTarget(player: Player): Vec2 {
    if (this.carriedFlag) return { x: this.level.blueBase.x + this.level.blueBase.w / 2, y: this.level.blueBase.y + this.level.blueBase.h / 2 };
    if (this.role === "defender") {
      if (player.carriedFlag === "blue") return { x: player.x, y: player.y };
      return this.nextRoutePoint(this.level.botRoutes.defender);
    }
    return this.nextRoutePoint(this.level.botRoutes.attacker);
  }
  private nextRoutePoint(route: Vec2[]): Vec2 {
    const point = route[this.routeIndex] ?? route[0] ?? this.spawn;
    if (len(this.x - point.x, this.y - point.y) < 30) this.routeIndex = (this.routeIndex + 1) % route.length;
    return route[this.routeIndex] ?? point;
  }
  private moveToward(target: Vec2, dt: number, blockers: Rect[]) {
    const dx = target.x - this.x, dy = target.y - this.y, d = len(dx, dy) || 1;
    const speed = this.role === "attacker" ? T.botSpeed * 1.25 : T.botSpeed * 1.08;
    this.vx = dx / d * speed; this.vy = dy / d * speed;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (blockers.some(r => circleRect(nx, ny, this.radius, r))) {
      this.vx = -dy / d * speed * .65;
      this.vy = dx / d * speed * .65;
      const sx = this.x + this.vx * dt, sy = this.y + this.vy * dt;
      if (!blockers.some(r => circleRect(sx, sy, this.radius, r))) { this.x = sx; this.y = sy; }
      return;
    }
    this.x = nx; this.y = ny;
  }
}

export class Projectile {
  ttl = 2600; dead = false;
  constructor(public x: number, public y: number, public vx: number, public vy: number, public owner: Player | Bot) {}
  update(dt: number, ms: number, targets: Array<Player | Bot>) {
    this.ttl -= ms; if (this.ttl <= 0) { this.dead = true; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    for (const t of targets) {
      if (t === this.owner) continue;
      if (t.team === this.owner.team) continue;
      if (t instanceof Bot && !t.alive) continue;
      if (t instanceof Player && t.state !== "alive") continue;
      if (len(this.x - t.x, this.y - t.y) <= t.radius + T.projectileRadius) { t.damage(T.projectileDamage); this.dead = true; return; }
    }
  }
}

export class AutoAttack {
  cooldown = 0;
  constructor(private owner: Player | Bot, private projectiles: Projectile[], private fireRate = T.fireRate) {}
  update(ms: number, targets: Array<Player | Bot>) {
    this.cooldown -= ms;
    if (this.cooldown > 0) return;
    if (this.owner instanceof Player && this.owner.state !== "alive") return;
    if (this.owner instanceof Bot && !this.owner.alive) return;

    let best: Player | Bot | null = null, bd = Infinity;
    for (const target of targets) {
      if (target === this.owner || target.team === this.owner.team) continue;
      if (target instanceof Bot && !target.alive) continue;
      if (target instanceof Player && target.state !== "alive") continue;
      const d = len(target.x - this.owner.x, target.y - this.owner.y);
      if (d < bd && d <= T.attackRange) { best = target; bd = d; }
    }
    if (!best) return;
    const dx = best.x - this.owner.x, dy = best.y - this.owner.y, d = len(dx, dy) || 1;
    const height = this.owner instanceof Player ? this.owner.jump.height : 0;
    this.projectiles.push(new Projectile(
      this.owner.x + dx / d * (this.owner.radius + T.projectileRadius + 3),
      this.owner.y - height + dy / d * (this.owner.radius + T.projectileRadius + 3),
      dx / d * T.projectileSpeed,
      dy / d * T.projectileSpeed,
      this.owner,
    ));
    this.cooldown = this.fireRate;
  }
}
