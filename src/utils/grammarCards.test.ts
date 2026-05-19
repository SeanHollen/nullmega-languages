import { describe, expect, it } from "vitest";
import { resetDb } from "../test-setup";
import {
  addGrammarCards,
  loadGrammarCards,
  patchGrammarCard,
  removeGrammarCard,
  computeGrammarStatus,
  exportGrammarCards,
  importGrammarCards,
} from "./grammarCards";

function rawCard(title: string) {
  return {
    title,
    prompt: `prompt`,
    category: `tense-conjugation` as const,
    questions: [{ type: `write-in` as const, prompt: `Fill: ___`, answer: `va` }],
  };
}

describe("addGrammarCards / loadGrammarCards", () => {
  it("creates cards in the given language and returns them on subsequent loads", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`one`), rawCard(`two`)], 30);
    const cards = await loadGrammarCards(`Spanish`);
    expect(cards.length).toBe(2);
    expect(cards.map((c) => c.title).sort()).toEqual([`one`, `two`]);
  });

  it("isolates cards per language", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`spanish-1`)], 30);
    await addGrammarCards(`French`, [rawCard(`french-1`)], 30);
    expect((await loadGrammarCards(`Spanish`)).map((c) => c.title)).toEqual([`spanish-1`]);
    expect((await loadGrammarCards(`French`)).map((c) => c.title)).toEqual([`french-1`]);
  });
});

describe("patchGrammarCard / removeGrammarCard", () => {
  it("updates a single card by id", async () => {
    const [card] = await addGrammarCards(`Spanish`, [rawCard(`one`)], 30);
    await patchGrammarCard(card.id, { status: `dropped` });
    const [updated] = await loadGrammarCards(`Spanish`);
    expect(updated.status).toBe(`dropped`);
  });

  it("removes a card by id", async () => {
    const [card] = await addGrammarCards(`Spanish`, [rawCard(`one`)], 30);
    await removeGrammarCard(card.id);
    expect(await loadGrammarCards(`Spanish`)).toEqual([]);
  });
});

describe("computeGrammarStatus", () => {
  it("returns 'learning' for a fresh card", async () => {
    const [card] = await addGrammarCards(`Spanish`, [rawCard(`one`)], 30);
    expect(computeGrammarStatus(card)).toBe(`learning`);
  });

  it("returns 'due' once the interval has elapsed", async () => {
    const [card] = await addGrammarCards(`Spanish`, [rawCard(`one`)], 30);
    await patchGrammarCard(card.id, {
      status: `scheduled`,
      lastReviewed: Date.now() - 2 * 24 * 60 * 60 * 1000,
      currentInterval: 24 * 60 * 60 * 1000,
    });
    const [updated] = await loadGrammarCards(`Spanish`);
    expect(computeGrammarStatus(updated)).toBe(`due`);
  });
});

describe("exportGrammarCards / importGrammarCards", () => {
  it("round-trips a card via JSON", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`exportable`)], 50);
    const json = await exportGrammarCards(`Spanish`);
    await resetDb();
    const result = await importGrammarCards(`Spanish`, json);
    expect(result.added).toBe(1);
    const [card] = await loadGrammarCards(`Spanish`);
    expect(card.title).toBe(`exportable`);
    expect(card.level).toBe(50);
  });

  it("skips duplicate titles already present in the language", async () => {
    await addGrammarCards(`Spanish`, [rawCard(`dup`)], 30);
    const json = JSON.stringify([{ ...rawCard(`dup`), level: 30 }]);
    const result = await importGrammarCards(`Spanish`, json);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
