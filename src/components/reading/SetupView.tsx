import { FaExclamationTriangle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { ReadingLength } from "../../utils/prompts";
import type { WritingMode } from "../../hooks/useGenerateWriting";
import type { PronunciationMode } from "../../pages/PronunciationPage";
import { Button } from "../Button";

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
  pronunciationMode?: PronunciationMode;
  onPronunciationModeChange?: (m: PronunciationMode) => void;
  disabledReason?: string | null;
  onLanguageComplexityChange: (d: number) => void;
  onRatedChange: (r: boolean) => void;
  onGenerate: () => void;
}

const LENGTH_OPTIONS: ReadingLength[] = [`short`, `medium`, `long`];
const LENGTH_LABELS: Record<ReadingLength, string> = {
  short: `Short`,
  medium: `Medium`,
  long: `Long`,
};

const WRITING_MODES: WritingMode[] = [`short-answer`, `dictogloss`, `vocab-paragraph`];
const WRITING_MODE_LABELS: Record<WritingMode, string> = {
  "short-answer": `Short answer`,
  dictogloss: `Dictogloss`,
  "vocab-paragraph": `Vocab paragraph`,
};
const WRITING_MODE_DESCRIPTIONS: Record<WritingMode, string> = {
  "short-answer": `Read a passage, then answer 2 short comprehension questions plus 1 short essay.`,
  dictogloss: `Listen to a passage, then summarize it from memory in your own words. Combines retrieval practice with noticing-the-gap — strong for grammatical accuracy.`,
  "vocab-paragraph": `Write a paragraph that uses the 5–8 vocab cards from your deck that are about to become due. Reinforces words you're about to forget in productive context.`,
};

const PRONUNCIATION_MODES: PronunciationMode[] = [`mirror`, `test`];
const PRONUNCIATION_MODE_LABELS: Record<PronunciationMode, string> = {
  mirror: `Mirror`,
  test: `Test`,
};
const PRONUNCIATION_MODE_DESCRIPTIONS: Record<PronunciationMode, string> = {
  mirror: `Listen first`,
  test: `Read first`,
};

export function SetupView({
  language,
  languageComplexity,
  rated,
  savedRating,
  error,
  generateLabel,
  length,
  onLengthChange,
  writingMode,
  onWritingModeChange,
  pronunciationMode,
  onPronunciationModeChange,
  disabledReason,
  onLanguageComplexityChange,
  onRatedChange,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  const isUnratedLanguage = savedRating === null;
  const resolvedGenerateLabel = generateLabel ?? t(`Generate Passage`);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {`${t(`Language complexity`)}: `}
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
          <span>{t(`1 — Beginner`)}</span>
          <span>{t(`100 — Advanced`)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {`${t(`Your {{language}} rating`, { language })}: `}
          {isUnratedLanguage ? (
            <span className="font-medium text-gray-400">{t(`Unrated`)}</span>
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
          <span className="text-sm text-gray-600">{t(`Unrated exercise`)}</span>
        </label>
        {length !== undefined && onLengthChange && (
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
            {LENGTH_OPTIONS.map((opt) => (
              <Button
                key={opt}
                onClick={() => onLengthChange(opt)}
                className={`px-3 py-1 text-sm transition cursor-pointer ${
                  length === opt
                    ? `bg-green-600 text-white`
                    : `bg-white text-gray-600 hover:bg-gray-50`
                }`}
              >
                {t(LENGTH_LABELS[opt])}
              </Button>
            ))}
          </div>
        )}
      </div>

      {onPronunciationModeChange && pronunciationMode && (
        <div>
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
            {PRONUNCIATION_MODES.map((mode) => (
              <Button
                key={mode}
                onClick={() => onPronunciationModeChange(mode)}
                className={`px-3 py-1 text-sm transition cursor-pointer ${
                  pronunciationMode === mode
                    ? `bg-green-600 text-white`
                    : `bg-white text-gray-600 hover:bg-gray-50`
                }`}
              >
                {t(PRONUNCIATION_MODE_LABELS[mode])}
              </Button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t(PRONUNCIATION_MODE_DESCRIPTIONS[pronunciationMode])}
          </p>
        </div>
      )}

      {onWritingModeChange && (
        <div>
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
            {WRITING_MODES.map((mode) => (
              <Button
                key={mode}
                onClick={() => onWritingModeChange(mode)}
                className={`px-3 py-1 text-sm transition cursor-pointer ${
                  writingMode === mode
                    ? `bg-green-600 text-white`
                    : `bg-white text-gray-600 hover:bg-gray-50`
                }`}
              >
                {t(WRITING_MODE_LABELS[mode])}
              </Button>
            ))}
          </div>
          {writingMode && (
            <p className="text-xs text-gray-500 mt-2">
              {t(WRITING_MODE_DESCRIPTIONS[writingMode])}
            </p>
          )}
          {writingMode && disabledReason && (
            <p className="text-xs text-amber-600 mt-2">{disabledReason}</p>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <FaExclamationTriangle className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{t(`Something went wrong`)}</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className={`relative group ${disabledReason ? `cursor-not-allowed` : ``}`}>
        <Button
          onClick={onGenerate}
          disabled={!!disabledReason}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {rated
            ? resolvedGenerateLabel
            : t(`{{label}} (Unrated)`, { label: resolvedGenerateLabel })}
        </Button>
        {disabledReason && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {disabledReason}
          </div>
        )}
      </div>
    </div>
  );
}
