export interface BotNavigationConfig {
  readonly cellSize: number;
  readonly repathIntervalMs: number;
  readonly waypointReachDistance: number;
  readonly obstaclePadding: number;
  readonly inputMagnitude: number;
}

export const V2_TDM_BOT_NAVIGATION_CONFIG: BotNavigationConfig = {
  cellSize: 40,
  repathIntervalMs: 420,
  waypointReachDistance: 24,
  obstaclePadding: 18,
  inputMagnitude: .82,
};
