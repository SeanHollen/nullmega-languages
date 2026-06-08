import type { NarratorGender } from "../types";
import { callTTS } from "./api";
import { loadSettings } from "./settings";

const MALE_VOICES = ["echo", "fable", "onyx"] as const;
const FEMALE_VOICES = ["nova", "shimmer"] as const;

// Describes what's being spoken so this module can pick the right model. Callers should
// not pick models directly: tts-1-hd has better prosody on long narrative text but
// over-interprets short fragments (inserted pauses, guessed pronunciations, aggressive
// abbreviation expansion); tts-1 is more literal — better for vocab card contexts.
export type TtsKind = "passage" | "phrase";

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

export async function tts(
  text: string,
  voice: string,
  kind: TtsKind,
  language: string,
): Promise<Blob> {
  const { ttsModel } = await loadSettings();
  const input = stripBold(text);
  if (ttsModel === `gpt-4o-mini-tts`) {
    return callTTS({
      model: `gpt-4o-mini-tts`,
      voice,
      input,
      instructions: `You are a native ${language} speaker mid-conversation with a friend. Deliver this line the way you'd actually say it — fast, casual, slurred where natural. Not for an audience, not for clarity, not slowed for any word.`,
    });
  }
  const model = kind === `passage` ? `tts-1-hd` : `tts-1`;
  return callTTS({ model, voice, input });
}
