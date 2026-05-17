import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { WritingPassageView } from "../components/writing/WritingPassageView";
import { WritingResultsView } from "../components/writing/WritingResultsView";
import { HistoryList } from "../components/HistoryList";
import type { WritingExercise } from "../hooks/useGenerateWriting";
import { useGenerateWriting } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import { useGradeWriting } from "../hooks/useGradeWriting";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";

type Phase = "setup" | "writing" | "results";

export function WritingPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [languageComplexity, setLanguageComplexity] = useState(
    () => loadAbility(language, `writing`) ?? DEFAULT_LANGUAGE_COMPLEXITY.writing,
  );
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<WritingExercise | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [grades, setGrades] = useState<WritingGrade[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const generateWriting = useGenerateWriting();
  const gradeWriting = useGradeWriting();
  const { beginLoading } = useLoading();

  function handleGenerate() {
    const done = beginLoading();
    generateWriting.mutate(
      { language, languageComplexity },
      {
        onSuccess: (data: WritingExercise) => {
          setExercise(data);
          setAnswers(Array.from({ length: data.questions.length }, () => ""));
          setPhase(`writing`);
        },
        onSettled: done,
      },
    );
  }

  function handleAnswerChange(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleAppendToAnswer(index: number, text: string) {
    setAnswers((prev) => {
      const next = [...prev];
      const existing = next[index] ?? ``;
      const sep = existing && !/\s$/.test(existing) ? ` ` : ``;
      next[index] = existing + sep + text;
      return next;
    });
  }

  function handleSubmit() {
    if (!exercise) return;
    const done = beginLoading();
    gradeWriting.mutate(
      { exercise, answers, language, languageComplexity },
      {
        onSettled: done,
        onSuccess: (result) => {
          setGrades(result.grades);
          const totalScore = result.grades.reduce((sum, g) => sum + g.score, 0);
          const maxScore = result.grades.length * 5;
          let rr: RatingResult | null = null;
          if (rated) {
            rr = computeRating(language, totalScore, maxScore, languageComplexity, `writing`);
          }
          setRatingResult(rr);
          const completedAt = Date.now();
          const localId = saveAssessment({
            mode: `writing`,
            language,
            title: exercise.title,
            difficulty: languageComplexity,
            scoreEarned: totalScore,
            scoreMax: maxScore,
            ratingBefore: rr?.oldRating ?? null,
            ratingAfter: rr?.newRating ?? null,
            completedAt,
          });
          const id = exercise.id ?? localId;
          setAssessmentId(id);
          if (exercise.id) {
            uploadAssessment({
              id: exercise.id,
              userId: getUserId(),
              scoreEarned: totalScore,
              scoreMax: maxScore,
              completedAt,
            });
          }
          setPhase(`results`);
        },
      },
    );
  }

  function handleGoAgain() {
    setExercise(null);
    setAnswers([]);
    setGrades([]);
    setRatingResult(null);
    setAssessmentId(null);
    setLanguageComplexity(loadAbility(language, `writing`) ?? DEFAULT_LANGUAGE_COMPLEXITY.writing);
    setPhase(`setup`);
  }

  const error = generateWriting.error?.message ?? gradeWriting.error?.message ?? ``;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Writing Practice`}</h1>
        </div>

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={languageComplexity}
              rated={rated}
              savedRating={loadAbility(language, `writing`)}
              error={error}
              generateLabel={`Generate Writing Exercise`}
              onLanguageComplexityChange={setLanguageComplexity}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`writing`} language={language} />
          </>
        )}

        {phase === `writing` && exercise && (
          <WritingPassageView
            exercise={exercise}
            language={language}
            languageComplexity={languageComplexity}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onAppendToAnswer={handleAppendToAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `results` && exercise && grades.length > 0 && (
          <WritingResultsView
            exercise={exercise}
            language={language}
            answers={answers}
            grades={grades}
            ratingResult={ratingResult}
            assessmentId={assessmentId}
            onGoAgain={handleGoAgain}
            onHome={() => navigate(`/`)}
          />
        )}
      </div>
    </div>
  );
}
