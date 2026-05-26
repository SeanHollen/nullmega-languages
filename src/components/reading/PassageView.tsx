import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import type { Exercise } from "../../types";
import { QuestionCard } from "./QuestionCard";
import { WordDefinitionPanel } from "./WordDefinitionPanel";
import { loadDictionaryEnabled, saveDictionaryEnabled } from "../../utils/dictionarySettings";

interface Props {
  exercise: Exercise;
  language: string;
  languageComplexity: number;
  selected: (number | null)[];
  onSelect: (questionIndex: number, optionIndex: number) => void;
  onSubmit: () => void;
}

const WORD_RE = /\p{L}+(?:[’'-]\p{L}+)*/gu;

interface Token {
  text: string;
  isWord: boolean;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), isWord: false });
    }
    tokens.push({ text: match[0], isWord: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), isWord: false });
  }
  return tokens;
}

export function PassageView({
  exercise,
  language,
  languageComplexity,
  selected,
  onSelect,
  onSubmit,
}: Props) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const dictionaryEnabled = useLiveQuery(() => loadDictionaryEnabled(), []) ?? true;
  const allAnswered = selected.every((s) => s !== null);
  const tokens = tokenize(exercise.passage);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {exercise.title && (
              <h2 className="text-xl font-semibold text-gray-800 mb-1">{exercise.title}</h2>
            )}
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {t(`{{language}} · Complexity {{complexity}}`, {
                language,
                complexity: languageComplexity,
              })}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={dictionaryEnabled}
              onChange={(e) => void saveDictionaryEnabled(e.target.checked)}
              className="w-4 h-4 accent-green-600 cursor-pointer"
            />
            <span className="text-xs text-gray-500">{t(`Dictionary`)}</span>
          </label>
        </div>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {dictionaryEnabled
            ? tokens.map((token, i) =>
                token.isWord ? (
                  <span
                    key={i}
                    onClick={() => setSelectedWord(token.text)}
                    className={`cursor-pointer rounded ${
                      selectedWord && selectedWord.toLowerCase() === token.text.toLowerCase()
                        ? `bg-green-200 text-green-900`
                        : `hover:bg-yellow-100`
                    }`}
                  >
                    {token.text}
                  </span>
                ) : (
                  <span key={i}>{token.text}</span>
                ),
              )
            : exercise.passage}
        </p>
      </div>

      {exercise.questions.map((q, qi) => (
        <QuestionCard
          key={qi}
          question={q}
          index={qi}
          selected={selected[qi]}
          onSelect={(oi) => onSelect(qi, oi)}
        />
      ))}

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        title={!allAnswered ? t(`Not all questions answered`) : undefined}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
      >
        {t(`Submit Answers`)}
      </button>

      {dictionaryEnabled && (
        <WordDefinitionPanel
          word={selectedWord}
          language={language}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
