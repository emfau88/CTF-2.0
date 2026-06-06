export function calculateTouchLayout(width: number, height: number) {
  const compact = width <= 720 || height <= 520;
  const jumpX = width - Math.max(compact ? 60 : 84, width * (compact ? .07 : .09));
  const jumpY = height - (compact ? 66 : 94);

  return {
    joy: {
      r: compact ? 50 : 62,
      knobR: compact ? 18 : 22,
      ox: Math.max(compact ? 70 : 96, width * (compact ? .09 : .12)),
      oy: height - (compact ? 68 : 96),
    },
    jump: {
      r: compact ? 44 : 52,
      x: jumpX,
      y: jumpY,
    },
    rocket: {
      r: compact ? 35 : 43,
      x: jumpX - (compact ? 76 : 96),
      y: jumpY + (compact ? 5 : 10),
    },
    rail: {
      r: compact ? 35 : 43,
      x: jumpX - (compact ? 55 : 190),
      y: jumpY - (compact ? 68 : -10),
    },
    whip: {
      r: compact ? 35 : 43,
      x: jumpX - (compact ? 128 : 112),
      y: jumpY - (compact ? 62 : 84),
    },
  };
}
