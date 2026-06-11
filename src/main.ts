import Phaser from "phaser";
import { GameplayV2Scene } from "./adapters/phaser";
import { ArenaScene } from "./scenes/ArenaScene";

const useGameplayV2Shell = new URLSearchParams(window.location.search)
  .get("scene") === "v2";

if (useGameplayV2Shell) {
  document.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "");
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#edf5ee",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { antialias: true },
  scene: [useGameplayV2Shell ? GameplayV2Scene : ArenaScene],
});
