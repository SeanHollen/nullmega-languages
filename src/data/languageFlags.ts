export const LANGUAGE_FLAGS: Record<string, string> = {
  English: `🇬🇧`,
  French: `🇫🇷`,
  Spanish: `🇪🇸`,
  German: `🇩🇪`,
  Italian: `🇮🇹`,
  Portuguese: `🇵🇹`,
  Japanese: `🇯🇵`,
  "Chinese (Mandarin)": `🇨🇳`,
  Korean: `🇰🇷`,
  Arabic: `🇸🇦`,
  Russian: `🇷🇺`,
  Dutch: `🇳🇱`,
  Swedish: `🇸🇪`,
  Polish: `🇵🇱`,
  Turkish: `🇹🇷`,
  Hindi: `🇮🇳`,
};

export const DEFAULT_FLAG = `🌐`;

export function flagFor(language: string): string {
  return LANGUAGE_FLAGS[language] ?? DEFAULT_FLAG;
}
