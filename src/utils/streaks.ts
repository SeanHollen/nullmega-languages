import { db } from "./db";

export interface StreakRecord {
  date: string; // YYYY-MM-DD (local time)
  hadObligations: boolean;
  complete: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayStr(): string {
  return dateStr(new Date());
}

export async function loadStreaks(): Promise<StreakRecord[]> {
  const all = await db().streaks.toArray();
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function recordToday(
  complete: boolean,
  hadObligations: boolean,
): Promise<StreakRecord> {
  const rec: StreakRecord = { date: todayStr(), hadObligations, complete };
  await db().streaks.put(rec);
  return rec;
}

// Walks back from today. A day counts toward the streak if it is "complete" or had no
// obligations. A day with unmet obligations breaks it. A missing-record day breaks it,
// with one exception: today itself can be missing or incomplete and the streak continues
// from yesterday (so the count doesn't drop until the user has actually failed the day).
export function computeCurrentStreak(records: StreakRecord[]): number {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateStr(today);
  const cursor = new Date(today);
  let streak = 0;
  while (true) {
    const key = dateStr(cursor);
    const rec = byDate.get(key);
    if (!rec) {
      if (key === todayKey) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      return streak;
    }
    if (rec.hadObligations && !rec.complete) {
      if (key === todayKey) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      return streak;
    }
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
}
