import { useState } from "react";
import { FaTimes, FaExternalLinkAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import {
  fetchWiktionaryEntry,
  wiktionaryPageUrl,
  type WiktionaryResult,
} from "../../utils/wiktionary";
import { wiktionaryCode } from "../../data/wiktionaryCodes";
import { Button } from "../Button";

interface Props {
  word: string | null;
  language: string;
  onClose: () => void;
}

export function WordDefinitionPanel({ word, language, onClose }: Props) {
  const { t } = useTranslation();
  const [trackedWord, setTrackedWord] = useState<string | null>(null);
  const [viewingWord, setViewingWord] = useState<string | null>(null);
  const [requestedWord, setRequestedWord] = useState<string | null>(null);
  const [result, setResult] = useState<WiktionaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (word !== trackedWord) {
    setTrackedWord(word);
    setViewingWord(word);
    setRequestedWord(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }

  if (viewingWord === null) return null;

  const code = wiktionaryCode(language);
  const supported = code !== undefined;
  const showingFor = requestedWord === viewingWord ? result : null;
  const fallbackUrl = wiktionaryPageUrl(language, viewingWord);

  function lookup(target: string) {
    setViewingWord(target);
    setRequestedWord(target);
    setResult(null);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const r = await fetchWiktionaryEntry(language, target);
        setResult(r);
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
    })();
  }

  function handleEntryClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!code) return;
    const anchor = (e.target as HTMLElement).closest(`a[href]`) as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute(`href`) ?? ``;
    const prefix = `https://${code}.wiktionary.org/wiki/`;
    if (!href.startsWith(prefix)) return; // external link — let browser handle
    const m = new RegExp(`^${prefix.replace(/[.]/g, `\\.`)}([^#?]+)`).exec(href);
    if (!m) return;
    const target = decodeURIComponent(m[1]).replace(/_/g, ` `);
    if (target.includes(`:`)) return; // namespace links (Help:, Special:) — let browser handle
    e.preventDefault();
    lookup(target);
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-full sm:w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">{language}</p>
          <p className="text-xl font-semibold text-gray-800 break-words">{viewingWord}</p>
        </div>
        <Button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition cursor-pointer p-1"
          aria-label={t(`Close`)}
        >
          <FaTimes />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!supported && (
          <p className="text-sm text-gray-500">
            {t(`Dictionary lookup isn't supported for {{language}}.`, { language })}
          </p>
        )}

        {supported && !showingFor && !loading && (
          <Button
            onClick={() => lookup(viewingWord)}
            className="w-full bg-green-600 text-white py-2.5 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
          >
            {t(`View translation`)}
          </Button>
        )}

        {loading && <p className="text-sm text-gray-500">{t(`Looking up…`)}</p>}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {showingFor && showingFor.html && (
          <>
            {showingFor.word.toLowerCase() !== viewingWord.toLowerCase() && (
              <p className="text-xs text-gray-500">
                {`${t(`Showing entry for`)} `}
                <span className="font-medium text-gray-700">{showingFor.word}</span>
              </p>
            )}
            <div
              onClick={handleEntryClick}
              className="wiktionary-entry text-sm text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: showingFor.html }}
            />
            <a
              href={showingFor.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              {t(`Open on Wiktionary`)} <FaExternalLinkAlt className="text-[10px]" />
            </a>
          </>
        )}

        {showingFor && !showingFor.html && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t(`No entry found.`)}</p>
            {fallbackUrl && (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                {t(`Search on Wiktionary`)} <FaExternalLinkAlt className="text-[10px]" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
