import type { Mode } from "../hooks/useAbility";
import { db } from "./db";

export type Goals = Record<Mode, number>;

const DEFAULTS: Goals = {
  reading: 0,
  listening: 2,
  pronunciation: 1,
  writing: 0,
};

export const GOAL_MIN = 0;
export const GOAL_MAX = 10;

export async function loadGoals(language: string): Promise<Goals> {
  const row = await db().goals.get(language);
  if (!row) return { ...DEFAULTS };
  const { language: _ignored, ...goals } = row;
  return { ...DEFAULTS, ...goals };
}

export async function saveGoals(language: string, goals: Goals): Promise<void> {
  await db().goals.put({ language, ...goals });
}
