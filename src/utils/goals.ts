import { Mode } from "../hooks/useAbility";

export type Goals = Record<Mode, number>;

const KEY = "daily_goals";

const DEFAULTS: Goals = {
  reading: 1,
  listening: 1,
  pronunciation: 1,
  writing: 1,
};

export const GOAL_MIN = 0;
export const GOAL_MAX = 10;

export function loadGoals(): Goals {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Goals>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveGoals(goals: Goals): void {
  localStorage.setItem(KEY, JSON.stringify(goals));
}
