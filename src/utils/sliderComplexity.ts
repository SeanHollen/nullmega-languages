export function resolveSliderComplexity(args: {
  override: number | null;
  savedRating: number | null | undefined;
  defaultComplexity: number;
}): number {
  if (args.override !== null) return args.override;
  if (typeof args.savedRating === `number`) return args.savedRating;
  return args.defaultComplexity;
}
