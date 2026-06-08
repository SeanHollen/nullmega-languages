import { db } from "./db";
import { DEFAULT_TTS_MODEL, type TtsModel } from "./models";

export type Provider = "openai";

export interface ProviderConfig {
  provider: Provider;
  key: string;
}

export interface AppSettings {
  textGen: ProviderConfig | null;
  tts: ProviderConfig | null;
  ttsModel: TtsModel;
  backendUrl: string;
}

const KEYS = {
  textGen: `settings_textGen`,
  tts: `settings_tts`,
  ttsModel: `settings_ttsModel`,
  backendUrl: `settings_backendUrl`,
  authToken: `authToken`,
  authUserId: `authUserId`,
};

export interface AuthInfo {
  token: string;
  userId: string;
}

async function getValue<T>(key: string): Promise<T | null> {
  const row = await db().kv.get(key);
  return row ? ((row.value ?? null) as T | null) : null;
}

async function putValue(key: string, value: unknown): Promise<void> {
  await db().kv.put({ key, value });
}

export async function loadSettings(): Promise<AppSettings> {
  const envKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? ``;
  const envFallback: ProviderConfig | null = envKey ? { provider: `openai`, key: envKey } : null;
  const [textGen, tts, ttsModel, backendUrl] = await Promise.all([
    getValue<ProviderConfig>(KEYS.textGen),
    getValue<ProviderConfig>(KEYS.tts),
    getValue<TtsModel>(KEYS.ttsModel),
    getValue<string>(KEYS.backendUrl),
  ]);
  return {
    textGen: textGen ?? envFallback,
    tts: tts ?? envFallback,
    ttsModel: ttsModel ?? DEFAULT_TTS_MODEL,
    backendUrl: backendUrl ?? ``,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  if (s.textGen) await putValue(KEYS.textGen, s.textGen);
  else await db().kv.delete(KEYS.textGen);
  if (s.tts) await putValue(KEYS.tts, s.tts);
  else await db().kv.delete(KEYS.tts);
  await putValue(KEYS.ttsModel, s.ttsModel);
  if (s.backendUrl) await putValue(KEYS.backendUrl, s.backendUrl);
  else await db().kv.delete(KEYS.backendUrl);
}

export async function loadAuthInfo(): Promise<AuthInfo | null> {
  const [token, userId] = await Promise.all([
    getValue<string>(KEYS.authToken),
    getValue<string>(KEYS.authUserId),
  ]);
  return token && userId ? { token, userId } : null;
}

export async function saveAuthInfo(info: AuthInfo): Promise<void> {
  await putValue(KEYS.authToken, info.token);
  await putValue(KEYS.authUserId, info.userId);
}
