import type { Exercise } from "../types";
import { pickVoice, tts, type TtsKind } from "../utils/tts";
import { saveAudio } from "../utils/db";

export interface ExerciseAudio {
  passageUrl: string;
  questionUrls: string[];
}

export interface ExerciseAudioKeys {
  passage: string;
  questions: string[];
}

export async function generateExerciseAudio(
  exercise: Exercise,
  keys: ExerciseAudioKeys,
  language: string,
): Promise<ExerciseAudio> {
  const voice = pickVoice(exercise.narratorGender);
  const blobs = await Promise.all([
    tts(exercise.passage, voice, `passage`, language, exercise.id),
    ...exercise.questions.map((q) => tts(q.question, voice, `passage`, language)),
  ]);
  await saveAudio(keys.passage, blobs[0]);
  await Promise.all(exercise.questions.map((_, i) => saveAudio(keys.questions[i], blobs[i + 1])));
  return {
    passageUrl: URL.createObjectURL(blobs[0]),
    questionUrls: blobs.slice(1).map((b) => URL.createObjectURL(b)),
  };
}

export async function generatePhrasesAudio(
  phrases: string[],
  keys: string[],
  kind: TtsKind,
  language: string,
): Promise<string[]> {
  const voice = pickVoice();
  const blobs = await Promise.all(phrases.map((p) => tts(p, voice, kind, language)));
  await Promise.all(blobs.map((b, i) => saveAudio(keys[i], b)));
  return blobs.map((b) => URL.createObjectURL(b));
}
