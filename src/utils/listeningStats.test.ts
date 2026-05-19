import { describe, expect, it } from "vitest";
import {
  addListeningSeconds,
  formatListeningDuration,
  loadListeningSeconds,
} from "./listeningStats";

describe("listening stats", () => {
  it("starts at zero", async () => {
    expect(await loadListeningSeconds()).toBe(0);
  });

  it("accumulates seconds across writes", async () => {
    await addListeningSeconds(30);
    await addListeningSeconds(15.5);
    expect(await loadListeningSeconds()).toBe(45.5);
  });

  it("ignores non-positive and non-finite values", async () => {
    await addListeningSeconds(-5);
    await addListeningSeconds(0);
    await addListeningSeconds(Number.NaN);
    await addListeningSeconds(Number.POSITIVE_INFINITY);
    expect(await loadListeningSeconds()).toBe(0);
  });
});

describe("formatListeningDuration", () => {
  it("shows 0m for less than a minute", () => {
    expect(formatListeningDuration(0)).toBe(`0m`);
    expect(formatListeningDuration(45)).toBe(`0m`);
  });
  it("shows minutes only when under an hour", () => {
    expect(formatListeningDuration(60)).toBe(`1m`);
    expect(formatListeningDuration(59 * 60)).toBe(`59m`);
  });
  it("combines hours and minutes when over an hour", () => {
    expect(formatListeningDuration(60 * 60)).toBe(`1h0m`);
    expect(formatListeningDuration(10 * 3600 + 10 * 60)).toBe(`10h10m`);
  });
});
