import { describe, expect, it } from "vitest";
import { referenceBlocks } from "./levelReferences";

describe("referenceBlocks", () => {
  it("includes target plus one easier and one harder level", () => {
    const out = referenceBlocks(50);
    expect(out).toContain("One level easier (level 49)");
    expect(out).toContain("Target level (level 50)");
    expect(out).toContain("One level harder (level 51)");
  });

  it("rounds fractional levels so the prompt always gets real example passages", () => {
    const out = referenceBlocks(33.6);
    expect(out).toContain("One level easier (level 33)");
    expect(out).toContain("Target level (level 34)");
    expect(out).toContain("One level harder (level 35)");
    expect(out).toContain("Example A:");
  });

  it("clamps level 1 so the easier neighbor doesn't fall out of range", () => {
    const out = referenceBlocks(1);
    expect(out).toContain("One level easier (level 1)");
    expect(out).toContain("Target level (level 1)");
    expect(out).toContain("One level harder (level 2)");
  });

  it("clamps level 100 so the harder neighbor doesn't fall out of range", () => {
    const out = referenceBlocks(100);
    expect(out).toContain("One level easier (level 99)");
    expect(out).toContain("Target level (level 100)");
    expect(out).toContain("One level harder (level 100)");
  });

  it("includes question lines only when includeQuestion is true", () => {
    expect(referenceBlocks(10, { includeQuestion: true })).toContain("Question A:");
    expect(referenceBlocks(10)).not.toContain("Question A:");
  });
});
