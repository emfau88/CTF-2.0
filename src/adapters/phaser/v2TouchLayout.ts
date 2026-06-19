export function calculateV2TouchLayout(width: number, height: number) {
  const compact = width <= 720 || height <= 520;
  const attackX = width - Math.max(
    compact ? 52 : 78,
    width * (compact ? .055 : .065),
  );
  const attackY = height - (compact ? 52 : 80);

  return {
    joy: {
      r: compact ? 46 : 56,
      knobR: compact ? 18 : 22,
      ox: Math.max(compact ? 70 : 96, width * (compact ? .09 : .12)),
      oy: height - (compact ? 62 : 88),
    },
    jump: {
      r: compact ? 40 : 48,
      x: attackX,
      y: attackY,
    },
    fire: {
      r: compact ? 32 : 38,
      x: attackX - (compact ? 98 : 118),
      y: attackY + (compact ? 3 : 4),
    },
    rocket: {
      r: compact ? 29 : 36,
      x: attackX - (compact ? 100 : 118),
      y: attackY - (compact ? 89 : 122),
    },
    rail: {
      r: compact ? 29 : 36,
      x: attackX - (compact ? 32 : 38),
      y: attackY - (compact ? 100 : 138),
    },
    whip: {
      r: compact ? 29 : 36,
      x: attackX - (compact ? 158 : 188),
      y: attackY - (compact ? 55 : 66),
    },
  };
}
