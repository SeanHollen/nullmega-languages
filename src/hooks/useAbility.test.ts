import { beforeEach, describe, expect, it } from "vitest";
import { computeRating, loadAbility } from "./useAbility";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

describe("computeRating — placement", () => {
  it("anchors the rating at language complexity with a small ±2.5 nudge on the first assessment", () => {
    const win = computeRating("French", 10, 10, 30, "reading");
    expect(win.isPlacement).toBe(true);
    expect(win.oldRating).toBeNull();
    expect(win.newRating).toBe(32.5);

    localStorage.clear();
    const draw = computeRating("French", 7, 10, 30, "reading");
    expect(draw.newRating).toBe(30);

    localStorage.clear();
    const loss = computeRating("French", 3, 10, 30, "reading");
    expect(loss.newRating).toBe(27.5);
  });

  it("clamps placement to [1, 100]", () => {
    const low = computeRating("French", 0, 10, 1, "reading");
    expect(low.newRating).toBeGreaterThanOrEqual(1);

    localStorage.clear();
    const high = computeRating("French", 10, 10, 100, "reading");
    expect(high.newRating).toBeLessThanOrEqual(100);
  });
});

describe("computeRating — incremental K shrinks with confidence", () => {
  it("matches the spec example: win at 25 then win at 75 → ~47", () => {
    computeRating("French", 10, 10, 25, "reading");
    const second = computeRating("French", 10, 10, 75, "reading");
    expect(second.isPlacement).toBe(false);
    expect(second.newRating).toBeGreaterThan(45);
    expect(second.newRating).toBeLessThan(50);
  });

  it("produces large swings when confidence is low and small swings when high", () => {
    // First placement
    computeRating("French", 10, 10, 50, "reading");
    const r1 = loadAbility("French", "reading")!;
    // Second assessment — confidence ~1, K = 40/2 = 20
    computeRating("French", 10, 10, 50, "reading");
    const r2 = loadAbility("French", "reading")!;
    const swing2 = r2 - r1;
    // Do many more assessments to grow confidence
    for (let i = 0; i < 20; i++) {
      computeRating("French", 7, 10, 50, "reading");
    }
    const rN = loadAbility("French", "reading")!;
    // One more — confidence is high, swing should be much smaller
    computeRating("French", 10, 10, 50, "reading");
    const rNext = loadAbility("French", "reading")!;
    const swingN = rNext - rN;
    expect(Math.abs(swingN)).toBeLessThan(Math.abs(swing2));
  });
});

describe("computeRating — time decay", () => {
  it("decays confidence over time so an old user gets near-K_MAX swings again", () => {
    // Build up confidence with 5 back-to-back wins at language complexity 50
    for (let i = 0; i < 5; i++) {
      computeRating("French", 10, 10, 50, "reading");
    }
    const ratingBefore = loadAbility("French", "reading")!;

    // Simulate 2 years passing by rewinding the stored confidence timestamp
    const confKey = "ability_french_confidence";
    const conf = JSON.parse(localStorage.getItem(confKey)!);
    conf.updatedAt -= 2 * 365 * DAY;
    localStorage.setItem(confKey, JSON.stringify(conf));

    // Next assessment after long gap — K should be close to K_MAX again
    const result = computeRating("French", 10, 10, 80, "reading");
    const ratingAfter = result.newRating;
    const swing = ratingAfter - ratingBefore;
    // With fresh confidence the swing was ≲ K_MAX/2 = 20; here it should be larger because
    // confidence decayed nearly to 0 (2 years ≫ τ).
    expect(swing).toBeGreaterThan(15);
  });

  it("does not decay when assessments are back-to-back (Δt ≈ 0)", () => {
    computeRating("French", 10, 10, 50, "reading"); // placement, conf=1
    computeRating("French", 10, 10, 50, "reading"); // K = 40/2 = 20
    const ratingAfter2 = loadAbility("French", "reading")!;
    // Third should use K = 40/3 ≈ 13.3, not back near 40
    computeRating("French", 10, 10, 50, "reading");
    const ratingAfter3 = loadAbility("French", "reading")!;
    const swing3 = ratingAfter3 - ratingAfter2;
    expect(swing3).toBeLessThan(15);
  });
});

describe("computeRating — bootstrap from history", () => {
  it("bootstraps confidence from assessment_history when no confidence key exists", () => {
    // Seed an existing rating and a fake history with 10 recent assessments,
    // but no confidence record (simulating a pre-upgrade user).
    localStorage.setItem("ability_french", "55");
    const now = Date.now();
    const history = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      mode: "reading",
      language: "French",
      title: "",
      difficulty: 55,
      scoreEarned: 7,
      scoreMax: 10,
      ratingBefore: 50,
      ratingAfter: 55,
      completedAt: now - i * DAY,
      helpful: null,
    }));
    localStorage.setItem("assessment_history", JSON.stringify(history));

    // Next assessment — bootstrap should give confidence ≈ 10 (all recent),
    // so K ≈ 40/11 ≈ 3.6, a small swing.
    const before = loadAbility("French", "reading")!;
    computeRating("French", 10, 10, 55, "reading");
    const after = loadAbility("French", "reading")!;
    expect(Math.abs(after - before)).toBeLessThan(5);
  });

  it("returns confidence=0 when no history and no stored confidence", () => {
    // Set rating directly to skip placement branch
    localStorage.setItem("ability_french", "50");
    const before = loadAbility("French", "reading")!;
    // No history, no confidence — first call computes K = 40/(0+1) = 40, big swing
    computeRating("French", 10, 10, 50, "reading");
    const after = loadAbility("French", "reading")!;
    expect(Math.abs(after - before)).toBeGreaterThan(15);
  });
});

describe("computeRating — mode and language isolation", () => {
  it("keeps separate state per (mode, language)", () => {
    computeRating("French", 10, 10, 30, "reading");
    computeRating("Spanish", 10, 10, 70, "reading");
    computeRating("French", 10, 10, 30, "listening");

    expect(loadAbility("French", "reading")).toBe(32.5);
    expect(loadAbility("Spanish", "reading")).toBe(72.5);
    expect(loadAbility("French", "listening")).toBe(32.5);
    expect(loadAbility("French", "writing")).toBeNull();
  });
});
