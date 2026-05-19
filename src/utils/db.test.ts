import { describe, expect, it } from "vitest";
import { db } from "./db";

describe("db()", () => {
  it("returns the same Dexie instance across repeated calls", () => {
    expect(db()).toBe(db());
  });
});
