import { Mode } from "../hooks/useAbility";

export interface AssessmentRecord {
  id: string;
  mode: Mode;
  language: string;
  difficulty: number;
  scoreEarned: number;
  scoreMax: number;
  completedAt: number;
  helpful: boolean | null;
}

const KEY = "assessment_history";
const MAX_ENTRIES = 200;

function load(): AssessmentRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AssessmentRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(records: AssessmentRecord[]): void {
  const trimmed = records.slice(-MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveAssessment(rec: Omit<AssessmentRecord, "id" | "helpful">): string {
  const id = genId();
  const records = load();
  records.push({ ...rec, id, helpful: null });
  persist(records);
  return id;
}

export function updateFeedback(id: string, helpful: boolean): void {
  const records = load();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  records[idx] = { ...records[idx], helpful };
  persist(records);
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function getCompletedToday(mode: Mode): number {
  const now = Date.now();
  return load().filter((r) => r.mode === mode && sameDay(r.completedAt, now)).length;
}
