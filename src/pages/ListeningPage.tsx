import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { LoadingView } from "../components/reading/LoadingView";
import { ListeningPassageView } from "../components/listening/ListeningPassageView";
import { ResultsView, Translations } from "../components/reading/ResultsView";
import { HistoryList } from "../components/HistoryList";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { translateBatch } from "../hooks/useTranslate";
import { loadAbility, computeRating, RatingResult } from "../hooks/useAbility";
import { generateExerciseAudio, ExerciseAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";
import { Exercise } from "../types";

type Phase = "setup" | "listening" | "results";

export function ListeningPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [difficulty, setDifficulty] = useState(() => loadAbility(language, `listening`) ?? 50);
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [audio, setAudio] = useState<ExerciseAudio | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(``);
  const { mutate, isPending, error: genError } = useGenerateReading();

  function handleGenerate() {
    setAudioError(``);
    mutate(
      { language, difficulty, mode: `listening` },
      {
        onSuccess: async (data: Exercise) => {
          setExercise(data);
          setSelected(Array.from({ length: data.questions.length }, () => null));
          setLoadingAudio(true);
          try {
            const exerciseAudio = await generateExerciseAudio(data);
            setAudio(exerciseAudio);
            setPhase(`listening`);
          } catch {
            setAudioError(`Failed to generate audio. Please try again.`);
          } finally {
            setLoadingAudio(false);
          }
        },
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
      rr = computeRating(language, correct, total, difficulty, `listening`);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    const localId = saveAssessment({
      mode: `listening`,
      language,
      title: exercise.title,
      difficulty,
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
    translateBatch(allTexts).then((results) => {
      const nq = exercise.questions.length;
      const questions = results.slice(0, nq);
      const options: string[][] = [];
      let cursor = nq;
      for (const q of exercise.questions) {
        options.push(results.slice(cursor, cursor + q.options.length));
        cursor += q.options.length;
      }
      setTranslations({ questions, options });
    });
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setAudio(null);
    setTranslations(null);
    setSelected([]);
    setRatingResult(null);
    setAssessmentId(null);
    setDifficulty(loadAbility(language, `listening`) ?? 50);
    setPhase(`setup`);
  }

  const isLoading = isPending || loadingAudio;
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

        {phase === `setup` && !isLoading && (
          <>
            <SetupView
              language={language}
              difficulty={difficulty}
              rated={rated}
              savedRating={loadAbility(language, `listening`)}
              error={error}
              generateLabel={`Generate Listening Exercise`}
              onDifficultyChange={setDifficulty}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`listening`} language={language} />
          </>
        )}

        {phase === `setup` && isPending && <LoadingView message={`Generating passage…`} />}

        {phase === `setup` && loadingAudio && (
          <LoadingView
            message={`Preparing audio…`}
            subMessage={`Synthesising speech for passage and questions`}
          />
        )}

        {phase === `listening` && exercise && audio && (
          <ListeningPassageView
            exercise={exercise}
            language={language}
            difficulty={difficulty}
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
