import { db } from "./db";

const KEY = `dictionaryEnabled`;

export async function loadDictionaryEnabled(): Promise<boolean> {
  const row = await db().kv.get(KEY);
  return row?.value !== false;
}

export async function saveDictionaryEnabled(enabled: boolean): Promise<void> {
  await db().kv.put({ key: KEY, value: enabled });
}
