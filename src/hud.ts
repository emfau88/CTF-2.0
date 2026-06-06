import { len } from "./math";
import type { LevelId } from "./level";
import type { Player } from "./player";
import type { Bot, Projectile } from "./systems";

type ArenaHudState = {
  player: Player;
  bots: Bot[];
  projectiles: Projectile[];
  redCount: number;
  blueCount: number;
  redScore: number;
  blueScore: number;
  redFlagCarried: boolean;
  blueFlagCarried: boolean;
};

type SettingsState = {
  levelId: LevelId;
  levels: ReadonlyArray<{ id: LevelId; plan: string }>;
  redCount: number;
  blueCount: number;
  onMapChange: (levelId: LevelId) => void;
  onRedCountChange: (count: number) => void;
  onBlueCountChange: (count: number) => void;
};

export type FlagHudState = "home" | "player-carrier" | "red-stolen" | "blue-taken";

type FlagHudTransition = {
  playerCarrying: boolean;
  redFlagCarried: boolean;
  blueFlagCarried: boolean;
  redScore: number;
  blueScore: number;
  previousState: FlagHudState;
  previousRedScore: number;
  previousBlueScore: number;
};

export function getFlagHudTransition({
  playerCarrying,
  redFlagCarried,
  blueFlagCarried,
  redScore,
  blueScore,
  previousState,
  previousRedScore,
  previousBlueScore,
}: FlagHudTransition) {
  const state: FlagHudState = playerCarrying
    ? "player-carrier"
    : redFlagCarried
      ? "red-stolen"
      : blueFlagCarried
        ? "blue-taken"
        : "home";

  let notice: string | null = null;
  if (redScore !== previousRedScore) notice = "RED scores!";
  else if (blueScore !== previousBlueScore) notice = "BLUE scores!";
  else if (state !== previousState) {
    if (state === "player-carrier") notice = "Blue flag taken - bring it home!";
    else if (state === "red-stolen") notice = "Red flag stolen!";
    else if (state === "blue-taken") notice = "Blue flag taken!";
    else if (previousState !== "home") notice = "Flag returned";
  }

  return { state, notice };
}

export class HudController {
  private readonly redScore = document.querySelector<HTMLElement>("#red-score");
  private readonly blueScore = document.querySelector<HTMLElement>("#blue-score");
  private readonly statusToast = document.querySelector<HTMLElement>("#status-toast");
  private readonly debug = document.querySelector<HTMLElement>("#debug");
  private noticeUntil = 0;
  private flagState: FlagHudState = "home";
  private redScoreValue = 0;
  private blueScoreValue = 0;

  constructor(private debugVisible = window.innerWidth > 620) {}

  reset() {
    this.noticeUntil = 0;
    this.flagState = "home";
    this.redScoreValue = 0;
    this.blueScoreValue = 0;
    this.statusToast?.classList.remove("is-visible");
  }

  updateArena(now: number, state: ArenaHudState) {
    if (this.redScore) this.redScore.textContent = String(state.redScore);
    if (this.blueScore) this.blueScore.textContent = String(state.blueScore);
    const flagTransition = getFlagHudTransition({
      playerCarrying: Boolean(state.player.carriedFlag),
      redFlagCarried: state.redFlagCarried,
      blueFlagCarried: state.blueFlagCarried,
      redScore: state.redScore,
      blueScore: state.blueScore,
      previousState: this.flagState,
      previousRedScore: this.redScoreValue,
      previousBlueScore: this.blueScoreValue,
    });
    if (flagTransition.notice) this.showNotice(flagTransition.notice, now);
    this.flagState = flagTransition.state;
    this.redScoreValue = state.redScore;
    this.blueScoreValue = state.blueScore;
    this.statusToast?.classList.toggle("is-visible", now < this.noticeUntil);
    if (!this.debug) return;
    this.debug.classList.toggle("is-hidden", !this.debugVisible);
    this.debug.classList.toggle("is-visible", this.debugVisible);
    this.debug.textContent = formatArenaDebug(state);
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
  }

  private showNotice(text: string, now: number) {
    if (this.statusToast) this.statusToast.textContent = text;
    this.noticeUntil = now + 1800;
  }

  bindSettings({
    levelId,
    levels,
    redCount,
    blueCount,
    onMapChange,
    onRedCountChange,
    onBlueCountChange,
  }: SettingsState) {
    const panel = document.querySelector("#settings-panel");
    const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");
    if (settingsButton) settingsButton.onclick = () => {
      panel?.classList.toggle("is-hidden");
    };

    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-map]"))) {
      const mapId = button.dataset.map as LevelId;
      const level = levels.find((item) => item.id === mapId);
      button.classList.toggle("is-active", mapId === levelId);
      button.title = level?.plan ?? "";
      button.onclick = () => {
        if (!level) return;
        panel?.classList.add("is-hidden");
        onMapChange(mapId);
      };
    }

    const redSelect = document.querySelector<HTMLSelectElement>("#red-count");
    const blueSelect = document.querySelector<HTMLSelectElement>("#blue-count");
    if (redSelect) {
      redSelect.value = String(redCount);
      redSelect.onchange = () => onRedCountChange(Number(redSelect.value));
    }
    if (blueSelect) {
      blueSelect.value = String(blueCount);
      blueSelect.onchange = () => onBlueCountChange(Number(blueSelect.value));
    }

    const debugButton = document.querySelector<HTMLButtonElement>("#debug-button");
    if (debugButton) debugButton.onclick = () => this.toggleDebug();

    const fullscreenButton = document.querySelector<HTMLButtonElement>("#fullscreen-button");
    if (fullscreenButton) fullscreenButton.onclick = async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    };
  }
}

function formatArenaDebug({ player, bots, projectiles, redCount, blueCount }: ArenaHudState) {
  const nearestEnemy = Math.min(
    ...bots
      .filter((bot) => bot.alive && bot.team !== player.team)
      .map((bot) => len(player.x - bot.x, player.y - bot.y)),
    9999,
  );

  return `speed: ${player.speed().toFixed(1)}
velocity: ${player.vx.toFixed(1)}, ${player.vy.toFixed(1)}
state: ${player.state}
jump height: ${player.jump.height.toFixed(1)}
jump charge: ${Math.round(player.jump.charge() * 100)}%
friction: ${player.movement.currentFriction.toFixed(2)}
carried flag: ${player.carriedFlag ?? "none"}
armor: ${Math.ceil(player.armor)}
weapon: rocket ${player.rocketAmmo}, rail ${player.railAmmo}, rail cd ${Math.ceil(player.railCooldown)}
projectiles: ${projectiles.length}
teams: ${redCount}v${blueCount}
bot hp: ${bots.map((bot) => `${bot.team}-${bot.role}-${bot.state}:${Math.max(0, Math.ceil(bot.hp))}`).join(", ")}
nearest enemy: ${nearestEnemy.toFixed(0)}
over gap: ${player.overGap ? "yes" : "no"}
last safe: ${player.lastSafe.x.toFixed(0)}, ${player.lastSafe.y.toFixed(0)}`;
}
