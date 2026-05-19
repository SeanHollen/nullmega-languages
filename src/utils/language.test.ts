import { describe, expect, it } from "vitest";
import {
  getStoredLanguage,
  setStoredLanguage,
  getCustomLanguages,
  addCustomLanguage,
} from "./language";

describe("selected language", () => {
  it("returns the default when nothing has been set", async () => {
    expect(await getStoredLanguage()).toBe(`French`);
  });

  it("round-trips a stored value", async () => {
    await setStoredLanguage(`Spanish`);
    expect(await getStoredLanguage()).toBe(`Spanish`);
  });
});

describe("custom languages", () => {
  it("returns an empty list initially", async () => {
    expect(await getCustomLanguages()).toEqual([]);
  });

  it("adds a custom language and returns it on subsequent reads", async () => {
    await addCustomLanguage(`Klingon`);
    expect(await getCustomLanguages()).toContain(`Klingon`);
  });

  it("is idempotent — adding the same language twice keeps a single entry", async () => {
    await addCustomLanguage(`Klingon`);
    await addCustomLanguage(`Klingon`);
    const all = await getCustomLanguages();
    expect(all.filter((l) => l === `Klingon`).length).toBe(1);
  });

  it("preserves insertion order", async () => {
    await addCustomLanguage(`Klingon`);
    await addCustomLanguage(`Esperanto`);
    await addCustomLanguage(`Quenya`);
    expect(await getCustomLanguages()).toEqual([`Klingon`, `Esperanto`, `Quenya`]);
  });
});
