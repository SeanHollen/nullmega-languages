import type { Mode } from "../hooks/useAbility";
import { getStoredLanguage } from "./language";

export type Goals = Record<Mode, number>;

const KEY = `daily_goals_by_language`;
const LEGACY_KEY = `daily_goals`;
const MIGRATION_FLAG = `daily_goals_v2`;

const DEFAULTS: Goals = {
  reading: 1,
  listening: 1,
  pronunciation: 1,
  writing: 1,
};

export const GOAL_MIN = 0;
export const GOAL_MAX = 10;

type Store = Record<string, Goals>;

// One-time: copy the old single-Goals object into the new per-language store, attached to
// whatever language is currently selected. Gated so it never runs twice.
function migrateLegacyGoals(): void {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const legacy = JSON.parse(raw) as Partial<Goals>;
      const merged: Goals = { ...DEFAULTS, ...legacy };
      const language = getStoredLanguage();
      const store: Store = { [language]: merged };
      localStorage.setItem(KEY, JSON.stringify(store));
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    // ignore
  }
  localStorage.setItem(MIGRATION_FLAG, `1`);
}

function loadStore(): Store {
  migrateLegacyGoals();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== `object`) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function loadGoals(language: string): Goals {
  const store = loadStore();
  const goals = store[language];
  if (!goals) return { ...DEFAULTS };
  return { ...DEFAULTS, ...goals };
}

export function saveGoals(language: string, goals: Goals): void {
  const store = loadStore();
  store[language] = goals;
  saveStore(store);
}
