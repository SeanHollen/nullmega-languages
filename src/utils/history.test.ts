import { describe, expect, it } from "vitest";
import {
  saveAssessment,
  getAssessment,
  updateAssessment,
  getHistory,
  getCompletedToday,
  getTitlesByComplexity,
  pointsForRecord,
} from "./history";

function baseRec() {
  return {
    mode: `reading` as const,
    language: `Spanish`,
    title: `t`,
    difficulty: 50,
    scoreEarned: 5,
    scoreMax: 5,
    ratingBefore: null,
    ratingAfter: 50,
    completedAt: Date.now(),
  };
}

describe("saveAssessment / getAssessment", () => {
  it("returns the id of a newly saved record and round-trips it", async () => {
    const id = await saveAssessment(baseRec());
    const rec = await getAssessment(id);
    expect(rec).not.toBeNull();
    expect(rec!.id).toBe(id);
    expect(rec!.helpful).toBeNull();
  });

  it("returns null for a missing id", async () => {
    expect(await getAssessment(`nope`)).toBeNull();
  });
});

describe("updateAssessment", () => {
  it("merges a patch onto an existing record", async () => {
    const id = await saveAssessment(baseRec());
    await updateAssessment(id, { helpful: true, scoreEarned: 7 });
    const rec = await getAssessment(id);
    expect(rec!.helpful).toBe(true);
    expect(rec!.scoreEarned).toBe(7);
  });

  it("does nothing for an unknown id", async () => {
    await updateAssessment(`nope`, { helpful: true });
    expect(await getAssessment(`nope`)).toBeNull();
  });
});

describe("getHistory", () => {
  it("filters by mode + language and sorts newest first", async () => {
    await saveAssessment({ ...baseRec(), completedAt: 100 });
    await saveAssessment({ ...baseRec(), completedAt: 300 });
    await saveAssessment({ ...baseRec(), completedAt: 200, mode: `writing` });
    const reading = await getHistory(`reading`, `Spanish`);
    expect(reading.map((r) => r.completedAt)).toEqual([300, 100]);
  });
});

describe("getCompletedToday", () => {
  it("counts today's completions for a mode", async () => {
    const now = Date.now();
    await saveAssessment({ ...baseRec(), completedAt: now });
    await saveAssessment({ ...baseRec(), completedAt: now });
    await saveAssessment({ ...baseRec(), completedAt: now - 7 * 24 * 60 * 60 * 1000 });
    await saveAssessment({ ...baseRec(), mode: `writing`, completedAt: now });
    expect(await getCompletedToday(`reading`)).toBe(2);
  });
});

describe("getTitlesByComplexity", () => {
  it("returns titles closest to the given complexity, dropping 'Untitled' entries", async () => {
    await saveAssessment({ ...baseRec(), difficulty: 30, title: `near30` });
    await saveAssessment({ ...baseRec(), difficulty: 50, title: `Untitled` });
    await saveAssessment({ ...baseRec(), difficulty: 60, title: `near60` });
    const titles = await getTitlesByComplexity(`reading`, `Spanish`, 55, 10);
    expect(titles).toContain(`near60`);
    expect(titles).toContain(`near30`);
    expect(titles).not.toContain(`Untitled`);
  });
});

describe("pointsForRecord", () => {
  it("returns difficulty for a >=90% score", () => {
    expect(pointsForRecord({ ...baseRec(), id: `x`, helpful: null, createdAt: 0 })).toBe(50);
  });
  it("returns difficulty/2 for a [60%, 90%) score", () => {
    expect(
      pointsForRecord({
        ...baseRec(),
        id: `x`,
        helpful: null,
        createdAt: 0,
        scoreEarned: 3,
      }),
    ).toBe(25);
  });
  it("returns 0 for a score below 60%", () => {
    expect(
      pointsForRecord({
        ...baseRec(),
        id: `x`,
        helpful: null,
        createdAt: 0,
        scoreEarned: 2,
      }),
    ).toBe(0);
  });
});
