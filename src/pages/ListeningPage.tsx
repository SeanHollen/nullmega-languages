import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { ListeningPassageView } from "../components/listening/ListeningPassageView";
import type { Translations } from "../components/reading/ResultsView";
import { ResultsView } from "../components/reading/ResultsView";
import { HistoryList } from "../components/HistoryList";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { translateBatch } from "../hooks/useTranslate";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import type { ExerciseAudio } from "../hooks/useTTS";
import { generateExerciseAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";
import type { Exercise } from "../types";

type Phase = "setup" | "listening" | "results";

export function ListeningPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [languageComplexity, setLanguageComplexity] = useState(
    () => loadAbility(language, `listening`) ?? DEFAULT_LANGUAGE_COMPLEXITY.listening,
  );
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [audio, setAudio] = useState<ExerciseAudio | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [audioError, setAudioError] = useState(``);
  const { mutate, error: genError } = useGenerateReading();
  const { beginLoading } = useLoading();

  function handleGenerate() {
    setAudioError(``);
    const done = beginLoading();
    mutate(
      { language, languageComplexity, mode: `listening` },
      {
        onSuccess: (data: Exercise) => {
          setExercise(data);
          setSelected(Array.from({ length: data.questions.length }, () => null));
          void (async () => {
            try {
              const exerciseAudio = await generateExerciseAudio(data);
              setAudio(exerciseAudio);
              setPhase(`listening`);
            } catch {
              setAudioError(`Failed to generate audio. Please try again.`);
            }
            done();
          })();
        },
        onError: () => done(),
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
    if (!exercise) return;
    const correct = selected.filter((s, i) => s === exercise.questions[i].correct).length;
    const total = exercise.questions.length;
    let rr: RatingResult | null = null;
    if (rated) {
      rr = computeRating(language, correct, total, languageComplexity, `listening`);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    const localId = saveAssessment({
      mode: `listening`,
      language,
      title: exercise.title,
      difficulty: languageComplexity,
      scoreEarned: correct,
      scoreMax: total,
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
    setAudio(null);
    setTranslations(null);
    setSelected([]);
    setRatingResult(null);
    setAssessmentId(null);
    setLanguageComplexity(
      loadAbility(language, `listening`) ?? DEFAULT_LANGUAGE_COMPLEXITY.listening,
    );
    setPhase(`setup`);
  }

  const error = genError?.message ?? audioError;

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
          <h1 className="text-2xl font-bold text-gray-800">{`Listening Comprehension`}</h1>
        </div>

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={languageComplexity}
              rated={rated}
              savedRating={loadAbility(language, `listening`)}
              error={error}
              generateLabel={`Generate Listening Exercise`}
              onLanguageComplexityChange={setLanguageComplexity}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`listening`} language={language} />
          </>
        )}

        {phase === `listening` && exercise && audio && (
          <ListeningPassageView
            exercise={exercise}
            language={language}
            languageComplexity={languageComplexity}
            audio={audio}
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
