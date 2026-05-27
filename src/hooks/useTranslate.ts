import { z } from "zod";

// Google Translate's unofficial endpoint returns a deeply-nested array shape:
// [[ [translatedChunk, sourceChunk, ...], ... ], ...]. We only need the first element's
// array of [string, ...] tuples, joining the translated chunks.
const TranslateResponseSchema = z
  .array(z.unknown())
  .min(1)
  .transform((arr) => arr[0])
  .pipe(z.array(z.tuple([z.string()]).rest(z.unknown())));

export async function translateOne(text: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const chunks = TranslateResponseSchema.parse(await res.json());
  return chunks.map((chunk) => chunk[0]).join("");
}

export async function translateBatch(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map(translateOne));
}
