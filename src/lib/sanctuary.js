export const LANTERN_LIFETIME = 120_000;
export const STILLNESS_INTERVAL = 120_000;
export const MAX_FLOWERS = 12;

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

export function stillnessGrowth(now, lastActivity, currentFlowers, visible = true) {
  if (!visible || now - lastActivity < STILLNESS_INTERVAL) return currentFlowers;
  return Math.min(MAX_FLOWERS, currentFlowers + 1);
}

export function lanternProgress(createdAt, now) {
  return Math.max(0, Math.min(1, (now - createdAt) / LANTERN_LIFETIME));
}

// The view follows a bounded ellipse. The visitor can never leave the island.
export function constrainTarget(x, z) {
  const distance = Math.sqrt((x / 5) ** 2 + (z / 3.5) ** 2);
  return distance > 1 ? [x / distance, z / distance] : [x, z];
}
