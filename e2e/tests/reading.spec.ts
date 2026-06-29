import { test, expect } from "@playwright/test";
import { seedAuthedSession } from "./auth.ts";

const FIXTURE_TITLE = "駅の傘";
const FIXTURE_QUESTIONS = [
  { question: "頼りに傘を見分けて", correctOption: "細かい使用の跡" },
  { question: "山田さんの最初の反応", correctOption: "経験の浅さ" },
  { question: "金色の刺繍は", correctOption: "所有者を特定する手掛かり" },
  { question: "黙っていたのはなぜ", correctOption: "自慢を避けるため" },
];

test("Reading flow: generate Japanese passage, answer all correctly, see win", async ({
  page,
  baseURL,
}) => {
  await seedAuthedSession(page, baseURL!);

  // Radix select in the banner — open + click the option, not native selectOption.
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Japanese" }).click();

  await page.locator("button", { hasText: "Reading" }).first().click();
  await expect(page.getByRole("heading", { name: /Reading/ })).toBeVisible();

  await page.getByRole("button", { name: /Generate Reading Exercise/ }).click();

  // Real Convex call lands; mock returns the Japanese fixture; UI renders the passage.
  await expect(page.getByText(FIXTURE_TITLE, { exact: false })).toBeVisible({
    timeout: 60_000,
  });

  for (const q of FIXTURE_QUESTIONS) {
    const block = page.locator("div", { hasText: q.question }).first();
    await block.getByText(q.correctOption, { exact: false }).first().click();
  }

  await page.getByRole("button", { name: /Submit/i }).click();

  await expect(page.getByText(/Win/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("4/4")).toBeVisible();
});
