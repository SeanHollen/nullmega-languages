import { useTranslation } from "react-i18next";
import type { WritingExercise } from "../../hooks/useGenerateWriting";
import type { WritingGrade } from "../../hooks/useGradeWriting";
import type { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";
import { ClickableText } from "../ClickableText";
import { ResultsScoreCard } from "../ResultsScoreCard";
import { Button } from "../Button";
import { TermList } from "../TermList";

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
  const { t } = useTranslation();
  const total = grades.reduce((sum, g) => sum + g.score, 0);
  const maxTotal = grades.length * 5;

  return (
    <div className="space-y-6">
      <ResultsScoreCard
        title={exercise.title}
        scoreText={`${total}/${maxTotal}`}
        ratingResult={ratingResult}
        language={language}
        ratingLabelSuffix={t(`writing`)}
      />

      {exercise.mode === `vocab-paragraph` ? (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Required words`)}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(exercise.requiredWords ?? []).map((w, i) => (
              <li key={i} className="text-gray-700">
                <span className="font-medium">{w.source}</span>
                <span className="text-gray-400">{` — ${w.translation}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Passage`)}</p>
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            <ClickableText source="writing" text={exercise.passage} language={language} />
          </p>
          {exercise.translation && (
            <div className="border-t border-green-100 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                {t(`English Translation`)}
              </p>
              <p className="text-gray-500 leading-relaxed italic text-sm whitespace-pre-wrap">
                {exercise.translation}
              </p>
            </div>
          )}
          {exercise.insight && (
            <div className="border-t border-green-100 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                {t(`Language Note`)}
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">{exercise.insight}</p>
            </div>
          )}
          <TermList
            title={t(`Vocabulary`)}
            items={exercise.difficultWords.map((w) => ({ left: w.source, right: w.translation }))}
          />
        </div>
      )}

      {exercise.mode === `dictogloss` || exercise.mode === `vocab-paragraph` ? (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <p className="font-medium text-gray-800">
              {exercise.mode === `vocab-paragraph` ? t(`Your paragraph`) : t(`Your summary`)}
            </p>
            {grades[0] && (
              <span className={`text-lg font-bold shrink-0 ${scoreColor(grades[0].score)}`}>
                {`${grades[0].score}/5`}
              </span>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              <ClickableText source="writing" text={answers[0] ?? ``} language={language} />
            </p>
          </div>
          {grades[0]?.notes && <p className="text-sm text-gray-500 italic">{grades[0].notes}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {exercise.questions.map((q, i) => {
            const grade = grades[i];
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium text-gray-800">
                    {`${i + 1}. `}
                    <ClickableText source="writing" text={q.question} language={language} />
                  </p>
                  {grade && (
                    <span className={`text-lg font-bold shrink-0 ${scoreColor(grade.score)}`}>
                      {`${grade.score}/5`}
                    </span>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-700">
                    <ClickableText source="writing" text={answers[i] ?? ``} language={language} />
                  </p>
                </div>
                {grade?.notes && <p className="text-sm text-gray-500 italic">{grade.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {assessmentId && <AssessmentFeedback assessmentId={assessmentId} />}

      {exercise.summary && (
        <p className="text-sm text-gray-500 leading-relaxed italic">
          <span className="text-xs text-gray-400 uppercase tracking-wide not-italic">
            {t(`Summary —`)}
            {` `}
          </span>
          {exercise.summary}
        </p>
      )}

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
