import type { RatingResult } from "../hooks/useAbility";

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

interface Props {
  title?: string | null;
  scoreText: string;
  // Optional small line under the score (e.g. "3 easy · 1 medium · 0 hard").
  subtext?: string | null;
  ratingResult: RatingResult | null;
  language: string;
  // Inserted between language and "rating" in the rating label. "" → "${language} rating:".
  // "writing" → "${language} writing rating:" (placement) and "${language} writing:" (normal).
  ratingLabelSuffix?: string;
}

export function ResultsScoreCard({
  title,
  scoreText,
  subtext,
  ratingResult,
  language,
  ratingLabelSuffix = ``,
}: Props) {
  const outcome = ratingResult ? OUTCOME_STYLE[ratingResult.outcome] : null;
  // Pre-extraction wording (preserved exactly):
  //   suffix=""           → placement "${lang} initial rating:" / normal "${lang} rating:"
  //   suffix="writing"    → placement "${lang} writing rating:"  / normal "${lang} writing:"
  //   suffix="pronunciation" → placement "${lang} pronunciation rating:" / normal "${lang} pronunciation:"
  const placementLabel = ratingLabelSuffix
    ? `${language} ${ratingLabelSuffix} rating:`
    : `${language} initial rating:`;
  const normalLabel = ratingLabelSuffix
    ? `${language} ${ratingLabelSuffix}:`
    : `${language} rating:`;

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-8 text-center ${outcome ? outcome.bg : `border-green-100`}`}
    >
      {title && <h2 className="text-lg font-semibold text-gray-700 mb-2">{title}</h2>}
      {outcome && (
        <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${outcome.color}`}>
          {outcome.label}
        </p>
      )}
      <p className="text-5xl font-bold text-gray-800 mb-3">{scoreText}</p>
      {subtext && <p className="text-xs text-gray-400 mb-3">{subtext}</p>}
      {ratingResult ? (
        ratingResult.isPlacement ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-gray-400">{placementLabel}</span>
            <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-gray-400">{normalLabel}</span>
            <span className="text-gray-600">{ratingResult.oldRating}</span>
            <span className="text-gray-300">{`→`}</span>
            <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
            <span className={ratingResult.change >= 0 ? `text-green-600` : `text-red-500`}>
              {ratingResult.change >= 0
                ? `(+${ratingResult.change.toFixed(1)})`
                : `(${ratingResult.change.toFixed(1)})`}
            </span>
          </div>
        )
      ) : (
        <p className="text-sm text-gray-400">{`Unrated exercise`}</p>
      )}
    </div>
  );
}
