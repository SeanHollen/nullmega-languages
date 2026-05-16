export function deltaColor(delta: number): string {
  if (delta > 0) return `text-green-600`;
  if (delta < 0) return `text-red-500`;
  return `text-gray-500`;
}
