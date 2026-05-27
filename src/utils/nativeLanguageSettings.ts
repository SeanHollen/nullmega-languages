import { db } from "./db";

const KEY = `native_language`;
const DEFAULT_NATIVE_LANGUAGE = `English`;

export async function loadNativeLanguage(): Promise<string> {
  const row = await db().kv.get(KEY);
  const value = row?.value;
  return typeof value === `string` && value.length > 0 ? value : DEFAULT_NATIVE_LANGUAGE;
}

export async function saveNativeLanguage(language: string): Promise<void> {
  await db().kv.put({ key: KEY, value: language });
}
