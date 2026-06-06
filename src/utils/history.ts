import type { Mode } from "../hooks/useAbility";
import type { Exercise } from "../types";
import type { WritingExercise } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import type { PronunciationPhrase } from "../hooks/useGeneratePronunciation";
import { pickClosest } from "./proximity";
import { db } from "./db";

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
  audioKeyPassage?: string;
}

export type PhraseRating = "good" | "medium" | "bad" | null;

export interface PronunciationBody {
  title: string;
  phrases: PronunciationPhrase[];
  audioKeys: string[];
  ratings: PhraseRating[];
}

export type AssessmentBody = ReadingBody | ListeningBody | WritingBody | PronunciationBody;

export interface AssessmentFields {
  mode: Mode;
  language: string;
  title: string;
  difficulty: number;
  scoreEarned: number;
  scoreMax: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
  // null while the assessment is still in progress (saved at generation, not yet submitted)
  completedAt: number | null;
  // Full exercise body + user inputs. Discriminated by `mode`. Optional for legacy records
  // that pre-date this field.
  body?: AssessmentBody;
}

export interface AssessmentInput extends AssessmentFields {
  createdAt?: number;
}

export interface AssessmentRecord extends AssessmentFields {
  id: string;
  createdAt: number;
  helpful: boolean | null;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveAssessment(rec: AssessmentInput): Promise<string> {
  const id = genId();
  const record: AssessmentRecord = {
    ...rec,
    id,
    helpful: null,
    createdAt: rec.createdAt ?? Date.now(),
  };
  await db().assessments.put(record);
  return id;
}

export async function updateAssessment(
  id: string,
  patch: Partial<AssessmentRecord>,
): Promise<void> {
  const existing = await db().assessments.get(id);
  if (!existing) return;
  await db().assessments.put({ ...existing, ...patch });
}

export async function getAssessment(id: string): Promise<AssessmentRecord | null> {
  const row = await db().assessments.get(id);
  return row ?? null;
}

export async function updateFeedback(id: string, helpful: boolean): Promise<void> {
  await updateAssessment(id, { helpful });
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db_ = new Date(b);
  return (
    da.getFullYear() === db_.getFullYear() &&
    da.getMonth() === db_.getMonth() &&
    da.getDate() === db_.getDate()
  );
}

export async function getCompletedToday(mode: Mode, language: string): Promise<number> {
  const now = Date.now();
  const records = await db()
    .assessments.where(`[mode+language]`)
    .equals([mode, language])
    .toArray();
  return records.filter((r) => typeof r.completedAt === `number` && sameDay(r.completedAt, now))
    .length;
}

export async function getHistory(mode: Mode, language: string): Promise<AssessmentRecord[]> {
  const records = await db()
    .assessments.where(`[mode+language]`)
    .equals([mode, language])
    .toArray();
  return records.sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
}

function passageSummary(record: AssessmentRecord): string | null {
  const body = record.body;
  if (body && `exercise` in body && typeof body.exercise.summary === `string`) {
    const s = body.exercise.summary.trim();
    if (s.length > 0) return s;
  }
  if (typeof record.title === `string` && record.title.length > 0 && record.title !== `Untitled`) {
    return record.title;
  }
  return null;
}

export async function getPastSummariesByComplexity(
  mode: Mode,
  language: string,
  languageComplexity: number,
  limit: number,
): Promise<string[]> {
  const records = await db()
    .assessments.where(`[mode+language]`)
    .equals([mode, language])
    .toArray();
  const eligible: { record: AssessmentRecord; summary: string }[] = [];
  for (const r of records) {
    const s = passageSummary(r);
    if (s) eligible.push({ record: r, summary: s });
  }
  return pickClosest(eligible, (e) => e.record.difficulty, languageComplexity, limit).map(
    (e) => e.summary,
  );
}

// Reading/listening passages carry a `length` knob. We scale points to reward longer
// passages and discount shorter ones. Writing/pronunciation have no length variant; they
// always get the normal multiplier.
function lengthMultiplier(record: AssessmentRecord): number {
  if (record.mode !== `reading` && record.mode !== `listening`) return 1;
  const body = record.body;
  if (!body || !(`exercise` in body)) return 1;
  const length = (body as { exercise: { length?: unknown } }).exercise.length;
  if (length === `short`) return 0.5;
  if (length === `long`) return 2;
  return 1;
}

export function pointsForRecord(record: AssessmentRecord): number {
  if (record.scoreMax <= 0) return 0;
  const pct = record.scoreEarned / record.scoreMax;
  const mult = lengthMultiplier(record);
  if (pct >= 0.9) return record.difficulty * mult;
  if (pct >= 0.6) return (record.difficulty / 2) * mult;
  return 0;
}
