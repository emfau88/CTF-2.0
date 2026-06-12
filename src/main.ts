import Phaser from "phaser";
import { GameplayV2Scene } from "./adapters/phaser";
import { ArenaScene } from "./scenes/ArenaScene";
import { showGameplayV2Menu } from "./v2Menu";

const search = new URLSearchParams(window.location.search);
const useGameplayV2Shell = search.get("scene") === "v2";
const showV2Menu = useGameplayV2Shell && !search.has("mode");

if (useGameplayV2Shell) {
  document.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "");
}

if (showV2Menu) {
  showGameplayV2Menu();
} else {
  if (useGameplayV2Shell) {
    const menuButton = document.querySelector<HTMLButtonElement>(
      "#v2-game-menu-button",
    );
    menuButton?.classList.remove("is-hidden");
    if (menuButton) {
      menuButton.onclick = () => {
        window.location.search = new URLSearchParams({
          scene: "v2",
        }).toString();
      };
    }
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
}
