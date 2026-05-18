import { db } from "./db";

const KEY = `user_id`;

export async function getUserId(): Promise<string> {
  const row = await db().kv.get(KEY);
  if (typeof row?.value === `string` && row.value.length > 0) return row.value;
  const id = crypto.randomUUID();
  await db().kv.put({ key: KEY, value: id });
  return id;
}
