import type { Exercise } from "../types";
import { pickVoice, tts } from "../utils/tts";
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
): Promise<ExerciseAudio> {
  const voice = pickVoice(exercise.narratorGender);
  const blobs = await Promise.all([
    tts(exercise.passage, voice, `tts-1-hd`),
    ...exercise.questions.map((q) => tts(q.question, voice, `tts-1-hd`)),
  ]);
  await saveAudio(keys.passage, blobs[0]);
  await Promise.all(exercise.questions.map((_, i) => saveAudio(keys.questions[i], blobs[i + 1])));
  return {
    passageUrl: URL.createObjectURL(blobs[0]),
    questionUrls: blobs.slice(1).map((b) => URL.createObjectURL(b)),
  };
}

export async function generatePhrasesAudio(phrases: string[], keys: string[]): Promise<string[]> {
  const voice = pickVoice();
  const blobs = await Promise.all(phrases.map((p) => tts(p, voice, `tts-1-hd`)));
  await Promise.all(blobs.map((b, i) => saveAudio(keys[i], b)));
  return blobs.map((b) => URL.createObjectURL(b));
}
