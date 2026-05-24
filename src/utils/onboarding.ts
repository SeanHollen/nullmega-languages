import { db } from "./db";
import type { Mode } from "../hooks/useAbility";

const PER_MODE_RATIO: Record<Mode, number> = {
  reading: 1,
  listening: 0.6,
  pronunciation: 0.5,
  writing: 0.3,
};

const ONBOARDING_COMPLETE_KEY = `onboardingComplete`;
const BACKEND_MODE_KEY = `backendMode`;

export type BackendMode = "standard" | "byok";

function perModeKey(language: string): string {
  return `defaultLanguageComplexity_${language}`;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const row = await db().kv.get(ONBOARDING_COMPLETE_KEY);
  return row?.value === true;
}

export async function markOnboardingComplete(): Promise<void> {
  await db().kv.put({ key: ONBOARDING_COMPLETE_KEY, value: true });
}

export async function clearOnboarding(): Promise<void> {
  await db().kv.delete(ONBOARDING_COMPLETE_KEY);
}

export async function loadBackendMode(): Promise<BackendMode | null> {
  const row = await db().kv.get(BACKEND_MODE_KEY);
  const v = row?.value;
  return v === `standard` || v === `byok` ? v : null;
}

export async function saveBackendMode(mode: BackendMode): Promise<void> {
  await db().kv.put({ key: BACKEND_MODE_KEY, value: mode });
}

export interface PerModeDefaults {
  reading: number;
  listening: number;
  pronunciation: number;
  writing: number;
}

export function computePerModeDefaults(chosen: number): PerModeDefaults {
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  return {
    reading: clamp(chosen * PER_MODE_RATIO.reading),
    listening: clamp(chosen * PER_MODE_RATIO.listening),
    pronunciation: clamp(chosen * PER_MODE_RATIO.pronunciation),
    writing: clamp(chosen * PER_MODE_RATIO.writing),
  };
}

export async function savePerModeDefaults(language: string, chosen: number): Promise<void> {
  await db().kv.put({
    key: perModeKey(language),
    value: { chosen, ...computePerModeDefaults(chosen) },
  });
}

export async function loadPerModeDefault(language: string, mode: Mode): Promise<number | null> {
  const row = await db().kv.get(perModeKey(language));
  const v = row?.value as Partial<PerModeDefaults> | null;
  const n = v?.[mode];
  return typeof n === `number` ? n : null;
}
