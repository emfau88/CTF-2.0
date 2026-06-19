export function calculateV2TouchLayout(width: number, height: number) {
  const compact = width <= 720 || height <= 520;
  const jumpX = width - Math.max(compact ? 58 : 80, width * (compact ? .065 : .085));
  const jumpY = height - (compact ? 60 : 88);

  return {
    joy: {
      r: compact ? 46 : 56,
      knobR: compact ? 18 : 22,
      ox: Math.max(compact ? 70 : 96, width * (compact ? .09 : .12)),
      oy: height - (compact ? 62 : 88),
    },
    jump: {
      r: compact ? 40 : 48,
      x: jumpX,
      y: jumpY,
    },
    fire: {
      r: compact ? 34 : 40,
      x: jumpX - (compact ? 105 : 120),
      y: jumpY + (compact ? 3 : 8),
    },
    rocket: {
      r: compact ? 31 : 38,
      x: jumpX - (compact ? 150 : 168),
      y: jumpY - (compact ? 75 : 92),
    },
    rail: {
      r: compact ? 31 : 38,
      x: jumpX - (compact ? 55 : 72),
      y: jumpY - (compact ? 75 : 92),
    },
    whip: {
      r: compact ? 31 : 38,
      x: jumpX - (compact ? 235 : 260),
      y: jumpY - (compact ? 55 : 72),
    },
  };
}
