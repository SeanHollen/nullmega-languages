import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { WritingPassageView } from "../components/writing/WritingPassageView";
import { WritingResultsView } from "../components/writing/WritingResultsView";
import { HistoryList, type ResumeState } from "../components/HistoryList";
import type { WritingBody } from "../utils/history";
import type { WritingExercise } from "../hooks/useGenerateWriting";
import { useGenerateWriting } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import { useGradeWriting } from "../hooks/useGradeWriting";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment, updateAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";

type Phase = "setup" | "writing" | "results";

export function WritingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `writing`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as WritingBody | undefined) : undefined;
  const savedRating = useLiveQuery(() => loadAbility(language, `writing`), [language]) ?? null;
  const [languageComplexity, setLanguageComplexity] = useState(
    () => resume?.record.difficulty ?? DEFAULT_LANGUAGE_COMPLEXITY.writing,
  );
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(() => (resumeBody ? `writing` : `setup`));
  const [exercise, setExercise] = useState<WritingExercise | null>(
    () => resumeBody?.exercise ?? null,
  );
  const [answers, setAnswers] = useState<string[]>(() => resumeBody?.answers ?? []);
  const [grades, setGrades] = useState<WritingGrade[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(() => resume?.record.id ?? null);
  const generateWriting = useGenerateWriting();
  const gradeWriting = useGradeWriting();
  const { beginLoading } = useLoading();
  const [activeResumeId, setActiveResumeId] = useState<string | null>(resume?.record.id ?? null);

  const incomingResumeId = resume?.record.id ?? null;
  if (incomingResumeId !== activeResumeId) {
    setActiveResumeId(incomingResumeId);
    if (resume && resumeBody) {
      setExercise(resumeBody.exercise);
      setAnswers(resumeBody.answers);
      setAssessmentId(resume.record.id);
      setPhase(`writing`);
      setLanguageComplexity(resume.record.difficulty);
      setGrades([]);
      setRatingResult(null);
    }
  }

  function handleGenerate() {
    const task = beginLoading(`Generating passage…`);
    generateWriting.mutate(
      { language, languageComplexity },
      {
        onSuccess: (data: WritingExercise) => {
          void (async () => {
            const initialAnswers = Array.from({ length: data.questions.length }, () => "");
            const id = await saveAssessment({
              mode: `writing`,
              language,
              title: data.title,
              difficulty: languageComplexity,
              scoreEarned: 0,
              scoreMax: data.questions.length * 5,
              ratingBefore: null,
              ratingAfter: null,
              completedAt: null,
              body: { exercise: data, answers: initialAnswers, grades: [] },
            });
            setAssessmentId(id);
            setExercise(data);
            setAnswers(initialAnswers);
            setPhase(`writing`);
          })();
        },
        onSettled: () => task.done(),
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
    if (!exercise || !assessmentId) return;
    const task = beginLoading(`Grading your answers…`);
    gradeWriting.mutate(
      { exercise, answers, language, languageComplexity },
      {
        onSettled: () => task.done(),
        onSuccess: (result) => {
          void (async () => {
            setGrades(result.grades);
            const totalScore = result.grades.reduce((sum, g) => sum + g.score, 0);
            const maxScore = result.grades.length * 5;
            let rr: RatingResult | null = null;
            if (rated) {
              rr = await computeRating(
                language,
                totalScore,
                maxScore,
                languageComplexity,
                `writing`,
              );
            }
            setRatingResult(rr);
            const completedAt = Date.now();
            await updateAssessment(assessmentId, {
              scoreEarned: totalScore,
              scoreMax: maxScore,
              ratingBefore: rr?.oldRating ?? null,
              ratingAfter: rr?.newRating ?? null,
              completedAt,
              body: { exercise, answers, grades: result.grades },
            });
            if (exercise.id) {
              uploadAssessment({
                id: exercise.id,
                userId: await getUserId(),
                scoreEarned: totalScore,
                scoreMax: maxScore,
                completedAt,
              });
            }
            setPhase(`results`);
          })();
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
    setLanguageComplexity(savedRating ?? DEFAULT_LANGUAGE_COMPLEXITY.writing);
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
              savedRating={savedRating}
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
