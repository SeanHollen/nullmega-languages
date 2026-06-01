// Two paths for every LLM operation:
//   - BYOK: frontend builds the prompt (from src/utils/prompts.ts) and hits OpenAI directly.
//   - Standard: frontend sends a small parameterised body to the backend, which picks the
//     model and prompt server-side, and uses its own past-generation history to compute
//     avoidance. The standard prompt may drift from the BYOK prompt over time.

import { z } from "zod";
import { loadSettings } from "./settings";
import { getUserId } from "./user";
import { getPastSummariesByComplexity } from "./history";
import { pickClosest } from "./proximity";
import {
  buildReadingExercisePrompt,
  buildWritingExercisePrompt,
  buildPronunciationExercisePrompt,
  buildWritingGraderPrompt,
  buildVocabParagraphGraderPrompt,
  buildContextsPrompt,
  buildGrammarCardsPrompt,
  GRAMMAR_CARDS_SYSTEM_MESSAGE,
  type ReadingLength,
} from "./prompts";
import type { NarratorGender } from "../types";
import { recordUsage, type UsageCategory } from "./apiUsage";

const ChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
});

const TTSUrlResponseSchema = z.object({ url: z.string() });

const AuthLoginResponseSchema = z.object({ token: z.string(), userId: z.string() });

const OnboardingExamplesResponseSchema = z.object({ examples: z.record(z.string(), z.unknown()) });

const DEFAULT_BACKEND = (import.meta.env.VITE_BACKEND_URL as string) ?? "";

async function resolvedBackendUrl(): Promise<string> {
  const { backendUrl } = await loadSettings();
  return backendUrl || DEFAULT_BACKEND;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenAIChatBody {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: string };
}

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface TTSBody {
  model: string;
  voice: string;
  input: string;
  instructions?: string;
}

const BYOK_MODEL = "o4-mini";

async function isBYOK(): Promise<boolean> {
  return (await loadSettings()).textGen !== null;
}

async function postBYOK(body: OpenAIChatBody, category: UsageCategory): Promise<ChatResponse> {
  const { textGen } = await loadSettings();
  if (!textGen) throw new Error("BYOK called with no key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${textGen.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const parsed = ChatResponseSchema.parse(await res.json());
  const usage = parsed.usage;
  if (usage) {
    void recordUsage({
      category,
      model: body.model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    });
  }
  return parsed;
}

async function postBackend(path: string, body: object): Promise<ChatResponse> {
  const res = await fetch(`${await resolvedBackendUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return ChatResponseSchema.parse(await res.json());
}

// ---------- Reading / listening ----------

export async function callReadingExercise(params: {
  language: string;
  languageComplexity: number;
  length: ReadingLength;
  mode: "reading" | "listening";
  narratorGender: NarratorGender;
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    const pastSummaries = await getPastSummariesByComplexity(
      params.mode,
      params.language,
      params.languageComplexity,
      100,
    );
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [
          { role: "user", content: buildReadingExercisePrompt({ ...params, pastSummaries }) },
        ],
        response_format: { type: "json_object" },
      },
      params.mode,
    );
  }
  return postBackend("/api/exercise/reading", { ...params, userId: await getUserId() });
}

// ---------- Writing exercise ----------

export async function callWritingExercise(params: {
  language: string;
  languageComplexity: number;
  mode: "short-answer" | "dictogloss";
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    const pastSummaries = await getPastSummariesByComplexity(
      "writing",
      params.language,
      params.languageComplexity,
      100,
    );
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [
          { role: "user", content: buildWritingExercisePrompt({ ...params, pastSummaries }) },
        ],
        response_format: { type: "json_object" },
      },
      `writing`,
    );
  }
  return postBackend("/api/exercise/writing", { ...params, userId: await getUserId() });
}

// ---------- Pronunciation ----------

export async function callPronunciationExercise(params: {
  language: string;
  languageComplexity: number;
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    const pastTitles = await getPastSummariesByComplexity(
      "pronunciation",
      params.language,
      params.languageComplexity,
      500,
    );
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [
          { role: "user", content: buildPronunciationExercisePrompt({ ...params, pastTitles }) },
        ],
        response_format: { type: "json_object" },
      },
      `pronunciation`,
    );
  }
  return postBackend("/api/exercise/pronunciation", { ...params, userId: await getUserId() });
}

// ---------- Writing grader ----------

export async function callWritingGrader(params: {
  language: string;
  languageComplexity: number;
  passage: string;
  questions: {
    type: "short" | "essay";
    question: string;
    answer: string;
    minWords?: number;
    maxWords?: number;
  }[];
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [{ role: "user", content: buildWritingGraderPrompt(params) }],
        response_format: { type: "json_object" },
      },
      `writing`,
    );
  }
  return postBackend("/api/grade/writing", params);
}

// ---------- Vocab-paragraph grader ----------

export async function callVocabParagraphGrader(params: {
  language: string;
  languageComplexity: number;
  requiredWords: { source: string; translation: string }[];
  paragraph: string;
  nativeLanguage: string;
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [{ role: "user", content: buildVocabParagraphGraderPrompt(params) }],
        response_format: { type: "json_object" },
      },
      `writing`,
    );
  }
  return postBackend("/api/grade/vocab-paragraph", params);
}

// ---------- Flashcard contexts ----------

export async function callContextsGenerate(params: {
  language: string;
  word: string;
  translation: string;
  includeTranslation: boolean;
  count: number;
  nativeLanguage: string;
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [{ role: "user", content: buildContextsPrompt(params) }],
        response_format: { type: "json_object" },
      },
      `vocabulary`,
    );
  }
  return postBackend("/api/contexts", params);
}

// ---------- Grammar quiz cards ----------

export async function callGrammarCardsGenerate(params: {
  language: string;
  level: number;
  count: number;
  // Used for BYOK avoidance only. Backend computes its own avoidance from its DB.
  existingCards: { title: string; level: number }[];
}): Promise<ChatResponse> {
  if (await isBYOK()) {
    const pastTitles = pickClosest(params.existingCards, (c) => c.level, params.level, 500).map(
      (c) => c.title,
    );
    return postBYOK(
      {
        model: BYOK_MODEL,
        messages: [
          { role: "system", content: GRAMMAR_CARDS_SYSTEM_MESSAGE },
          {
            role: "user",
            content: buildGrammarCardsPrompt({
              language: params.language,
              level: params.level,
              count: params.count,
              pastTitles,
            }),
          },
        ],
        response_format: { type: "json_object" },
      },
      `grammar`,
    );
  }
  const { existingCards: _ignored, ...backendBody } = params;
  return postBackend("/api/grammar", backendBody);
}

// ---------- TTS (unchanged shape — already operation-specific) ----------

export async function callTTS(body: TTSBody): Promise<Blob> {
  const { tts } = await loadSettings();

  if (tts) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tts.key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    return res.blob();
  }

  const res = await fetch(`${await resolvedBackendUrl()}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);
  const { url } = TTSUrlResponseSchema.parse(await res.json());
  const audioRes = await fetch(url);
  if (!audioRes.ok) throw new Error(`TTS audio fetch error: ${audioRes.status}`);
  return audioRes.blob();
}

// ---------- Auth + onboarding ----------

export async function callAuthLogin(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${await resolvedBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "placeholder" }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return AuthLoginResponseSchema.parse(await res.json());
}

export async function callOnboardingComplexityExamples(
  language: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${await resolvedBackendUrl()}/api/onboarding/complexity-examples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new Error(`Examples request failed: ${res.status}`);
  const { examples } = OnboardingExamplesResponseSchema.parse(await res.json());
  return examples;
}

// ---------- History / feedback uploads (fire-and-forget) ----------

async function postJsonFireAndForget(path: string, payload: object): Promise<void> {
  const url = `${await resolvedBackendUrl()}${path}`;
  if (!url || url.startsWith(path)) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow — history upload is best-effort
  }
}

export function uploadAssessment(payload: object): void {
  void (async () => {
    if (await isBYOK()) return;
    await postJsonFireAndForget("/api/history", payload);
  })();
}

export function submitFeedback(payload: object): void {
  void (async () => {
    if (await isBYOK()) return;
    await postJsonFireAndForget("/api/feedback", payload);
  })();
}
