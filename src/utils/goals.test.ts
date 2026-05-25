import { describe, expect, it } from "vitest";
import { loadGoals, saveGoals } from "./goals";
import { db } from "./db";

describe("loadGoals", () => {
  it("returns DEFAULTS when no goals have been saved for the language", async () => {
    const goals = await loadGoals(`French`);
    expect(goals).toEqual({ reading: 0, listening: 2, pronunciation: 1, writing: 0 });
  });

  it("returns saved values for the matching language", async () => {
    await saveGoals(`French`, { reading: 3, listening: 2, pronunciation: 1, writing: 0 });
    const goals = await loadGoals(`French`);
    expect(goals).toEqual({ reading: 3, listening: 2, pronunciation: 1, writing: 0 });
  });

  it("isolates goals per language", async () => {
    await saveGoals(`French`, { reading: 3, listening: 3, pronunciation: 3, writing: 3 });
    await saveGoals(`Spanish`, { reading: 1, listening: 0, pronunciation: 0, writing: 0 });
    expect(await loadGoals(`French`)).toMatchObject({ reading: 3, writing: 3 });
    expect(await loadGoals(`Spanish`)).toMatchObject({ reading: 1, writing: 0 });
  });

  it("falls back to DEFAULTS for individual missing fields if a partial row exists", async () => {
    // Simulate a row written before a new mode was added — Dexie put preserves what's stored.
    await db().goals.put({ language: `French`, reading: 5 } as never);
    const goals = await loadGoals(`French`);
    expect(goals.reading).toBe(5);
    expect(goals.listening).toBe(2);
  });
});

describe("saveGoals", () => {
  it("overwrites previous goals for the same language", async () => {
    await saveGoals(`French`, { reading: 5, listening: 5, pronunciation: 5, writing: 5 });
    await saveGoals(`French`, { reading: 1, listening: 1, pronunciation: 1, writing: 1 });
    const goals = await loadGoals(`French`);
    expect(goals).toEqual({ reading: 1, listening: 1, pronunciation: 1, writing: 1 });
  });
});
