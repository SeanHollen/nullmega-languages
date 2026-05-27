import { z } from "zod";
import { db } from "./db";
import { wiktionaryCode } from "../data/wiktionaryCodes";

const WiktionaryParseResponseSchema = z.object({
  parse: z.object({ text: z.string() }).optional(),
});

interface CachedEntry {
  html: string | null;
  fetchedAt: number;
}

const MEMORY_CACHE = new Map<string, CachedEntry>();
const MAX_FOLLOW_DEPTH = 1;
const FIRST_DEF_CHAR_LIMIT = 120;

function cacheKey(code: string, word: string): string {
  return `wikt:${code}:${word.toLowerCase()}`;
}

async function readCache(code: string, word: string): Promise<CachedEntry | undefined> {
  const key = cacheKey(code, word);
  const mem = MEMORY_CACHE.get(key);
  if (mem) return mem;
  const row = await db().kv.get(key);
  if (!row) return undefined;
  const entry = row.value as CachedEntry;
  MEMORY_CACHE.set(key, entry);
  return entry;
}

async function writeCache(code: string, word: string, entry: CachedEntry): Promise<void> {
  const key = cacheKey(code, word);
  MEMORY_CACHE.set(key, entry);
  await db().kv.put({ key, value: entry });
}

async function fetchParseHtml(code: string, word: string): Promise<string | null> {
  const url = `https://${code}.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(
    word,
  )}&prop=text&format=json&formatversion=2&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const result = WiktionaryParseResponseSchema.safeParse(await res.json());
  if (!result.success || !result.data.parse?.text) return null;
  return result.data.parse.text;
}

function stripChrome(html: string, code: string): string {
  const doc = new DOMParser().parseFromString(html, `text/html`);
  doc
    .querySelectorAll(
      `.mw-editsection, .reference, .noprint, .navbox, script, style, .mw-empty-elt`,
    )
    .forEach((el) => el.remove());
  doc.querySelectorAll(`a[href]`).forEach((a) => {
    const href = a.getAttribute(`href`) ?? ``;
    if (href.startsWith(`/wiki/`) || href.startsWith(`/w/`)) {
      a.setAttribute(`href`, `https://${code}.wiktionary.org${href}`);
    } else if (href.startsWith(`//`)) {
      a.setAttribute(`href`, `https:${href}`);
    } else if (href.startsWith(`#`)) {
      a.removeAttribute(`href`);
    }
    if (a.hasAttribute(`href`)) {
      a.setAttribute(`target`, `_blank`);
      a.setAttribute(`rel`, `noreferrer`);
    }
  });
  return doc.body.innerHTML;
}

// A form-of definition is structurally short and ends with a link to the lemma.
// Find the first `<li>` whose text is short AND contains a /wiki/ link to a different
// word — that's the lemma we want to follow. This works regardless of language.
function findLemmaFromFirstDefinition(
  html: string,
  code: string,
  currentWord: string,
): string | null {
  const doc = new DOMParser().parseFromString(html, `text/html`);
  const prefix = `https://${code}.wiktionary.org/wiki/`;
  const items = Array.from(doc.querySelectorAll(`li`));
  for (const li of items) {
    if (li.closest(`.toc, .navbox, .mw-editsection`)) continue;
    const text = (li.textContent ?? ``).trim();
    if (text.length === 0 || text.length > FIRST_DEF_CHAR_LIMIT) continue;
    const anchors = Array.from(li.querySelectorAll(`a[href^="${prefix}"]`));
    for (const a of anchors) {
      const href = a.getAttribute(`href`) ?? ``;
      const m = new RegExp(`^${prefix.replace(/[.]/g, `\\.`)}([^#?]+)`).exec(href);
      if (!m) continue;
      const target = decodeURIComponent(m[1]).replace(/_/g, ` `);
      if (target.includes(`:`)) continue;
      if (target.toLowerCase() === currentWord.toLowerCase()) continue;
      return target;
    }
    return null; // first definition had no usable lemma link; not a form-of
  }
  return null;
}

export interface WiktionaryResult {
  word: string;
  html: string | null;
  url: string;
}

export function wiktionaryPageUrl(language: string, word: string): string | null {
  const code = wiktionaryCode(language);
  if (!code) return null;
  return `https://${code}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
}

export async function fetchWiktionaryEntry(
  language: string,
  word: string,
): Promise<WiktionaryResult | null> {
  const code = wiktionaryCode(language);
  if (!code) return null;

  let currentWord = word;
  let followed = 0;
  while (true) {
    const cached = await readCache(code, currentWord);
    let html: string | null;
    if (cached) {
      html = cached.html;
    } else {
      const raw = await fetchParseHtml(code, currentWord);
      html = raw ? stripChrome(raw, code) : null;
      await writeCache(code, currentWord, { html, fetchedAt: Date.now() });
    }

    if (html && followed < MAX_FOLLOW_DEPTH) {
      const lemma = findLemmaFromFirstDefinition(html, code, currentWord);
      if (lemma) {
        currentWord = lemma;
        followed++;
        continue;
      }
    }

    return {
      word: currentWord,
      html,
      url: `https://${code}.wiktionary.org/wiki/${encodeURIComponent(currentWord)}`,
    };
  }
}
