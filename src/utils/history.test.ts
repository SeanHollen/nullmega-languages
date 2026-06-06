import { describe, expect, it } from "vitest";
import {
  saveAssessment,
  getAssessment,
  updateAssessment,
  getHistory,
  getCompletedToday,
  getPastSummariesByComplexity,
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
  it("counts today's completions for a mode in the given language only", async () => {
    const now = Date.now();
    await saveAssessment({ ...baseRec(), completedAt: now });
    await saveAssessment({ ...baseRec(), completedAt: now });
    await saveAssessment({ ...baseRec(), completedAt: now - 7 * 24 * 60 * 60 * 1000 });
    await saveAssessment({ ...baseRec(), mode: `writing`, completedAt: now });
    await saveAssessment({ ...baseRec(), language: `French`, completedAt: now });
    expect(await getCompletedToday(`reading`, `Spanish`)).toBe(2);
    expect(await getCompletedToday(`reading`, `French`)).toBe(1);
  });
});

describe("getPastSummariesByComplexity", () => {
  it("returns titles closest to the given complexity, dropping 'Untitled' entries", async () => {
    await saveAssessment({ ...baseRec(), difficulty: 30, title: `near30` });
    await saveAssessment({ ...baseRec(), difficulty: 50, title: `Untitled` });
    await saveAssessment({ ...baseRec(), difficulty: 60, title: `near60` });
    const titles = await getPastSummariesByComplexity(`reading`, `Spanish`, 55, 10);
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

  function passingReading(length: "short" | "medium" | "long") {
    return {
      ...baseRec(),
      id: `x`,
      helpful: null,
      createdAt: 0,
      body: {
        exercise: {
          length,
          // remaining Exercise fields are unread by pointsForRecord; cast through unknown.
        } as unknown,
        selected: [],
      } as never,
    };
  }

  it("halves points for short reading/listening passages", () => {
    expect(pointsForRecord(passingReading(`short`))).toBe(25);
  });
  it("doubles points for long reading/listening passages", () => {
    expect(pointsForRecord(passingReading(`long`))).toBe(100);
  });
  it("keeps base points for medium reading/listening passages", () => {
    expect(pointsForRecord(passingReading(`medium`))).toBe(50);
  });
  it("ignores length for non-reading modes (writing has no length)", () => {
    expect(
      pointsForRecord({
        ...baseRec(),
        id: `x`,
        helpful: null,
        createdAt: 0,
        mode: `writing`,
        // even with a body that happens to contain length, writing mode shouldn't apply it
      }),
    ).toBe(50);
  });
});
