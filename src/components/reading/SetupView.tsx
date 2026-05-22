import { FaExclamationTriangle } from "react-icons/fa";
import type { ReadingLength } from "../../utils/prompts";
import type { WritingMode } from "../../hooks/useGenerateWriting";

interface Props {
  language: string;
  languageComplexity: number;
  rated: boolean;
  savedRating: number | null;
  error: string;
  generateLabel?: string;
  length?: ReadingLength;
  onLengthChange?: (l: ReadingLength) => void;
  writingMode?: WritingMode | null;
  onWritingModeChange?: (m: WritingMode) => void;
  writingModeBlockedReason?: string | null;
  onLanguageComplexityChange: (d: number) => void;
  onRatedChange: (r: boolean) => void;
  onGenerate: () => void;
}

const LENGTH_OPTIONS: ReadingLength[] = [`short`, `medium`, `long`];
const WRITING_MODE_OPTIONS: { mode: WritingMode; label: string; description: string }[] = [
  {
    mode: `short-answer`,
    label: `Short answer`,
    description: `Read a passage, then answer 2 short comprehension questions plus 1 short essay.`,
  },
  {
    mode: `dictogloss`,
    label: `Dictogloss`,
    description: `Listen to a passage, then summarize it from memory in your own words. Combines retrieval practice with noticing-the-gap — strong for grammatical accuracy.`,
  },
  {
    mode: `vocab-paragraph`,
    label: `Vocab paragraph`,
    description: `Write a paragraph that uses the 5–8 vocab cards from your deck that are about to become due. Reinforces words you're about to forget in productive context.`,
  },
];

export function SetupView({
  language,
  languageComplexity,
  rated,
  savedRating,
  error,
  generateLabel = `Generate Passage`,
  length,
  onLengthChange,
  writingMode,
  onWritingModeChange,
  writingModeBlockedReason,
  onLanguageComplexityChange,
  onRatedChange,
  onGenerate,
}: Props) {
  const isUnratedLanguage = savedRating === null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {`Language complexity: `}
          <span className="text-green-600 font-bold">{languageComplexity}</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={languageComplexity}
          onChange={(e) => onLanguageComplexityChange(Number(e.target.value))}
          className="w-full accent-green-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{`1 — Beginner`}</span>
          <span>{`100 — Advanced`}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {`Your ${language} rating: `}
          {isUnratedLanguage ? (
            <span className="font-medium text-gray-400">{`Unrated`}</span>
          ) : (
            <span className="font-semibold text-gray-600">{savedRating}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!rated}
            onChange={(e) => onRatedChange(!e.target.checked)}
            className="w-4 h-4 accent-green-600 cursor-pointer"
          />
          <span className="text-sm text-gray-600">{`Unrated exercise`}</span>
        </label>
        {length !== undefined && onLengthChange && (
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => onLengthChange(opt)}
                className={`px-3 py-1 text-sm capitalize transition cursor-pointer ${
                  length === opt
                    ? `bg-green-600 text-white`
                    : `bg-white text-gray-600 hover:bg-gray-50`
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {onWritingModeChange && (
        <div>
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
            {WRITING_MODE_OPTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => onWritingModeChange(mode)}
                className={`px-3 py-1 text-sm transition cursor-pointer ${
                  writingMode === mode
                    ? `bg-green-600 text-white`
                    : `bg-white text-gray-600 hover:bg-gray-50`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {writingMode && (
            <p className="text-xs text-gray-500 mt-2">
              {WRITING_MODE_OPTIONS.find((o) => o.mode === writingMode)?.description}
            </p>
          )}
          {writingMode && writingModeBlockedReason && (
            <p className="text-xs text-amber-600 mt-2">{writingModeBlockedReason}</p>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <FaExclamationTriangle className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{`Something went wrong`}</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={
          (onWritingModeChange !== undefined && !writingMode) || Boolean(writingModeBlockedReason)
        }
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
      >
        {rated ? generateLabel : `${generateLabel} (Unrated)`}
      </button>
    </div>
  );
}
