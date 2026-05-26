import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaTimes, FaMinus } from "react-icons/fa";
import type { PronunciationPhrase } from "../../hooks/useGeneratePronunciation";
import type { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";
import { AudioPlayer } from "../listening/AudioPlayer";
import { ClickableText } from "../ClickableText";
import { ResultsScoreCard } from "../ResultsScoreCard";
import { Button } from "../Button";

type PhraseRating = "good" | "medium" | "bad" | null;

const BORDER_BY_RATING: Record<NonNullable<PhraseRating>, string> = {
  good: `border-green-200`,
  medium: `border-yellow-200`,
  bad: `border-red-200`,
};

const ICON_BY_RATING: Record<NonNullable<PhraseRating>, ReactElement> = {
  good: <FaCheck className="text-green-500 mt-0.5 shrink-0" />,
  medium: <FaMinus className="text-yellow-500 mt-0.5 shrink-0" />,
  bad: <FaTimes className="text-red-500 mt-0.5 shrink-0" />,
};

interface Props {
  phrases: PronunciationPhrase[];
  language: string;
  title?: string;
  ratings: ("good" | "medium" | "bad" | null)[];
  ratingResult: RatingResult | null;
  assessmentId: string | null;
  audioUrls?: (string | null)[];
  onGoAgain: () => void;
  onHome: () => void;
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ``);
}

export function PronunciationResultsView({
  phrases,
  language,
  title,
  ratings,
  ratingResult,
  assessmentId,
  audioUrls,
  onGoAgain,
  onHome,
}: Props) {
  const { t } = useTranslation();
  const goodCount = ratings.filter((r) => r === "good").length;
  const mediumCount = ratings.filter((r) => r === "medium").length;
  const badCount = ratings.filter((r) => r === "bad").length;
  const weighted = goodCount + 0.75 * mediumCount;
  const total = phrases.length;

  return (
    <div className="space-y-6">
      <ResultsScoreCard
        title={title}
        scoreText={`${formatScore(weighted)}/${total}`}
        subtext={t(`{{good}} easy · {{medium}} medium · {{bad}} hard`, {
          good: goodCount,
          medium: mediumCount,
          bad: badCount,
        })}
        ratingResult={ratingResult}
        language={language}
        ratingLabelSuffix={t(`pronunciation`)}
      />

      <div className="space-y-3">
        {phrases.map((p, i) => {
          const r = ratings[i] ?? `bad`;
          const border = BORDER_BY_RATING[r];
          const icon = ICON_BY_RATING[r];
          const audioUrl = audioUrls?.[i];
          return (
            <div key={i} className={`bg-white rounded-2xl border shadow-sm p-5 ${border}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-400 font-medium">
                  {t(`Phrase {{n}}`, { n: i + 1 })}
                </span>
                {audioUrl && <AudioPlayer src={audioUrl} small />}
                <span className="ml-auto">{icon}</span>
              </div>
              <p className="font-medium text-gray-800">
                <ClickableText text={p.phrase} language={language} />
              </p>
              <p className="text-sm text-gray-400 italic mt-0.5">{p.translation}</p>
            </div>
          );
        })}
      </div>

      {assessmentId && <AssessmentFeedback assessmentId={assessmentId} />}

      <div className="flex gap-3">
        <Button
          onClick={onGoAgain}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
        >
          {t(`Go Again`)}
        </Button>
        <Button
          onClick={onHome}
          className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
        >
          {t(`Home`)}
        </Button>
      </div>
    </div>
  );
}
