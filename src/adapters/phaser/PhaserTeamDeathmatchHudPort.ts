import Phaser from "phaser";
import type {
  CoreFrameResult,
  CoreInputFrame,
  ModeHudState,
  WorldSnapshot,
} from "../../core";
import type { FrameDiagnosticsPort } from "../debugging";
import type { HudPort } from "../hud";

export class PhaserTeamDeathmatchHudPort
implements HudPort, FrameDiagnosticsPort {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly blueText: Phaser.GameObjects.Text;
  private readonly redText: Phaser.GameObjects.Text;
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
    const panelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Consolas, monospace",
      fontSize: "16px",
      color: "#f5fbfa",
      backgroundColor: "#17302ddd",
    };
    this.scoreText = scene.add.text(0, 14, "", {
      ...panelStyle,
      fontSize: "20px",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(.5, 0).setPadding(12, 8).setScrollFactor(0).setDepth(1000);
    this.blueText = scene.add.text(14, 14, "", {
      ...panelStyle,
      color: "#b9d2ff",
    }).setPadding(10, 7).setScrollFactor(0).setDepth(1000);
    this.redText = scene.add.text(0, 14, "", {
      ...panelStyle,
      color: "#ffc8b8",
      align: "right",
    }).setOrigin(1, 0).setPadding(10, 7).setScrollFactor(0).setDepth(1000);
    this.controlsText = scene.add.text(
      14,
      0,
      mobileControls
        ? "TOUCH OR WASD     AUTO-FIRE     SPACE / JUMP"
        : botOpponent
          ? "P1  WASD / SPACE     AUTO-FIRE     RED BOT"
          : "P1  WASD / SPACE     P2  ARROWS / ENTER     AUTO-FIRE",
      {
        ...panelStyle,
        fontSize: "12px",
        color: "#dceae8",
      },
    ).setOrigin(0, 1).setPadding(8, 5).setScrollFactor(0).setDepth(1000);
    this.resultText = scene.add.text(0, 0, "", {
      ...panelStyle,
      fontSize: "30px",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(.5).setPadding(18, 12).setScrollFactor(0).setDepth(1001)
      .setVisible(false);
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
    this.scoreText.destroy();
    this.blueText.destroy();
    this.redText.destroy();
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

    this.scoreText.setPosition(width / 2, 14).setText([
      `BLUE  ${blueScore}  :  ${redScore}  RED`,
      `${formatTime(this.hudState.timeRemainingMs ?? 0)}  |  First to 3`,
    ]);
    this.blueText.setText(playerStatus("BLUE P1", blue));
    this.redText.setPosition(width - 14, 14).setText(
      playerStatus(this.botOpponent ? "RED BOT" : "RED P2", red),
    );
    this.controlsText.setPosition(14, height - 14);
    this.controlsText.setVisible(!this.mobileControls);
    this.resultText.setPosition(width / 2, height / 2);

    const result = this.hudState.matchResult;
    if (this.hudState.phase === "ended" && result) {
      const headline = result.kind === "draw"
        ? "DRAW"
        : `${result.winnerEntryId.toUpperCase()} WINS`;
      this.resultText.setText([
        headline,
        this.mobileControls ? "Tap to restart" : "Press R to restart",
      ]).setVisible(true);
    } else {
      this.resultText.setVisible(false);
    }
  }
}

function playerStatus(
  label: string,
  actor: WorldSnapshot["actors"][number] | undefined,
): string[] {
  return [
    label,
    `HP ${actor?.health ?? 0}  AR ${actor?.armor ?? 0}`,
    actor?.lifeState === "active"
      ? "ACTIVE"
      : `${actor?.lifeState.toUpperCase() ?? "MISSING"} ${
        Math.ceil((actor?.respawn?.remainingMs ?? 0) / 100) / 10
      }s`,
  ];
}

function formatTime(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
