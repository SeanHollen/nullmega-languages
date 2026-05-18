import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { PassageView } from "../components/reading/PassageView";
import type { Translations } from "../components/reading/ResultsView";
import { ResultsView } from "../components/reading/ResultsView";
import { HistoryList, type ResumeState } from "../components/HistoryList";
import type { ReadingBody } from "../utils/history";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { translateBatch } from "../hooks/useTranslate";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment, updateAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";
import type { Exercise, Phase } from "../types";

export function ReadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `reading`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as ReadingBody | undefined) : undefined;
  const [languageComplexity, setLanguageComplexity] = useState(
    () => resume?.record.difficulty ?? loadAbility(language) ?? DEFAULT_LANGUAGE_COMPLEXITY.reading,
  );
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(() => (resumeBody ? `reading` : `setup`));
  const [exercise, setExercise] = useState<Exercise | null>(() => resumeBody?.exercise ?? null);
  const [selected, setSelected] = useState<(number | null)[]>(() => resumeBody?.selected ?? []);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(() => resume?.record.id ?? null);
  const [translations, setTranslations] = useState<Translations | null>(null);
  const { mutate, error } = useGenerateReading();
  const { beginLoading } = useLoading();
  const [activeResumeId, setActiveResumeId] = useState<string | null>(resume?.record.id ?? null);

  const incomingResumeId = resume?.record.id ?? null;
  if (incomingResumeId !== activeResumeId) {
    setActiveResumeId(incomingResumeId);
    if (resume && resumeBody) {
      setExercise(resumeBody.exercise);
      setSelected(resumeBody.selected);
      setAssessmentId(resume.record.id);
      setPhase(`reading`);
      setLanguageComplexity(resume.record.difficulty);
      setRatingResult(null);
      setTranslations(null);
    }
  }

  function handleGenerate() {
    const task = beginLoading(`Generating passage…`);
    mutate(
      { language, languageComplexity },
      {
        onSuccess: (data: Exercise) => {
          const initialSelected = Array.from(
            { length: data.questions.length },
            () => null as number | null,
          );
          const id = saveAssessment({
            mode: `reading`,
            language,
            title: data.title,
            difficulty: languageComplexity,
            scoreEarned: 0,
            scoreMax: data.questions.length,
            ratingBefore: null,
            ratingAfter: null,
            completedAt: null,
            body: { exercise: data, selected: initialSelected },
          });
          setAssessmentId(id);
          setExercise(data);
          setSelected(initialSelected);
          setPhase(`reading`);
        },
        onSettled: () => task.done(),
      },
    );
  }

  function handleSelect(qi: number, oi: number) {
    setSelected((prev) => {
      const next = [...prev];
      next[qi] = oi === -1 ? null : oi;
      return next;
    });
  }

  function handleSubmit() {
    if (!exercise || !assessmentId) return;
    const correct = selected.filter((s, i) => s === exercise.questions[i].correct).length;
    const total = exercise.questions.length;
    let rr: RatingResult | null = null;
    if (rated) {
      rr = computeRating(language, correct, total, languageComplexity);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    updateAssessment(assessmentId, {
      scoreEarned: correct,
      scoreMax: total,
      ratingBefore: rr?.oldRating ?? null,
      ratingAfter: rr?.newRating ?? null,
      completedAt,
      body: { exercise, selected },
    });
    if (exercise.id) {
      uploadAssessment({
        id: exercise.id,
        userId: getUserId(),
        scoreEarned: correct,
        scoreMax: total,
        completedAt,
      });
    }
    const allTexts = [
      ...exercise.questions.map((q) => q.question),
      ...exercise.questions.flatMap((q) => q.options),
    ];
    void (async () => {
      const results = await translateBatch(allTexts);
      const nq = exercise.questions.length;
      const questions = results.slice(0, nq);
      const options: string[][] = [];
      let cursor = nq;
      for (const q of exercise.questions) {
        options.push(results.slice(cursor, cursor + q.options.length));
        cursor += q.options.length;
      }
      setTranslations({ questions, options });
    })();
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setSelected([]);
    setRatingResult(null);
    setAssessmentId(null);
    setTranslations(null);
    setLanguageComplexity(loadAbility(language) ?? DEFAULT_LANGUAGE_COMPLEXITY.reading);
    setPhase(`setup`);
  }

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
          <h1 className="text-2xl font-bold text-gray-800">{`Reading Comprehension`}</h1>
        </div>

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={languageComplexity}
              rated={rated}
              savedRating={loadAbility(language)}
              error={error?.message ?? ``}
              generateLabel={`Generate Reading Exercise`}
              onLanguageComplexityChange={setLanguageComplexity}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`reading`} language={language} />
          </>
        )}

        {phase === `reading` && exercise && (
          <PassageView
            exercise={exercise}
            language={language}
            languageComplexity={languageComplexity}
            selected={selected}
            onSelect={handleSelect}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `results` && exercise && (
          <ResultsView
            exercise={exercise}
            language={language}
            selected={selected}
            ratingResult={ratingResult}
            assessmentId={assessmentId}
            translations={translations}
            onGoAgain={handleGoAgain}
            onHome={() => navigate(`/`)}
          />
        )}
      </div>
    </div>
  );
}
