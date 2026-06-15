export interface BotMovementConfig {
  readonly inputMagnitude: number;
  readonly standoffMinRange: number;
  readonly standoffDesiredRange: number;
  readonly standoffMaxRange: number;
}

export const V2_BOT_MOVEMENT_CONFIG: BotMovementConfig = {
  inputMagnitude: 1,
  standoffMinRange: 96,
  standoffDesiredRange: 160,
  standoffMaxRange: 210,
};
