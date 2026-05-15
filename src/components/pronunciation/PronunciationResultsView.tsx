import { FaCheck, FaTimes, FaMinus } from "react-icons/fa";
import { PronunciationPhrase } from "../../hooks/useGeneratePronunciation";
import { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";
import { ClickableText } from "../ClickableText";

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

interface Props {
  phrases: PronunciationPhrase[];
  language: string;
  ratings: ("good" | "medium" | "bad" | null)[];
  ratingResult: RatingResult | null;
  assessmentId: string | null;
  onGoAgain: () => void;
  onHome: () => void;
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ``);
}

export function PronunciationResultsView({
  phrases,
  language,
  ratings,
  ratingResult,
  assessmentId,
  onGoAgain,
  onHome,
}: Props) {
  const goodCount = ratings.filter((r) => r === "good").length;
  const mediumCount = ratings.filter((r) => r === "medium").length;
  const badCount = ratings.filter((r) => r === "bad").length;
  const weighted = goodCount + 0.75 * mediumCount;
  const total = phrases.length;
  const outcome = ratingResult ? OUTCOME_STYLE[ratingResult.outcome] : null;

  return (
    <div className="space-y-6">
      <div
        className={`bg-white rounded-2xl border shadow-sm p-8 text-center ${outcome ? outcome.bg : `border-gray-100`}`}
      >
        {outcome && (
          <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${outcome.color}`}>
            {outcome.label}
          </p>
        )}
        <p className="text-5xl font-bold text-gray-800 mb-3">{`${formatScore(weighted)}/${total}`}</p>
        <p className="text-xs text-gray-400 mb-3">
          {`${goodCount} easy · ${mediumCount} medium · ${badCount} hard`}
        </p>
        {ratingResult ? (
          ratingResult.isPlacement ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} pronunciation rating:`}</span>
              <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} pronunciation:`}</span>
              <span className="text-gray-600">{ratingResult.oldRating}</span>
              <span className="text-gray-300">{`→`}</span>
              <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
              <span className={ratingResult.change >= 0 ? `text-green-600` : `text-red-500`}>
                {ratingResult.change >= 0
                  ? `(+${ratingResult.change})`
                  : `(${ratingResult.change})`}
              </span>
            </div>
          )
        ) : (
          <p className="text-sm text-gray-400">{`Unrated exercise`}</p>
        )}
      </div>

      <div className="space-y-3">
        {phrases.map((p, i) => {
          const r = ratings[i];
          const border =
            r === "good"
              ? `border-green-200`
              : r === "medium"
                ? `border-yellow-200`
                : `border-red-200`;
          const icon =
            r === "good" ? (
              <FaCheck className="text-green-500 mt-0.5 shrink-0" />
            ) : r === "medium" ? (
              <FaMinus className="text-yellow-500 mt-0.5 shrink-0" />
            ) : (
              <FaTimes className="text-red-500 mt-0.5 shrink-0" />
            );
          return (
            <div key={i} className={`bg-white rounded-2xl border shadow-sm p-5 ${border}`}>
              <div className="flex items-start gap-3">
                {icon}
                <div>
                  <p className="font-medium text-gray-800">
                    <ClickableText text={p.phrase} language={language} />
                  </p>
                  <p className="text-sm text-gray-400 italic mt-0.5">{p.translation}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {assessmentId && <AssessmentFeedback assessmentId={assessmentId} />}

      <div className="flex gap-3">
        <button
          onClick={onGoAgain}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
        >
          {`Go Again`}
        </button>
        <button
          onClick={onHome}
          className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
        >
          {`Home`}
        </button>
      </div>
    </div>
  );
}
