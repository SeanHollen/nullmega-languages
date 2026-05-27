import { z } from "zod";
import { loadSettings } from "./settings";

const ChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
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

export interface ChatMetadata {
  mode: string;
  language: string;
  difficulty: number;
  userId: string;
}

export interface ChatBody {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: string };
  metadata?: ChatMetadata;
}

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface TTSBody {
  model: string;
  voice: string;
  input: string;
}

export async function callChat(body: ChatBody): Promise<ChatResponse> {
  const { textGen } = await loadSettings();

  let url: string;
  let outgoingBody: object;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (textGen) {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${textGen.key}`;
    // OpenAI rejects unknown fields — strip metadata for direct calls
    const { metadata: _metadata, ...rest } = body;
    outgoingBody = rest;
  } else {
    url = `${await resolvedBackendUrl()}/api/generate`;
    outgoingBody = body;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(outgoingBody) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return ChatResponseSchema.parse(await res.json());
}

export async function callContexts(body: ChatBody): Promise<ChatResponse> {
  const { textGen } = await loadSettings();

  let url: string;
  let outgoingBody: object;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (textGen) {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${textGen.key}`;
    const { metadata: _metadata, ...rest } = body;
    outgoingBody = rest;
  } else {
    url = `${await resolvedBackendUrl()}/api/contexts`;
    outgoingBody = body;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(outgoingBody) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return ChatResponseSchema.parse(await res.json());
}

export async function callGrammar(body: ChatBody): Promise<ChatResponse> {
  const { textGen } = await loadSettings();

  let url: string;
  let outgoingBody: object;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (textGen) {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${textGen.key}`;
    const { metadata: _metadata, ...rest } = body;
    outgoingBody = rest;
  } else {
    url = `${await resolvedBackendUrl()}/api/grammar`;
    outgoingBody = body;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(outgoingBody) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return ChatResponseSchema.parse(await res.json());
}

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

  // Convex backend returns { url } pointing at a stored MP3 in Convex file storage.
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

async function isBYOK(): Promise<boolean> {
  return (await loadSettings()).textGen !== null;
}

export async function callAuthLogin(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${await resolvedBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "placeholder" }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return AuthLoginResponseSchema.parse(await res.json());
}

// Onboarding always uses the backend — the user hasn't set up BYOK or authenticated yet,
// so we cannot route through callChat (which falls through to OpenAI directly when a key
// is present in env or storage).
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
