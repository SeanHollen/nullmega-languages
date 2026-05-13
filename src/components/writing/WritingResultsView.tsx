import { WritingExercise } from "../../hooks/useGenerateWriting";
import { WritingGrade } from "../../hooks/useGradeWriting";
import { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

function scoreColor(score: number): string {
  if (score >= 5) return `text-green-600`;
  if (score >= 4) return `text-green-500`;
  if (score >= 3) return `text-yellow-500`;
  if (score >= 2) return `text-orange-500`;
  return `text-red-500`;
}

interface Props {
  exercise: WritingExercise;
  language: string;
  answers: string[];
  grades: WritingGrade[];
  ratingResult: RatingResult | null;
  assessmentId: string | null;
  onGoAgain: () => void;
  onHome: () => void;
}

export function WritingResultsView({
  exercise,
  language,
  answers,
  grades,
  ratingResult,
  assessmentId,
  onGoAgain,
  onHome,
}: Props) {
  const total = grades.reduce((sum, g) => sum + g.score, 0);
  const maxTotal = grades.length * 5;
  const outcome = ratingResult ? OUTCOME_STYLE[ratingResult.outcome] : null;

  return (
    <div className="space-y-6">
      <div
        className={`bg-white rounded-2xl border shadow-sm p-8 text-center ${outcome ? outcome.bg : `border-green-100`}`}
      >
        {outcome && (
          <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${outcome.color}`}>
            {outcome.label}
          </p>
        )}
        <p className="text-5xl font-bold text-gray-800 mb-3">{`${total}/${maxTotal}`}</p>
        {ratingResult ? (
          ratingResult.isPlacement ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} writing rating:`}</span>
              <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} writing:`}</span>
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

      <div className="space-y-4">
        {exercise.questions.map((q, i) => {
          const grade = grades[i];
          return (
            <div
              key={i}
              className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-gray-800">{`${i + 1}. ${q.question}`}</p>
                {grade && (
                  <span className={`text-lg font-bold shrink-0 ${scoreColor(grade.score)}`}>
                    {`${grade.score}/5`}
                  </span>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{answers[i]}</p>
              </div>
              {grade?.notes && <p className="text-sm text-gray-500 italic">{grade.notes}</p>}
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
