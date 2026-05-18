import { db } from "./db";

export const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Chinese (Mandarin)",
  "Korean",
  "Arabic",
  "Russian",
  "Dutch",
  "Swedish",
  "Polish",
  "Turkish",
  "Hindi",
];

const SELECTED_KEY = `selectedLanguage`;
const DEFAULT = `French`;

export async function getStoredLanguage(): Promise<string> {
  const row = await db().kv.get(SELECTED_KEY);
  const value = row?.value;
  return typeof value === `string` && value.length > 0 ? value : DEFAULT;
}

export async function setStoredLanguage(lang: string): Promise<void> {
  await db().kv.put({ key: SELECTED_KEY, value: lang });
}

interface CustomRow {
  name: string;
  order: number;
}

export async function getCustomLanguages(): Promise<string[]> {
  const rows = (await db().customLanguages.toArray()) as CustomRow[];
  return rows.sort((a, b) => a.order - b.order).map((r) => r.name);
}

export async function addCustomLanguage(lang: string): Promise<string[]> {
  const existing = await db().customLanguages.get(lang);
  if (existing) return getCustomLanguages();
  const count = await db().customLanguages.count();
  await db().customLanguages.put({ name: lang, order: count } as never);
  return getCustomLanguages();
}
