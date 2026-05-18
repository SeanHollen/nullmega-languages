import { beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import {
  loadGrammarSettings,
  saveGrammarSettings,
  getGeneratedTodayCount,
  recordGeneratedToday,
  shiftGrammarSessionDate,
} from "./grammarSettings";

beforeEach(async () => {
  await Dexie.delete(`language-lab`);
});

describe("loadGrammarSettings", () => {
  it("returns DEFAULTS when nothing is saved", async () => {
    expect(await loadGrammarSettings()).toEqual({ newCardsPerDay: 3, level: 20 });
  });

  it("round-trips saved values", async () => {
    await saveGrammarSettings({ newCardsPerDay: 8, level: 70 });
    expect(await loadGrammarSettings()).toEqual({ newCardsPerDay: 8, level: 70 });
  });

  it("clamps level to the 10-100 range", async () => {
    await saveGrammarSettings({ newCardsPerDay: 3, level: 250 });
    expect((await loadGrammarSettings()).level).toBe(100);
  });
});

describe("generated-today counter", () => {
  it("returns 0 when nothing was recorded", async () => {
    expect(await getGeneratedTodayCount()).toBe(0);
  });

  it("accumulates the count across multiple records on the same day", async () => {
    await recordGeneratedToday(1);
    await recordGeneratedToday(2);
    expect(await getGeneratedTodayCount()).toBe(3);
  });

  it("returns 0 once today's session is shifted into the past", async () => {
    await recordGeneratedToday(5);
    await shiftGrammarSessionDate(1);
    expect(await getGeneratedTodayCount()).toBe(0);
  });
});
