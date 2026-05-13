import { Exercise } from "../types";
import { callTTS } from "../utils/api";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function pickVoice(): string {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

async function tts(text: string, voice: string): Promise<string> {
  const blob = await callTTS({ model: "tts-1", voice, input: text });
  return URL.createObjectURL(blob);
}

export interface ExerciseAudio {
  passageUrl: string;
  questionUrls: string[];
}

export async function generatePhrasesAudio(phrases: string[]): Promise<string[]> {
  const voice = pickVoice();
  return Promise.all(phrases.map((p) => tts(p, voice)));
}

export async function generateExerciseAudio(exercise: Exercise): Promise<ExerciseAudio> {
  const voice = pickVoice();
  const [passageUrl, ...questionUrls] = await Promise.all([
    tts(exercise.passage, voice),
    ...exercise.questions.map((q) => tts(q.question, voice)),
  ]);
  return { passageUrl, questionUrls };
}
