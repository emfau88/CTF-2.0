import Phaser from "phaser";
import type {
  CoreFrameResult,
  CoreInputFrame,
  ModeHudState,
  WorldSnapshot,
} from "../../core";
import type { FrameDiagnosticsPort } from "../debugging";
import type { HudPort } from "../hud";

const HUD_DEPTH = 1000;
const PANEL_FILL = 0x102320;
const PANEL_STROKE = 0xffffff;
const BLUE = "#8db7ff";
const RED = "#ff9e91";
const NEUTRAL = "#f5fbfa";
const MUTED = "#a9bfba";

interface PlayerPanel {
  readonly background: Phaser.GameObjects.Graphics;
  readonly bars: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly state: Phaser.GameObjects.Text;
  readonly health: Phaser.GameObjects.Text;
  readonly armor: Phaser.GameObjects.Text;
  readonly ammo: Phaser.GameObjects.Text;
}

export class PhaserArenaHudPort
implements HudPort, FrameDiagnosticsPort {
  private readonly scorePanel: Phaser.GameObjects.Graphics;
  private readonly blueScoreText: Phaser.GameObjects.Text;
  private readonly redScoreText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly ruleText: Phaser.GameObjects.Text;
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly bluePanel: PlayerPanel;
  private readonly redPanel: PlayerPanel;
  private readonly controlsText: Phaser.GameObjects.Text;
  private readonly resultText: Phaser.GameObjects.Text;
  private hudState: ModeHudState | null = null;
  private snapshot: WorldSnapshot | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mobileControls = false,
    private readonly botOpponent = false,
    private readonly requestRestart?: () => void,
  ) {
    this.scorePanel = createGraphics(scene);
    this.blueScoreText = createText(scene, BLUE, "20px", "bold")
      .setOrigin(1, 0);
    this.redScoreText = createText(scene, RED, "20px", "bold");
    this.timerText = createText(scene, NEUTRAL, "16px", "bold")
      .setOrigin(.5, 0);
    this.ruleText = createText(scene, MUTED, "9px", "bold")
      .setOrigin(.5, 0)
      .setLetterSpacing(.8);
    this.objectiveText = createText(scene, NEUTRAL, "10px", "bold")
      .setOrigin(.5, 0)
      .setLetterSpacing(.35);
    this.bluePanel = createPlayerPanel(scene, BLUE);
    this.redPanel = createPlayerPanel(scene, RED);
    this.controlsText = createText(scene, "#dceae8", "10px", "bold")
      .setOrigin(.5, 1)
      .setPadding(7, 4)
      .setBackgroundColor("#102320d9");
    this.resultText = createText(scene, NEUTRAL, "30px", "bold")
      .setOrigin(.5)
      .setPadding(22, 16)
      .setAlign("center")
      .setBackgroundColor("#102320ee")
      .setVisible(false)
      .setDepth(HUD_DEPTH + 1);

    if (mobileControls && requestRestart) {
      this.resultText.setInteractive({ useHandCursor: true });
      this.resultText.on("pointerup", this.handleRestart);
    }
  }

  render(state: ModeHudState, snapshot: WorldSnapshot): void {
    this.hudState = state;
    this.snapshot = snapshot;
    this.refresh();
  }

  renderFrame(
    _frameCount: number,
    _input: CoreInputFrame | null,
    _result: CoreFrameResult,
  ): void {
    this.refresh();
  }

  reset(): void {
    this.hudState = null;
    this.snapshot = null;
    this.resultText.setVisible(false);
  }

  dispose(): void {
    this.scorePanel.destroy();
    this.blueScoreText.destroy();
    this.redScoreText.destroy();
    this.timerText.destroy();
    this.ruleText.destroy();
    this.objectiveText.destroy();
    destroyPlayerPanel(this.bluePanel);
    destroyPlayerPanel(this.redPanel);
    this.controlsText.destroy();
    this.resultText.destroy();
  }

  private readonly handleRestart = (): void => {
    if (this.hudState?.phase === "ended") {
      this.requestRestart?.();
    }
  };

  private refresh(): void {
    if (!this.hudState || !this.snapshot) {
      return;
    }
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const compact = width < 700 || height < 500;
    const blueScore = this.hudState.scores.find((entry) =>
      entry.teamId === "blue"
    )?.score ?? 0;
    const redScore = this.hudState.scores.find((entry) =>
      entry.teamId === "red"
    )?.score ?? 0;
    const blue = this.snapshot.actors.find((actor) =>
      actor.teamId === "blue" && actor.kind === "player"
    );
    const red = this.snapshot.actors.find((actor) =>
      actor.teamId === "red" && actor.kind === "player"
    );
    const objective = objectiveStatus(this.hudState, compact);

    this.layoutMatchHeader(
      this.hudState,
      width,
      compact,
      blueScore,
      redScore,
      objective,
    );
    this.layoutPlayerPanels(width, height, compact, blue, red);
    this.layoutControls(width, height);
    this.layoutResult(width, height);
  }

  private layoutMatchHeader(
    state: ModeHudState,
    width: number,
    compact: boolean,
    blueScore: number,
    redScore: number,
    objective: string,
  ): void {
    const centerX = width / 2;
    const panelWidth = compact ? 168 : 224;
    const panelHeight = objective ? (compact ? 54 : 60) : (compact ? 42 : 48);
    const panelX = centerX - panelWidth / 2;
    const panelY = compact ? 8 : 10;
    drawPanel(this.scorePanel, panelX, panelY, panelWidth, panelHeight, compact ? 10 : 11);

    this.blueScoreText
      .setPosition(centerX - (compact ? 36 : 42), panelY + (compact ? 4 : 6))
      .setFontSize(compact ? "17px" : "19px")
      .setText(compact ? `B ${blueScore}` : `BLUE ${blueScore}`);
    this.redScoreText
      .setPosition(centerX + (compact ? 36 : 42), panelY + (compact ? 4 : 6))
      .setFontSize(compact ? "17px" : "19px")
      .setText(compact ? `${redScore} R` : `${redScore} RED`);
    this.timerText
      .setPosition(centerX, panelY + (compact ? 5 : 7))
      .setFontSize(compact ? "14px" : "16px")
      .setText(formatTime(state.timeRemainingMs ?? 0));
    this.ruleText
      .setPosition(centerX, panelY + (compact ? 23 : 28))
      .setFontSize(compact ? "8px" : "9px")
      .setText(shortRuleText(state).toUpperCase());
    this.objectiveText
      .setPosition(centerX, panelY + (compact ? 36 : 43))
      .setFontSize(compact ? "9px" : "10px")
      .setText(objective)
      .setVisible(Boolean(objective));
  }

  private layoutPlayerPanels(
    width: number,
    height: number,
    compact: boolean,
    blue: WorldSnapshot["actors"][number] | undefined,
    red: WorldSnapshot["actors"][number] | undefined,
  ): void {
    const panelWidth = compact ? 154 : 184;
    const panelHeight = compact ? 62 : 68;
    const edge = compact ? 8 : 12;
    const desktopY = height - panelHeight - edge;
    const mobileY = compact ? 70 : 82;

    updatePlayerPanel(
      this.bluePanel,
      this.mobileControls ? "BLUE" : "BLUE P1",
      blue,
      edge,
      this.mobileControls ? mobileY : desktopY,
      panelWidth,
      panelHeight,
      BLUE,
    );
    updatePlayerPanel(
      this.redPanel,
      this.botOpponent ? "RED BOT" : "RED P2",
      red,
      width - panelWidth - edge,
      desktopY,
      panelWidth,
      panelHeight,
      RED,
    );
    setPlayerPanelVisible(this.bluePanel, !this.mobileControls);
    setPlayerPanelVisible(this.redPanel, !this.mobileControls);
  }

  private layoutControls(width: number, height: number): void {
    this.controlsText
      .setPosition(width / 2, height - 14)
      .setText(
        this.botOpponent
          ? "WASD / SPACE   Q ROCKET   E RAIL   F WHIP"
          : "P1 WASD / SPACE   P2 ARROWS / ENTER   Q / E / F WEAPONS",
      )
      .setVisible(!this.mobileControls && width >= 900 && height >= 500);
  }

  private layoutResult(width: number, height: number): void {
    this.resultText.setPosition(width / 2, height / 2);
    this.resultText.setVisible(false);
  }
}

function createGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
}

function createText(
  scene: Phaser.Scene,
  color: string,
  fontSize: string,
  fontStyle = "normal",
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "", {
    fontFamily: "Consolas, monospace",
    fontSize,
    fontStyle,
    color,
  }).setScrollFactor(0).setDepth(HUD_DEPTH);
}

function createPlayerPanel(scene: Phaser.Scene, accent: string): PlayerPanel {
  return {
    background: createGraphics(scene),
    bars: createGraphics(scene),
    label: createText(scene, accent, "11px", "bold").setLetterSpacing(.8),
    state: createText(scene, MUTED, "9px", "bold").setOrigin(1, 0),
    health: createText(scene, NEUTRAL, "10px", "bold"),
    armor: createText(scene, NEUTRAL, "10px", "bold"),
    ammo: createText(scene, MUTED, "9px", "bold"),
  };
}

function destroyPlayerPanel(panel: PlayerPanel): void {
  panel.background.destroy();
  panel.bars.destroy();
  panel.label.destroy();
  panel.state.destroy();
  panel.health.destroy();
  panel.armor.destroy();
  panel.ammo.destroy();
}

function setPlayerPanelVisible(panel: PlayerPanel, visible: boolean): void {
  panel.background.setVisible(visible);
  panel.bars.setVisible(visible);
  panel.label.setVisible(visible);
  panel.state.setVisible(visible);
  panel.health.setVisible(visible);
  panel.armor.setVisible(visible);
  panel.ammo.setVisible(visible);
}

function updatePlayerPanel(
  panel: PlayerPanel,
  label: string,
  actor: WorldSnapshot["actors"][number] | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
): void {
  setPlayerPanelVisible(panel, true);
  const compact = width <= 160;
  drawPanel(panel.background, x, y, width, height, compact ? 9 : 10);
  panel.label
    .setPosition(x + (compact ? 8 : 9), y + (compact ? 6 : 7))
    .setFontSize(compact ? "10px" : "11px")
    .setText(label);
  panel.state
    .setPosition(x + width - (compact ? 8 : 9), y + (compact ? 6 : 7))
    .setFontSize(compact ? "8px" : "9px")
    .setText(lifeLabel(actor));
  panel.health
    .setPosition(x + (compact ? 8 : 9), y + (compact ? 22 : 24))
    .setFontSize(compact ? "10px" : "10px")
    .setText(`HP ${actor?.health ?? 0}`);
  panel.armor
    .setPosition(x + width - (compact ? 58 : 62), y + (compact ? 22 : 24))
    .setFontSize(compact ? "10px" : "10px")
    .setText(`AR ${actor?.armor ?? 0}`);
  panel.ammo
    .setPosition(x + (compact ? 8 : 9), y + (compact ? 45 : 49))
    .setFontSize(compact ? "8px" : "9px")
    .setText(
      `R ${actor?.weapons.rocketAmmo ?? 0}  RL ${
        actor?.weapons.railAmmo ?? 0
      }  W ${actor?.weapons.whipAmmo ?? 0}`,
    );

  const healthRatio = actor
    ? Phaser.Math.Clamp(actor.health / Math.max(1, actor.maxHealth), 0, 1)
    : 0;
  const armorRatio = actor
    ? Phaser.Math.Clamp(actor.armor / Math.max(1, actor.maxArmor), 0, 1)
    : 0;
  const gap = compact ? 6 : 7;
  const barY = y + (compact ? 35 : 38);
  const inset = compact ? 8 : 9;
  const healthWidth = Math.floor((width - inset * 2 - gap) * .64);
  const armorWidth = width - inset * 2 - gap - healthWidth;
  panel.bars.clear();
  drawBar(panel.bars, x + inset, barY, healthWidth, 4, healthRatio, 0x56c98c);
  drawBar(
    panel.bars,
    x + inset + healthWidth + gap,
    barY,
    armorWidth,
    4,
    armorRatio,
    Phaser.Display.Color.HexStringToColor(accent).color,
  );
}

function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  graphics.clear();
  graphics.fillStyle(PANEL_FILL, .88);
  graphics.fillRoundedRect(x, y, width, height, radius);
  graphics.lineStyle(1, PANEL_STROKE, .16);
  graphics.strokeRoundedRect(x, y, width, height, radius);
}

function drawBar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  color: number,
): void {
  graphics.fillStyle(0xffffff, .12);
  graphics.fillRoundedRect(x, y, width, height, height / 2);
  if (ratio > 0) {
    graphics.fillStyle(color, .95);
    graphics.fillRoundedRect(x, y, width * ratio, height, height / 2);
  }
}

function objectiveStatus(state: ModeHudState, compact: boolean): string {
  if (state.modeId === "classic-ctf") {
    const red = state.objectives.find((objective) =>
      objective.id === "red-flag"
    );
    const blue = state.objectives.find((objective) =>
      objective.id === "blue-flag"
    );
    return compact
      ? `R ${flagLabel(red, true)}  |  B ${flagLabel(blue, true)}`
      : `RED ${flagLabel(red)}  |  BLUE ${flagLabel(blue)}`;
  }
  if (state.modeId === "one-flag") {
    const center = state.objectives.find((objective) =>
      objective.id === "center-flag"
    );
    return compact
      ? `FLAG ${flagLabel(center)}`
      : `CENTER ${flagLabel(center)}`;
  }
  return "";
}

function flagLabel(
  objective: ModeHudState["objectives"][number] | undefined,
  compact = false,
): string {
  if (objective?.state.status === "carried") return "OUT";
  if (objective?.state.status !== "dropped") return "HOME";
  const seconds = Math.ceil(
    Math.max(0, objective.state.returnRemainingMs ?? 0) / 100,
  ) / 10;
  return compact ? `D${seconds}` : `DROP ${seconds}S`;
}

function lifeLabel(
  actor: WorldSnapshot["actors"][number] | undefined,
): string {
  if (actor?.lifeState === "active") {
    return "READY";
  }
  if (!actor) {
    return "MISSING";
  }
  const seconds = Math.ceil((actor.respawn?.remainingMs ?? 0) / 100) / 10;
  return `${actor.lifeState.toUpperCase()} ${seconds}s`;
}

function formatTime(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function shortRuleText(state: ModeHudState): string {
  if (state.modeId === "classic-ctf") {
    return "FIRST TO 3";
  }
  if (state.modeId === "one-flag") {
    const center = state.objectives.find((objective) =>
      objective.id === "center-flag"
    );
    return center?.state.status === "carried"
      ? "TAKE FLAG TO ENEMY BASE"
      : "SECURE CENTER FLAG";
  }
  return "FIRST TO 3";
}
