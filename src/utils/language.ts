export const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Chinese (Mandarin)",
  "Korean",
  "Arabic",
  "Russian",
  "Dutch",
  "Swedish",
  "Polish",
  "Turkish",
  "Hindi",
];

const KEY = "selectedLanguage";
const CUSTOM_KEY = "customLanguages";
const DEFAULT = "French";

export function getStoredLanguage(): string {
  return localStorage.getItem(KEY) ?? DEFAULT;
}

export function setStoredLanguage(lang: string): void {
  localStorage.setItem(KEY, lang);
}

export function getCustomLanguages(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function addCustomLanguage(lang: string): string[] {
  const current = getCustomLanguages();
  if (current.includes(lang)) return current;
  const updated = [...current, lang];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
  return updated;
}
