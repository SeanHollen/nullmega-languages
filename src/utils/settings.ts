export type Provider = "openai";

export interface ProviderConfig {
  provider: Provider;
  key: string;
}

export interface AppSettings {
  textGen: ProviderConfig | null;
  tts: ProviderConfig | null;
  backendUrl: string;
}

const KEYS = {
  textGen: "settings_textGen",
  tts: "settings_tts",
  backendUrl: "settings_backendUrl",
};

function parseJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function loadSettings(): AppSettings {
  const envKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? "";
  const envFallback: ProviderConfig | null = envKey ? { provider: "openai", key: envKey } : null;
  return {
    textGen: parseJson<ProviderConfig>(KEYS.textGen) ?? envFallback,
    tts: parseJson<ProviderConfig>(KEYS.tts) ?? envFallback,
    backendUrl: localStorage.getItem(KEYS.backendUrl) ?? "",
  };
}

export function saveSettings(s: AppSettings): void {
  if (s.textGen) {
    localStorage.setItem(KEYS.textGen, JSON.stringify(s.textGen));
  } else {
    localStorage.removeItem(KEYS.textGen);
  }
  if (s.tts) {
    localStorage.setItem(KEYS.tts, JSON.stringify(s.tts));
  } else {
    localStorage.removeItem(KEYS.tts);
  }
  if (s.backendUrl) {
    localStorage.setItem(KEYS.backendUrl, s.backendUrl);
  } else {
    localStorage.removeItem(KEYS.backendUrl);
  }
}
