import { FaCheck, FaTimes } from "react-icons/fa";
import { PronunciationPhrase } from "../../hooks/useGeneratePronunciation";
import { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

interface Props {
  phrases: PronunciationPhrase[];
  language: string;
  ratings: ("good" | "bad" | null)[];
  ratingResult: RatingResult | null;
  assessmentId: string | null;
  onGoAgain: () => void;
  onHome: () => void;
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
  const good = ratings.filter((r) => r === "good").length;
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
        <p className="text-5xl font-bold text-gray-800 mb-3">{`${good}/${total}`}</p>
        <p className="text-xs text-gray-400 mb-3">{`phrases rated good`}</p>
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
          const good = ratings[i] === "good";
          return (
            <div
              key={i}
              className={`bg-white rounded-2xl border shadow-sm p-5 ${good ? `border-green-200` : `border-red-200`}`}
            >
              <div className="flex items-start gap-3">
                {good ? (
                  <FaCheck className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <FaTimes className="text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-gray-800">{p.phrase}</p>
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
          className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:border-gray-300 transition cursor-pointer"
        >
          {`Home`}
        </button>
      </div>
    </div>
  );
}
