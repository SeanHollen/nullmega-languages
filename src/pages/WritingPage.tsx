import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { LoadingView } from "../components/reading/LoadingView";
import { WritingPassageView } from "../components/writing/WritingPassageView";
import { WritingResultsView } from "../components/writing/WritingResultsView";
import { HistoryList } from "../components/HistoryList";
import type { WritingExercise } from "../hooks/useGenerateWriting";
import { useGenerateWriting } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import { useGradeWriting } from "../hooks/useGradeWriting";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";

type Phase = "setup" | "writing" | "results";

export function WritingPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [difficulty, setDifficulty] = useState(() => loadAbility(language, `writing`) ?? 50);
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<WritingExercise | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [grades, setGrades] = useState<WritingGrade[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const generateWriting = useGenerateWriting();
  const gradeWriting = useGradeWriting();

  function handleGenerate() {
    generateWriting.mutate(
      { language, difficulty },
      {
        onSuccess: (data: WritingExercise) => {
          setExercise(data);
          setAnswers(Array.from({ length: data.questions.length }, () => ""));
          setPhase(`writing`);
        },
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

  function handleSubmit() {
    if (!exercise) return;
    gradeWriting.mutate(
      { exercise, answers, language, difficulty },
      {
        onSuccess: (result) => {
          setGrades(result.grades);
          const totalScore = result.grades.reduce((sum, g) => sum + g.score, 0);
          const maxScore = result.grades.length * 5;
          let rr: RatingResult | null = null;
          if (rated) {
            rr = computeRating(language, totalScore, maxScore, difficulty, `writing`);
          }
          setRatingResult(rr);
          const completedAt = Date.now();
          const localId = saveAssessment({
            mode: `writing`,
            language,
            title: exercise.title,
            difficulty,
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
    setDifficulty(loadAbility(language, `writing`) ?? 50);
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

        {phase === `setup` && !generateWriting.isPending && (
          <>
            <SetupView
              language={language}
              difficulty={difficulty}
              rated={rated}
              savedRating={loadAbility(language, `writing`)}
              error={error}
              generateLabel={`Generate Writing Exercise`}
              onDifficultyChange={setDifficulty}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`writing`} language={language} />
          </>
        )}

        {phase === `setup` && generateWriting.isPending && (
          <LoadingView message={`Generating exercise…`} />
        )}

        {phase === `writing` && exercise && !gradeWriting.isPending && (
          <WritingPassageView
            exercise={exercise}
            language={language}
            difficulty={difficulty}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `writing` && gradeWriting.isPending && (
          <LoadingView
            message={`Grading your answers…`}
            subMessage={`Analysing grammar and vocabulary`}
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
