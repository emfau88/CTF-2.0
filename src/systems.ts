import Phaser from "phaser";
import { T, type TeamId } from "./config";
import type { LevelData, PickupKind, PickupSpawn } from "./level";
import { circleRect, insetRect, len, lineIntersectsRect, pointInRect, resolveCircleRect, type Rect, type Vec2 } from "./math";
import { Player } from "./player";

export type FlagCarrier = {
  x: number;
  y: number;
  team: TeamId;
  carriedFlag: TeamId | null;
  jump?: { height: number };
};

type Actor = Player | Bot;
export type BotRole = "attacker" | "defender" | "support";

class BotNavigator {
  private readonly cell = 40;
  private readonly cols = Math.ceil(T.worldWidth / this.cell);
  private readonly rows = Math.ceil(T.worldHeight / this.cell);
  private readonly blocked: boolean[];

  constructor(private level: LevelData, private radius: number) {
    this.blocked = Array.from({ length: this.cols * this.rows }, (_, index) => {
      const cell = this.cellFromIndex(index);
      const point = this.center(cell.x, cell.y);
      return !this.inWorld(point.x, point.y) || this.levelBlockers().some((r) => circleRect(point.x, point.y, this.radius + 6, r));
    });
  }

  findPath(from: Vec2, to: Vec2): Vec2[] {
    const start = this.nearestWalkableCell(from);
    const goal = this.nearestWalkableCell(to);
    if (!start || !goal) return [to];
    if (start.x === goal.x && start.y === goal.y) return [to];

    const startIndex = this.index(start.x, start.y);
    const goalIndex = this.index(goal.x, goal.y);
    const open = [startIndex];
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>([[startIndex, 0]]);
    const fScore = new Map<number, number>([[startIndex, this.heuristic(start, goal)]]);
    const closed = new Set<number>();

    while (open.length) {
      open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
      const current = open.shift()!;
      if (current === goalIndex) return this.reconstruct(cameFrom, current, to);
      closed.add(current);

      const c = this.cellFromIndex(current);
      for (const n of this.neighbors(c.x, c.y)) {
        const nIndex = this.index(n.x, n.y);
        if (closed.has(nIndex)) continue;
        const stepCost = n.x !== c.x && n.y !== c.y ? 1.414 : 1;
        const tentative = (gScore.get(current) ?? Infinity) + stepCost;
        if (tentative >= (gScore.get(nIndex) ?? Infinity)) continue;
        cameFrom.set(nIndex, current);
        gScore.set(nIndex, tentative);
        fScore.set(nIndex, tentative + this.heuristic(n, goal));
        if (!open.includes(nIndex)) open.push(nIndex);
      }
    }
    return [to];
  }

  private levelBlockers() {
    return [...this.level.walls, ...this.level.gaps];
  }

  private reconstruct(cameFrom: Map<number, number>, current: number, finalTarget: Vec2) {
    const points: Vec2[] = [];
    while (cameFrom.has(current)) {
      const cell = this.cellFromIndex(current);
      points.push(this.center(cell.x, cell.y));
      current = cameFrom.get(current)!;
    }
    points.reverse();
    points.push(finalTarget);
    return this.smooth(points);
  }

  private smooth(points: Vec2[]) {
    if (points.length <= 1) return points;
    const result: Vec2[] = [];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = points.length - 1;
      while (next > anchor + 1 && !this.clearLine(points[anchor], points[next])) next--;
      result.push(points[next]);
      anchor = next;
    }
    return result;
  }

  private clearLine(a: Vec2, b: Vec2) {
    return !this.levelBlockers().some((r) => lineIntersectsRect(a, b, r));
  }

  private nearestWalkableCell(point: Vec2) {
    const cx = Phaser.Math.Clamp(Math.floor(point.x / this.cell), 0, this.cols - 1);
    const cy = Phaser.Math.Clamp(Math.floor(point.y / this.cell), 0, this.rows - 1);
    if (this.walkable(cx, cy)) return { x: cx, y: cy };
    for (let radius = 1; radius < 8; radius++) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (this.walkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  private neighbors(x: number, y: number) {
    const result: Vec2[] = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox, ny = y + oy;
        if (!this.walkable(nx, ny)) continue;
        if (ox && oy && (!this.walkable(x + ox, y) || !this.walkable(x, y + oy))) continue;
        result.push({ x: nx, y: ny });
      }
    }
    return result;
  }

  private walkable(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows && !this.blocked[this.index(x, y)];
  }

  private center(x: number, y: number) {
    return { x: x * this.cell + this.cell / 2, y: y * this.cell + this.cell / 2 };
  }

  private index(x: number, y: number) {
    return y * this.cols + x;
  }

  private cellFromIndex(index: number) {
    return { x: index % this.cols, y: Math.floor(index / this.cols) };
  }

  private heuristic(a: Vec2, b: Vec2) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private inWorld(x: number, y: number) {
    return x >= this.radius && y >= this.radius && x <= T.worldWidth - this.radius && y <= T.worldHeight - this.radius;
  }
}

export class CollisionSystem {
  private gapDangerZones: Rect[];

  constructor(private level: LevelData) {
    this.gapDangerZones = level.gaps.map(g => insetRect(g, T.gapDangerInsetRatio));
  }

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
    p.overGap = this.gapDangerZones.some(g => circleRect(p.x, p.y, p.radius * .68, g));
    if (this.gapDangerZones.some(g => pointInRect(p.x, p.y, g)) && !p.jump.clearsGap()) p.fall();
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
  radius = 15; vx = 0; vy = 0; hp = T.botMaxHp; armor = 0; rocketAmmo = 0; railAmmo = 0; railCooldown = 0; alive = true; respawnTimer = 0; carriedFlag: TeamId | null = null;
  state = "spawn";
  private routeIndex = 0;
  private path: Vec2[] = [];
  private pathIndex = 0;
  private pathTarget: Vec2 | null = null;
  private pathTimer = 0;
  private progressTimer = 0;
  private progressPoint: Vec2;
  private forceRepath = false;
  private avoidanceTimer = 0;
  private avoidanceSign = 1;
  private navigator: BotNavigator;
  constructor(
    public x: number,
    public y: number,
    public team: TeamId,
    public role: BotRole,
    private level: LevelData,
    private spawn = { x, y },
  ) {
    this.navigator = new BotNavigator(level, this.radius);
    this.progressPoint = { x, y };
  }
  update(dt: number, ms: number, blockers: Rect[], flags: FlagSystem, actors: Actor[], walls: Rect[], pickups: Pickup[]) {
    if (!this.alive) {
      this.respawnTimer -= ms;
      if (this.respawnTimer <= 0) {
        this.x = this.spawn.x; this.y = this.spawn.y; this.hp = T.botMaxHp; this.armor = 0; this.rocketAmmo = 0; this.railAmmo = 0; this.railCooldown = 0; this.alive = true; this.routeIndex = 0; this.path = []; this.pathIndex = 0; this.pathTarget = null; this.pathTimer = 0; this.progressTimer = 0; this.progressPoint = { ...this.spawn }; this.forceRepath = false; this.avoidanceTimer = 0; this.state = "spawn";
      }
      return;
    }
    this.railCooldown = Math.max(0, this.railCooldown - ms);
    this.avoidanceTimer = Math.max(0, this.avoidanceTimer - ms);

    const target = this.chooseTarget(flags, actors, walls, pickups);
    this.pathTimer -= ms;
    this.moveToward(this.pathStep(target, blockers), dt, blockers);
    this.trackProgress(ms);
    flags.update(this, this.alive);
  }
  heal(v: number) { this.hp = Math.min(T.botMaxHp, this.hp + v); }
  addArmor(v: number) { this.armor = Math.min(T.botMaxHp, this.armor + v); }
  damage(v: number) {
    if (!this.alive) return;
    const armorHit = Math.min(this.armor, v);
    this.armor -= armorHit;
    this.hp -= v - armorHit;
    if (this.hp <= 0) { this.alive = false; this.respawnTimer = T.respawnDelay; this.armor = 0; }
  }
  private chooseTarget(flags: FlagSystem, actors: Actor[], walls: Rect[], pickups: Pickup[]): Vec2 {
    const enemies = actors.filter((actor) => actor.team !== this.team && this.actorAlive(actor));
    const allies = actors.filter((actor) => actor !== this && actor.team === this.team && this.actorAlive(actor));
    const visibleEnemies = enemies.filter((enemy) => this.canSee(enemy, walls));
    const enemyCarrier = enemies.find((enemy) => enemy.carriedFlag === this.team);
    const teamCarrier = allies.find((ally) => ally.carriedFlag && ally.carriedFlag !== this.team);
    const urgentHealth = this.chooseItem(pickups, "health");
    const ownBase = this.ownBaseCenter();

    if (this.carriedFlag) {
      this.state = "returnFlag";
      return this.ownBaseCenter();
    }

    if (this.hp < T.botMaxHp * .3 && urgentHealth) {
      this.state = "recover";
      return { x: urgentHealth.x, y: urgentHealth.y };
    }
    if (this.hp < T.botMaxHp * .25 && visibleEnemies.length) {
      this.state = "retreat";
      return urgentHealth ? { x: urgentHealth.x, y: urgentHealth.y } : ownBase;
    }

    if (enemyCarrier) {
      this.state = "huntCarrier";
      return { x: enemyCarrier.x, y: enemyCarrier.y };
    }
    if (flags.flags[this.team].carrier) {
      this.state = "intercept";
      return { x: flags.flags[this.team].x, y: flags.flags[this.team].y };
    }

    if (teamCarrier && this.role !== "defender") {
      this.state = "escort";
      return this.escortPoint(teamCarrier);
    }

    const tacticalItem = this.chooseRoleItem(pickups, visibleEnemies);
    if (tacticalItem) {
      this.state = "getItem";
      return { x: tacticalItem.x, y: tacticalItem.y };
    }

    if (this.role === "defender") {
      const invader = visibleEnemies.find((enemy) => len(enemy.x - this.ownBaseCenter().x, enemy.y - this.ownBaseCenter().y) < 360) ?? visibleEnemies[0];
      if (invader) {
        this.state = "defend";
        return { x: invader.x, y: invader.y };
      }
      this.state = "patrol";
      return this.nextRoutePoint(this.routeForTeam(this.level.botRoutes.defender));
    }

    if (this.role === "support") {
      if (visibleEnemies.length && len(this.x - ownBase.x, this.y - ownBase.y) < 520) {
        this.state = "screen";
        return { x: visibleEnemies[0].x, y: visibleEnemies[0].y };
      }
      this.state = "midControl";
      return this.supportPoint();
    }

    if (visibleEnemies.length && this.hp < T.botMaxHp * .45) {
      this.state = "skirmish";
      return { x: visibleEnemies[0].x, y: visibleEnemies[0].y };
    }
    this.state = "getFlag";
    return this.nextRoutePoint(this.routeForTeam(this.level.botRoutes.attacker));
  }
  private actorAlive(actor: Actor) {
    return actor instanceof Bot ? actor.alive : actor.state === "alive";
  }
  private canSee(actor: Actor, walls: Rect[]) {
    return !walls.some((wall) => lineIntersectsRect(this, actor, wall));
  }
  private chooseItem(pickups: Pickup[], kind?: PickupKind) {
    const useful = pickups.filter((pickup) => pickup.active && (!kind || pickup.kind === kind) && this.itemUseful(pickup));
    useful.sort((a, b) => len(this.x - a.x, this.y - a.y) - len(this.x - b.x, this.y - b.y));
    return useful[0] && len(this.x - useful[0].x, this.y - useful[0].y) < 440 ? useful[0] : null;
  }
  private chooseRoleItem(pickups: Pickup[], visibleEnemies: Actor[]) {
    if (this.hp < T.botMaxHp * .58) return this.chooseItem(pickups, "health");
    if (this.role === "defender" && this.armor < T.botMaxHp * .2) return this.chooseItem(pickups, "armor");
    if (this.role === "attacker" && this.rocketAmmo <= 0 && visibleEnemies.length === 0) return this.chooseItem(pickups, "rocket");
    if (this.role === "support" && this.rocketAmmo <= 0) return this.chooseItem(pickups, "rocket") ?? this.chooseItem(pickups, "armor");
    return null;
  }
  private itemUseful(pickup: Pickup) {
    if (pickup.kind === "health") return this.hp < T.botMaxHp * .72;
    if (pickup.kind === "armor") return this.armor < T.botMaxHp * .25;
    if (pickup.kind === "rocket") return pickup.temporary || this.rocketAmmo <= 0;
    return pickup.temporary || this.railAmmo <= 0;
  }
  private ownBaseCenter(): Vec2 {
    const base = this.team === "red" ? this.level.redBase : this.level.blueBase;
    return { x: base.x + base.w / 2, y: base.y + base.h / 2 };
  }
  private enemyBaseCenter(): Vec2 {
    const base = this.team === "red" ? this.level.blueBase : this.level.redBase;
    return { x: base.x + base.w / 2, y: base.y + base.h / 2 };
  }
  private escortPoint(carrier: Actor): Vec2 {
    const base = this.ownBaseCenter();
    return {
      x: carrier.x + (base.x - carrier.x) * .28,
      y: carrier.y + (base.y - carrier.y) * .28,
    };
  }
  private supportPoint(): Vec2 {
    const home = this.ownBaseCenter();
    const enemy = this.enemyBaseCenter();
    const center = { x: home.x + (enemy.x - home.x) * .42, y: home.y + (enemy.y - home.y) * .42 };
    return this.nextRoutePoint([
      { x: center.x, y: center.y - 105 },
      { x: center.x + (this.team === "red" ? 90 : -90), y: center.y },
      { x: center.x, y: center.y + 105 },
      { x: center.x + (this.team === "red" ? -55 : 55), y: center.y },
    ]);
  }
  private routeForTeam(route: Vec2[]) {
    return this.team === "blue" ? route : route.map((point) => ({ x: T.worldWidth - point.x, y: point.y }));
  }
  private nextRoutePoint(route: Vec2[]): Vec2 {
    const point = route[this.routeIndex] ?? route[0] ?? this.spawn;
    if (len(this.x - point.x, this.y - point.y) < 30) this.routeIndex = (this.routeIndex + 1) % route.length;
    return route[this.routeIndex] ?? point;
  }
  private pathStep(target: Vec2, blockers: Rect[]) {
    const movedTarget = !this.pathTarget || len(target.x - this.pathTarget.x, target.y - this.pathTarget.y) > 70;
    const activePath = this.pathIndex < this.path.length;
    if (!this.forceRepath && activePath && !movedTarget && this.pathTimer > 0) {
      while (this.pathIndex < this.path.length - 1 && len(this.x - this.path[this.pathIndex].x, this.y - this.path[this.pathIndex].y) < 34) {
        this.pathIndex++;
      }
      return this.path[this.pathIndex] ?? target;
    }
    if (!this.forceRepath && this.clearLine({ x: this.x, y: this.y }, target, blockers)) {
      this.path = [];
      this.pathIndex = 0;
      this.pathTarget = { ...target };
      return target;
    }
    if (this.forceRepath || movedTarget || this.pathTimer <= 0 || this.pathIndex >= this.path.length) {
      this.path = this.navigator.findPath({ x: this.x, y: this.y }, target);
      this.pathIndex = 0;
      this.pathTarget = { ...target };
      this.pathTimer = 700;
      this.forceRepath = false;
    }
    while (this.pathIndex < this.path.length - 1 && len(this.x - this.path[this.pathIndex].x, this.y - this.path[this.pathIndex].y) < 34) {
      this.pathIndex++;
    }
    return this.path[this.pathIndex] ?? target;
  }
  private clearLine(a: Vec2, b: Vec2, blockers: Rect[]) {
    return !blockers.some((r) => lineIntersectsRect(a, b, r));
  }
  private moveToward(target: Vec2, dt: number, blockers: Rect[]) {
    const dx = target.x - this.x, dy = target.y - this.y, d = len(dx, dy) || 1;
    const speed = this.role === "attacker" ? T.botSpeed * 1.25 : T.botSpeed * 1.08;
    if (this.avoidanceTimer > 0) {
      this.vx = -dy / d * speed * .72 * this.avoidanceSign;
      this.vy = dx / d * speed * .72 * this.avoidanceSign;
    } else {
      this.vx = dx / d * speed;
      this.vy = dy / d * speed;
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (blockers.some(r => circleRect(nx, ny, this.radius, r))) {
      const left = { x: -dy / d * speed * .72, y: dx / d * speed * .72 };
      const right = { x: -left.x, y: -left.y };
      const leftOpen = !blockers.some(r => circleRect(this.x + left.x * dt, this.y + left.y * dt, this.radius, r));
      const rightOpen = !blockers.some(r => circleRect(this.x + right.x * dt, this.y + right.y * dt, this.radius, r));
      if (leftOpen || rightOpen) {
        if (!leftOpen) this.avoidanceSign = -1;
        else if (!rightOpen) this.avoidanceSign = 1;
        this.avoidanceTimer = 420;
        const side = this.avoidanceSign > 0 ? left : right;
        this.vx = side.x;
        this.vy = side.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else {
        this.vx = 0;
        this.vy = 0;
        this.forceRepath = true;
      }
      return;
    }
    this.x = nx; this.y = ny;
  }

  private trackProgress(ms: number) {
    this.progressTimer += ms;
    if (this.progressTimer < 700) return;
    const moved = len(this.x - this.progressPoint.x, this.y - this.progressPoint.y);
    if (moved < 9) {
      this.forceRepath = true;
      this.pathTimer = 0;
      this.avoidanceSign *= -1;
      this.avoidanceTimer = 520;
      this.routeIndex++;
    }
    this.progressPoint = { x: this.x, y: this.y };
    this.progressTimer = 0;
  }
}

export class Projectile {
  ttl = 2600; dead = false; exploded = false;
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public owner: Player | Bot,
    public kind: "bullet" | "rocket" = "bullet",
  ) {}
  get radius() { return this.kind === "rocket" ? T.rocketProjectileRadius : T.projectileRadius; }
  get damage() { return this.kind === "rocket" ? T.rocketDamage : T.projectileDamage; }
  update(dt: number, ms: number, targets: Array<Player | Bot>, walls: Rect[] = []) {
    this.ttl -= ms; if (this.ttl <= 0) { this.dead = true; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (walls.some(w => circleRect(this.x, this.y, this.radius, w))) {
      if (this.kind === "rocket") this.explode(targets, walls);
      this.dead = true;
      return;
    }
    for (const t of targets) {
      if (t === this.owner) continue;
      if (t.team === this.owner.team) continue;
      if (t instanceof Bot && !t.alive) continue;
      if (t instanceof Player && t.state !== "alive") continue;
      if (len(this.x - t.x, this.y - t.y) <= t.radius + this.radius) {
        if (this.kind === "rocket") this.explode(targets, walls);
        else t.damage(this.damage);
        this.dead = true;
        return;
      }
    }
  }
  private explode(targets: Array<Player | Bot>, walls: Rect[]) {
    this.exploded = true;
    for (const t of targets) {
      if (t.team === this.owner.team) continue;
      if (t instanceof Bot && !t.alive) continue;
      if (t instanceof Player && t.state !== "alive") continue;
      const dx = t.x - this.x, dy = t.y - this.y, d = len(dx, dy);
      if (d > T.rocketSplashRadius + t.radius) continue;
      if (walls.some(w => lineIntersectsRect(this, t, w))) continue;
      const falloff = Phaser.Math.Clamp(1 - d / T.rocketSplashRadius, .35, 1);
      t.damage(T.rocketDamage * falloff);
      const n = d || 1;
      t.vx += dx / n * T.rocketKnockback * falloff;
      t.vy += dy / n * T.rocketKnockback * falloff;
      t.x += dx / n * 18 * falloff;
      t.y += dy / n * 18 * falloff;
    }
  }
}

export class Pickup {
  active = true;
  respawnTimer = 0;
  life = 0;
  constructor(
    public kind: PickupKind,
    public x: number,
    public y: number,
    public amount = kind === "rocket" ? T.rocketAmmo : kind === "rail" ? T.railAmmo : kind === "whip" ? T.whipAmmo : 1,
    public temporary = false,
  ) {
    this.life = temporary ? T.weaponDropLifetimeMs : 0;
  }
  update(ms: number) {
    if (this.temporary) {
      this.life -= ms;
      if (this.life <= 0) this.active = false;
      return;
    }
    if (this.active) return;
    this.respawnTimer -= ms;
    if (this.respawnTimer <= 0) this.active = true;
  }
  get expired() {
    return this.temporary && (!this.active || this.life <= 0);
  }
  collect(actor: Actor) {
    if (!this.active) return false;
    if (actor instanceof Player && actor.state !== "alive") return false;
    if (actor instanceof Bot && !actor.alive) return false;
    if (actor instanceof Bot && (this.kind === "rail" || this.kind === "whip")) return false;
    if (len(actor.x - this.x, actor.y - this.y) > T.pickupRadius + actor.radius) return false;
    const maxHp = actor instanceof Player ? T.playerMaxHp : T.botMaxHp;
    if (this.kind === "health") actor.heal(maxHp * T.healthPackHealRatio);
    else if (this.kind === "armor") actor.addArmor(maxHp * T.armorPackRatio);
    else if (this.kind === "rocket") actor.rocketAmmo += this.amount;
    else if (this.kind === "rail") actor.railAmmo += this.amount;
    else if (actor instanceof Player) actor.whipAmmo += this.amount;
    this.active = false;
    if (!this.temporary) this.respawnTimer = T.pickupRespawnMs;
    return true;
  }
}

export class PickupSystem {
  pickups: Pickup[];
  constructor(spawns: PickupSpawn[]) {
    this.pickups = spawns.map((spawn) => new Pickup(spawn.kind, spawn.x, spawn.y));
  }
  dropRocketAmmo(x: number, y: number, amount: number) {
    if (amount <= 0) return;
    this.pickups.push(new Pickup("rocket", x, y, amount, true));
  }
  dropRailAmmo(x: number, y: number, amount: number) {
    if (amount <= 0) return;
    this.pickups.push(new Pickup("rail", x, y, amount, true));
  }
  dropWhipAmmo(x: number, y: number, amount: number) {
    if (amount <= 0) return;
    this.pickups.push(new Pickup("whip", x, y, amount, true));
  }
  update(ms: number, actors: Actor[]) {
    const collected: Array<{ pickup: Pickup; actor: Actor }> = [];
    for (const pickup of this.pickups) {
      pickup.update(ms);
      for (const actor of actors) {
        if (pickup.collect(actor)) collected.push({ pickup, actor });
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.expired);
    return collected;
  }
}

export type AutoAttackResult = {
  kind: "bullet" | "rocket";
};

export class AutoAttack {
  cooldown = 0;
  constructor(private owner: Player | Bot, private projectiles: Projectile[], private fireRate = T.fireRate) {}
  update(ms: number, targets: Array<Player | Bot>, walls: Rect[] = []): AutoAttackResult | null {
    this.cooldown -= ms;
    if (this.cooldown > 0) return null;
    if (this.owner instanceof Player && this.owner.state !== "alive") return null;
    if (this.owner instanceof Bot && !this.owner.alive) return null;

    let best: Player | Bot | null = null, bd = Infinity, bestScore = -Infinity;
    for (const target of targets) {
      if (target === this.owner || target.team === this.owner.team) continue;
      if (target instanceof Bot && !target.alive) continue;
      if (target instanceof Player && target.state !== "alive") continue;
      const d = len(target.x - this.owner.x, target.y - this.owner.y);
      if (walls.some(w => lineIntersectsRect(this.owner, target, w))) continue;
      if (d > T.attackRange) continue;
      const carrierBonus = target.carriedFlag === this.owner.team ? 900 : 0;
      const lowHpBonus = target instanceof Bot ? T.botMaxHp - target.hp : T.playerMaxHp - target.hp;
      const score = carrierBonus + lowHpBonus - d * .12;
      if (score > bestScore) { best = target; bd = d; bestScore = score; }
    }
    if (!best) return null;
    const dx = best.x - this.owner.x, dy = best.y - this.owner.y, d = len(dx, dy) || 1;
    const height = this.owner instanceof Player ? this.owner.jump.height : 0;
    let rocket = false;
    if (this.owner instanceof Bot && this.owner.rocketAmmo > 0) {
      rocket = best.carriedFlag === this.owner.team || bd > 190;
      if (rocket) this.owner.rocketAmmo--;
    }
    this.projectiles.push(new Projectile(
      this.owner.x + dx / d * (this.owner.radius + (rocket ? T.rocketProjectileRadius : T.projectileRadius) + 3),
      this.owner.y - height + dy / d * (this.owner.radius + (rocket ? T.rocketProjectileRadius : T.projectileRadius) + 3),
      dx / d * (rocket ? T.rocketSpeed : T.projectileSpeed),
      dy / d * (rocket ? T.rocketSpeed : T.projectileSpeed),
      this.owner,
      rocket ? "rocket" : "bullet",
    ));
    this.cooldown = this.fireRate;
    return { kind: rocket ? "rocket" : "bullet" };
  }
}
