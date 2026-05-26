import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PronunciationPhrase } from "../../hooks/useGeneratePronunciation";
import { PhraseCard } from "./PhraseCard";

interface Props {
  phrases: PronunciationPhrase[];
  audioUrls: string[];
  language: string;
  languageComplexity: number;
  title?: string;
  ratings: ("good" | "medium" | "bad" | null)[];
  onRate: (index: number, rating: "good" | "medium" | "bad") => void;
  onSubmit: () => void;
}

export function PronunciationExerciseView({
  phrases,
  audioUrls,
  language,
  languageComplexity,
  title,
  ratings,
  onRate,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const allRated = ratings.every((r) => r !== null);
  const [showPhrasesByDefault, setShowPhrasesByDefault] = useState(true);
  const [showTranslationsByDefault, setShowTranslationsByDefault] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm px-6 py-4">
        {title && <h2 className="text-xl font-semibold text-gray-800 mb-1">{title}</h2>}
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {t(`{{language}} · Complexity {{complexity}}`, {
            language,
            complexity: languageComplexity,
          })}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {t(`Listen to each phrase, practise speaking it, then rate yourself.`)}
        </p>
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPhrasesByDefault}
            onChange={(e) => setShowPhrasesByDefault(e.target.checked)}
            className="accent-green-600 cursor-pointer"
          />
          <span className="text-sm text-gray-600">{t(`Show phrases by default`)}</span>
        </label>
        <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTranslationsByDefault}
            onChange={(e) => setShowTranslationsByDefault(e.target.checked)}
            className="accent-green-600 cursor-pointer"
          />
          <span className="text-sm text-gray-600">{t(`Show translations by default`)}</span>
        </label>
      </div>

      {phrases.map((p, i) => (
        <PhraseCard
          key={i}
          index={i}
          phrase={p.phrase}
          translation={p.translation}
          language={language}
          audioUrl={audioUrls[i]}
          rating={ratings[i]}
          defaultTextRevealed={showPhrasesByDefault}
          defaultTranslationRevealed={showTranslationsByDefault}
          onRate={(r) => onRate(i, r)}
        />
      ))}

      <div className={`relative group ${!allRated ? `cursor-not-allowed` : ``}`}>
        <button
          onClick={onSubmit}
          disabled={!allRated}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {t(`Submit`)}
        </button>
        {!allRated && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {t(`Rate yourself on each phrase before submitting`)}
          </div>
        )}
      </div>
    </div>
  );
}
