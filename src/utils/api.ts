import { loadSettings } from "./settings";

const DEFAULT_BACKEND = (import.meta.env.VITE_BACKEND_URL as string) ?? "";

function resolvedBackendUrl(): string {
  const { backendUrl } = loadSettings();
  return backendUrl || DEFAULT_BACKEND;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatBody {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: string };
}

export interface ChatResponse {
  choices: { message: { content: string } }[];
}

export interface TTSBody {
  model: string;
  voice: string;
  input: string;
}

export async function callChat(body: ChatBody): Promise<ChatResponse> {
  const { textGen } = loadSettings();

  const url = textGen
    ? "https://api.openai.com/v1/chat/completions"
    : `${resolvedBackendUrl()}/api/generate`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (textGen) headers["Authorization"] = `Bearer ${textGen.key}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<ChatResponse>;
}

export async function callTTS(body: TTSBody): Promise<Blob> {
  const { tts } = loadSettings();

  const url = tts ? "https://api.openai.com/v1/audio/speech" : `${resolvedBackendUrl()}/api/speak`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tts) headers["Authorization"] = `Bearer ${tts.key}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);
  return res.blob();
}

function isBYOK(): boolean {
  return loadSettings().textGen !== null;
}

async function postJsonFireAndForget(path: string, payload: object): Promise<void> {
  const url = `${resolvedBackendUrl()}${path}`;
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
  if (isBYOK()) return;
  void postJsonFireAndForget("/api/history", payload);
}

export function submitFeedback(payload: object): void {
  if (isBYOK()) return;
  void postJsonFireAndForget("/api/feedback", payload);
}
