import { describe, expect, it } from "vitest";
import {
  loadGrammarSettings,
  saveGrammarSettings,
  getGeneratedTodayCount,
} from "./grammarSettings";
import { addGrammarCards } from "./grammarCards";
import { db } from "./db";

describe("loadGrammarSettings", () => {
  it("returns DEFAULTS when nothing is saved for the given language", async () => {
    expect(await loadGrammarSettings(`Spanish`)).toEqual({ newCardsPerDay: 0, level: 20 });
  });

  it("round-trips saved values per language", async () => {
    await saveGrammarSettings(`Spanish`, { newCardsPerDay: 8, level: 70 });
    expect(await loadGrammarSettings(`Spanish`)).toEqual({ newCardsPerDay: 8, level: 70 });
  });

  it("isolates settings between languages", async () => {
    await saveGrammarSettings(`Spanish`, { newCardsPerDay: 8, level: 70 });
    await saveGrammarSettings(`French`, { newCardsPerDay: 2, level: 30 });
    expect(await loadGrammarSettings(`Spanish`)).toEqual({ newCardsPerDay: 8, level: 70 });
    expect(await loadGrammarSettings(`French`)).toEqual({ newCardsPerDay: 2, level: 30 });
    // Untouched language still returns defaults.
    expect(await loadGrammarSettings(`German`)).toEqual({ newCardsPerDay: 0, level: 20 });
  });

  it("clamps level to the 10-100 range", async () => {
    await saveGrammarSettings(`Spanish`, { newCardsPerDay: 3, level: 250 });
    expect((await loadGrammarSettings(`Spanish`)).level).toBe(100);
  });
});

const rawCard = (title: string) => ({
  title,
  prompt: `prompt`,
  tags: [],
  questions: [{ type: `multiple-choice` as const, prompt: `q`, choices: [`a`, `b`], answer: `a` }],
});

describe("getGeneratedTodayCount (derived from grammar cards' addedAt)", () => {
  it("returns 0 when nothing was generated", async () => {
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(0);
  });

  it("counts cards added in this language today", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`a`), rawCard(`b`), rawCard(`c`)], 20);
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(3);
  });

  it("is per-language — counter in one language is unaffected by cards in another", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`a`)], 20);
    await addGrammarCards(`French`, [rawCard(`b`), rawCard(`c`)], 20);
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(1);
    expect(await getGeneratedTodayCount(`French`)).toBe(2);
    expect(await getGeneratedTodayCount(`German`)).toBe(0);
  });

  it("excludes cards with addedAt before today's local midnight", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`fresh`)], 20);
    // Backdate one card to "yesterday" via direct DB write.
    const all = await db().grammarCards.where(`language`).equals(`Spanish`).toArray();
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    await db().grammarCards.put({ ...all[0], addedAt: yesterday });
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(0);
  });

  it("rolls back when cards generated today are deleted", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`a`), rawCard(`b`)], 20);
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(2);
    const all = await db().grammarCards.where(`language`).equals(`Spanish`).toArray();
    await db().grammarCards.delete(all[0].id);
    expect(await getGeneratedTodayCount(`Spanish`)).toBe(1);
  });
});
