import type { NarratorGender } from "../types";
import { callTTS } from "./api";

const MALE_VOICES = ["echo", "fable", "onyx"] as const;
const FEMALE_VOICES = ["nova", "shimmer"] as const;

// tts-1-hd has better prosody on longer narrative text but tends to over-interpret short
// fragments (inserted pauses, guessed pronunciations of unusual words, aggressive
// abbreviation expansion). tts-1 is more literal and predictable — better for vocab
// card contexts where short and faithful is more important than expressive.
export type TtsModel = "tts-1" | "tts-1-hd";

export function pickVoice(gender?: NarratorGender): string {
  let pool: readonly string[] = [...MALE_VOICES, ...FEMALE_VOICES];
  if (gender === `male`) pool = MALE_VOICES;
  if (gender === `female`) pool = FEMALE_VOICES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function stripBold(text: string): string {
  // ** markers are stored on source text so the UI can bold the target word, but TTS
  // would read them as "asterisk asterisk".
  return text.split("**").join("");
}

export async function tts(text: string, voice: string, model: TtsModel): Promise<Blob> {
  return callTTS({ model, voice, input: stripBold(text) });
}
