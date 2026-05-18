import { beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import {
  loadVocabSettings,
  saveVocabSettings,
  getLearnedTodayCount,
  recordLearnedToday,
  shiftLearnSessionDate,
} from "./vocabSettings";

beforeEach(async () => {
  await Dexie.delete(`language-lab`);
});

describe("loadVocabSettings", () => {
  it("returns DEFAULTS when nothing is saved", async () => {
    const s = await loadVocabSettings();
    expect(s).toEqual({
      newWordsPerDay: 5,
      contextsPerCard: 3,
      order: `random`,
      generateAudio: true,
      autoplayAudio: true,
      showText: true,
    });
  });

  it("round-trips saved values", async () => {
    await saveVocabSettings({
      newWordsPerDay: 10,
      contextsPerCard: 7,
      order: `added`,
      generateAudio: false,
      autoplayAudio: false,
      showText: false,
    });
    const s = await loadVocabSettings();
    expect(s).toEqual({
      newWordsPerDay: 10,
      contextsPerCard: 7,
      order: `added`,
      generateAudio: false,
      autoplayAudio: false,
      showText: false,
    });
  });

  it("clamps newWordsPerDay above the max", async () => {
    await saveVocabSettings({
      newWordsPerDay: 999,
      contextsPerCard: 3,
      order: `random`,
      generateAudio: true,
      autoplayAudio: true,
      showText: true,
    });
    const s = await loadVocabSettings();
    expect(s.newWordsPerDay).toBe(50);
  });

  it("falls back to default for invalid order value", async () => {
    await saveVocabSettings({
      newWordsPerDay: 5,
      contextsPerCard: 3,
      // @ts-expect-error testing invalid input
      order: `nonsense`,
      generateAudio: true,
      autoplayAudio: true,
      showText: true,
    });
    const s = await loadVocabSettings();
    expect(s.order).toBe(`random`);
  });
});

describe("learned-today counter", () => {
  it("returns 0 when nothing was recorded", async () => {
    expect(await getLearnedTodayCount()).toBe(0);
  });

  it("increments the count across multiple records on the same day", async () => {
    await recordLearnedToday(2);
    await recordLearnedToday(3);
    expect(await getLearnedTodayCount()).toBe(5);
  });

  it("treats a past-day record as zero for today", async () => {
    await recordLearnedToday(5);
    await shiftLearnSessionDate(1);
    expect(await getLearnedTodayCount()).toBe(0);
  });

  it("resumes incrementing after shifting back into today", async () => {
    await recordLearnedToday(5);
    await shiftLearnSessionDate(1); // counts as yesterday
    await recordLearnedToday(3); // today
    expect(await getLearnedTodayCount()).toBe(3);
  });
});
