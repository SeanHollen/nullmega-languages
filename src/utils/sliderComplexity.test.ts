import { describe, expect, it } from "vitest";
import { resolveSliderComplexity } from "./sliderComplexity";

describe("resolveSliderComplexity", () => {
  it("uses the saved rating when there is no override (regression: was falling back to default while savedRating loaded)", () => {
    expect(
      resolveSliderComplexity({
        override: null,
        savedRating: 29.4,
        defaultComplexity: 40,
      }),
    ).toBe(29.4);
  });

  it("falls back to default when the saved rating is still loading (undefined)", () => {
    expect(
      resolveSliderComplexity({
        override: null,
        savedRating: undefined,
        defaultComplexity: 40,
      }),
    ).toBe(40);
  });

  it("falls back to default when the user has no saved rating yet (null)", () => {
    expect(
      resolveSliderComplexity({
        override: null,
        savedRating: null,
        defaultComplexity: 40,
      }),
    ).toBe(40);
  });

  it("prefers the user override over the saved rating", () => {
    expect(
      resolveSliderComplexity({
        override: 70,
        savedRating: 29.4,
        defaultComplexity: 40,
      }),
    ).toBe(70);
  });
});
