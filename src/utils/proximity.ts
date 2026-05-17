export function pickClosest<T>(
  items: T[],
  pick: (item: T) => number,
  target: number,
  limit: number,
): T[] {
  return [...items]
    .sort((a, b) => Math.abs(pick(a) - target) - Math.abs(pick(b) - target))
    .slice(0, limit);
}
