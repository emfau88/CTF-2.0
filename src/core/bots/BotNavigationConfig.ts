export interface BotNavigationConfig {
  readonly cellSize: number;
  readonly repathIntervalMs: number;
  readonly waypointReachDistance: number;
  readonly obstaclePadding: number;
}

export const V2_BOT_NAVIGATION_CONFIG: BotNavigationConfig = {
  cellSize: 40,
  repathIntervalMs: 420,
  waypointReachDistance: 24,
  obstaclePadding: 18,
};
