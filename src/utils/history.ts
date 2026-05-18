import type { Mode } from "../hooks/useAbility";
import type { Exercise } from "../types";
import type { WritingExercise } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import type { PronunciationPhrase } from "../hooks/useGeneratePronunciation";
import { pickClosest } from "./proximity";

export interface ReadingBody {
  exercise: Exercise;
  selected: (number | null)[];
}

export interface ListeningBody {
  exercise: Exercise;
  selected: (number | null)[];
  audioKeyPassage: string | null;
  audioKeyQuestions: string[];
}

export interface WritingBody {
  exercise: WritingExercise;
  answers: string[];
  grades: WritingGrade[];
}

export type PhraseRating = "good" | "medium" | "bad" | null;

export interface PronunciationBody {
  title: string;
  phrases: PronunciationPhrase[];
  audioKeys: string[];
  ratings: PhraseRating[];
}

export type AssessmentBody = ReadingBody | ListeningBody | WritingBody | PronunciationBody;

export interface AssessmentRecord {
  id: string;
  mode: Mode;
  language: string;
  title: string;
  difficulty: number;
  scoreEarned: number;
  scoreMax: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
  createdAt: number;
  // null while the assessment is still in progress (saved at generation, not yet submitted)
  completedAt: number | null;
  helpful: boolean | null;
  // Full exercise body + user inputs. Discriminated by `mode`. Optional for legacy records
  // that pre-date this field.
  body?: AssessmentBody;
}

const KEY = "assessment_history";
const MAX_ENTRIES = 10000;

function load(): AssessmentRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AssessmentRecord[];
    // Backfill createdAt for legacy records (added after this field existed).
    for (const r of arr) {
      if (typeof r.createdAt !== "number") {
        r.createdAt = r.completedAt ?? 0;
      }
    }
    return arr;
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

export function saveAssessment(
  rec: Omit<AssessmentRecord, "id" | "helpful" | "createdAt"> & { createdAt?: number },
): string {
  const id = genId();
  const records = load();
  records.push({ ...rec, id, helpful: null, createdAt: rec.createdAt ?? Date.now() });
  persist(records);
  return id;
}

export function updateAssessment(id: string, patch: Partial<AssessmentRecord>): void {
  const records = load();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  records[idx] = { ...records[idx], ...patch };
  persist(records);
}

export function getAssessment(id: string): AssessmentRecord | null {
  return load().find((r) => r.id === id) ?? null;
}

export function updateFeedback(id: string, helpful: boolean): void {
  updateAssessment(id, { helpful });
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
  return load().filter(
    (r) => r.mode === mode && typeof r.completedAt === "number" && sameDay(r.completedAt, now),
  ).length;
}

export function getHistory(mode: Mode, language: string): AssessmentRecord[] {
  return load()
    .filter((r) => r.mode === mode && r.language === language)
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
}

export function getTitlesByComplexity(
  mode: Mode,
  language: string,
  languageComplexity: number,
  limit: number,
): string[] {
  const eligible = load()
    .filter((r) => r.mode === mode && r.language === language)
    .filter((r) => typeof r.title === "string" && r.title.length > 0 && r.title !== "Untitled");
  return pickClosest(eligible, (r) => r.difficulty, languageComplexity, limit).map((r) => r.title);
}

export function pointsForRecord(record: AssessmentRecord): number {
  if (record.scoreMax <= 0) return 0;
  const pct = record.scoreEarned / record.scoreMax;
  if (pct >= 0.9) return record.difficulty;
  if (pct >= 0.6) return record.difficulty / 2;
  return 0;
}
