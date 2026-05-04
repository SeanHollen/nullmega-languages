import { Exercise } from "../types";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function pickVoice(): string {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

async function tts(text: string, voice: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "tts-1", voice, input: text }),
  });
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);
  const blob = await res.blob();
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
