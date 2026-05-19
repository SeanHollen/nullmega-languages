import { db } from "./db";

const KEY = `listening-seconds-total`;

export async function loadListeningSeconds(): Promise<number> {
  const row = await db().kv.get(KEY);
  return typeof row?.value === `number` ? row.value : 0;
}

export async function addListeningSeconds(seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const current = await loadListeningSeconds();
  await db().kv.put({ key: KEY, value: current + seconds });
}

export function formatListeningDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}
