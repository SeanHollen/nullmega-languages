import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PronunciationPhrase } from "../../hooks/useGeneratePronunciation";
import type { PronunciationMode } from "../../pages/PronunciationPage";
import { PhraseCard } from "./PhraseCard";
import { Button } from "../Button";

interface Props {
  phrases: PronunciationPhrase[];
  audioUrls: string[];
  language: string;
  languageComplexity: number;
  title?: string;
  ratings: ("good" | "medium" | "bad" | null)[];
  practiceMode: PronunciationMode;
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
  practiceMode,
  onRate,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const allRated = ratings.every((r) => r !== null);
  const [showPhrasesByDefault, setShowPhrasesByDefault] = useState(true);
  const [showTranslationsByDefault, setShowTranslationsByDefault] = useState(true);

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
          {practiceMode === `mirror` ? t(`Listen first`) : t(`Read first`)}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            onClick={() => setShowPhrasesByDefault((p) => !p)}
            className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition"
          >
            {showPhrasesByDefault ? t(`Hide all phrases`) : t(`Show all phrases`)}
          </Button>
          <Button
            onClick={() => setShowTranslationsByDefault((p) => !p)}
            className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition"
          >
            {showTranslationsByDefault ? t(`Hide all translations`) : t(`Show all translations`)}
          </Button>
        </div>
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
          practiceMode={practiceMode}
          defaultTextRevealed={showPhrasesByDefault}
          defaultTranslationRevealed={showTranslationsByDefault}
          onRate={(r) => onRate(i, r)}
        />
      ))}

      <div className={`relative group ${!allRated ? `cursor-not-allowed` : ``}`}>
        <Button
          onClick={onSubmit}
          disabled={!allRated}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {t(`Submit`)}
        </Button>
        {!allRated && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {t(`Rate yourself on each phrase before submitting`)}
          </div>
        )}
      </div>
    </div>
  );
}
