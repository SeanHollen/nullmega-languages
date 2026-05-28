import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { translateOne } from "../hooks/useTranslate";
import { loadFlashcards, addFlashcard, removeFlashcard } from "../utils/flashcards";
import type { Mode } from "../hooks/useAbility";
import { Button } from "./Button";

interface Props {
  text: string;
  language?: string;
  source?: Mode;
}

interface Popup {
  text: string;
  translation: string | null;
  x: number;
  y: number;
}

const cache = new Map<string, string>();
// Words = letter runs joined by ' or - (e.g. "L'apiculteur", "well-known", "don't")
const WORD_RE = /\p{L}+(?:[’'-]\p{L}+)*/gu;

interface Token {
  text: string;
  isWord: boolean;
  start: number;
  end: number;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        isWord: false,
        start: lastIndex,
        end: match.index,
      });
    }
    tokens.push({
      text: match[0],
      isWord: true,
      start: match.index,
      end: match.index + match[0].length,
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), isWord: false, start: lastIndex, end: text.length });
  }
  return tokens;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}

function buildFlashcardMask(text: string, sources: string[]): boolean[] {
  const mask: boolean[] = Array.from({ length: text.length }, () => false);
  for (const src of sources) {
    if (!src) continue;
    const re = new RegExp(`(?<=^|\\P{L})${escapeRegex(src)}(?=$|\\P{L})`, `giu`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = true;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return mask;
}

export function ClickableText({ text, language, source }: Props) {
  const { t } = useTranslation();
  const [popup, setPopup] = useState<Popup | null>(null);
  const savedSources =
    useLiveQuery(
      async () => (language ? (await loadFlashcards(language)).map((f) => f.source) : []),
      [language],
    ) ?? [];
  const containerRef = useRef<HTMLSpanElement>(null);
  const tokens = tokenize(text);
  const flashcardMask = buildFlashcardMask(text, savedSources);

  useEffect(() => {
    if (!popup) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (containerRef.current?.contains(target)) return;
      if (target.closest(`[data-popup]`)) return;
      setPopup(null);
    }
    document.addEventListener(`mousedown`, handle);
    return () => document.removeEventListener(`mousedown`, handle);
  }, [popup]);

  function showPopupAt(rawText: string, rect: DOMRect) {
    const key = rawText.toLowerCase();
    const cached = cache.get(key);
    const x = rect.left + rect.width / 2;
    setPopup({ text: rawText, translation: cached ?? null, x, y: rect.bottom + 4 });
    if (cached) return;
    void (async () => {
      const translated = await translateOne(rawText);
      cache.set(key, translated);
      setPopup((prev) => (prev?.text === rawText ? { ...prev, translation: translated } : prev));
    })();
  }

  function handleMouseUp(e: React.MouseEvent) {
    const sel = window.getSelection();
    const selText = sel && !sel.isCollapsed ? sel.toString().trim() : ``;
    if (selText) {
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showPopupAt(selText, rect);
      return;
    }
    const target = (e.target as HTMLElement).closest(`[data-word]`) as HTMLElement | null;
    if (target) {
      const word = target.textContent ?? ``;
      const rect = target.getBoundingClientRect();
      showPopupAt(word, rect);
    }
  }

  const alreadySaved =
    popup && language
      ? savedSources.some((s) => s.toLowerCase() === popup.text.toLowerCase())
      : false;

  function handleAddFlashcard() {
    if (!language || !popup || !popup.translation) return;
    void addFlashcard(language, popup.text, popup.translation, source ? [source] : []);
    setPopup(null);
  }

  function handleRemoveFlashcard() {
    if (!language || !popup) return;
    void removeFlashcard(language, popup.text);
    setPopup(null);
  }

  return (
    <span ref={containerRef} onMouseUp={handleMouseUp}>
      {tokens.map((token, i) => {
        if (!token.isWord) {
          const isFlashcarded = flashcardMask.slice(token.start, token.end).some(Boolean);
          return (
            <span key={i} className={isFlashcarded ? `bg-blue-100 text-blue-900` : ``}>
              {token.text}
            </span>
          );
        }
        const isFlashcarded = flashcardMask.slice(token.start, token.end).some(Boolean);
        return (
          <span
            key={i}
            data-word="true"
            className={`cursor-pointer rounded ${isFlashcarded ? `bg-blue-100 text-blue-900` : `hover:bg-yellow-100`}`}
          >
            {token.text}
          </span>
        );
      })}
      {popup && (
        <span
          data-popup="true"
          style={{
            position: `fixed`,
            top: popup.y,
            left: popup.x,
            transform: `translateX(-50%)`,
          }}
          className="z-50 inline-flex flex-col items-center gap-1.5 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-700 max-w-xs"
        >
          <span className="text-center">{popup.translation ?? t(`Translating…`)}</span>
          {language && popup.translation && (
            <Button
              onClick={alreadySaved ? handleRemoveFlashcard : handleAddFlashcard}
              className={
                alreadySaved
                  ? `group text-xs font-medium px-2 py-0.5 rounded-md border border-blue-200 text-blue-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition cursor-pointer whitespace-nowrap`
                  : `text-xs font-medium px-2 py-0.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition cursor-pointer whitespace-nowrap`
              }
            >
              {alreadySaved ? (
                <>
                  <span className="group-hover:hidden">{t(`✓ saved`)}</span>
                  <span className="hidden group-hover:inline">{t(`× remove`)}</span>
                </>
              ) : (
                t(`+ flashcard`)
              )}
            </Button>
          )}
        </span>
      )}
    </span>
  );
}
