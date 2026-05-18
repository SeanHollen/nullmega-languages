import type { Exercise } from "../types";
import { callTTS } from "../utils/api";
import { saveAudio } from "../utils/db";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function pickVoice(): string {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

async function tts(text: string, voice: string): Promise<Blob> {
  return callTTS({ model: "tts-1", voice, input: text });
}

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
  const voice = pickVoice();
  const blobs = await Promise.all([
    tts(exercise.passage, voice),
    ...exercise.questions.map((q) => tts(q.question, voice)),
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
  const blobs = await Promise.all(phrases.map((p) => tts(p, voice)));
  await Promise.all(blobs.map((b, i) => saveAudio(keys[i], b)));
  return blobs.map((b) => URL.createObjectURL(b));
}
