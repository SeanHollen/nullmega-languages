import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { LoadingView } from "../components/reading/LoadingView";
import { ListeningPassageView } from "../components/listening/ListeningPassageView";
import { ResultsView } from "../components/reading/ResultsView";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { loadAbility, computeRating, RatingResult } from "../hooks/useAbility";
import { generateExerciseAudio, ExerciseAudio } from "../hooks/useTTS";
import { Exercise } from "../types";

type Phase = "setup" | "listening" | "results";

export function ListeningPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(`French`);
  const [difficulty, setDifficulty] = useState(50);
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [audio, setAudio] = useState<ExerciseAudio | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(``);
  const { mutate, isPending, error: genError } = useGenerateReading();

  useEffect(() => {
    setDifficulty(loadAbility(language, `listening`) ?? 50);
  }, [language]);

  function handleGenerate() {
    setAudioError(``);
    mutate(
      { language, difficulty },
      {
        onSuccess: async (data: Exercise) => {
          setExercise(data);
          setSelected(new Array(data.questions.length).fill(null));
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
      }
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
    const correct = selected.filter(
      (s, i) => s === exercise.questions[i].correct
    ).length;
    if (rated) {
      setRatingResult(
        computeRating(language, correct, exercise.questions.length, difficulty, `listening`)
      );
    } else {
      setRatingResult(null);
    }
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setAudio(null);
    setSelected([]);
    setRatingResult(null);
    setDifficulty(loadAbility(language, `listening`) ?? 50);
    setPhase(`setup`);
  }

  const isLoading = isPending || loadingAudio;
  const error = genError?.message ?? audioError;

  return (
    <div className="min-h-screen bg-green-50 py-10 px-4">
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
          <SetupView
            language={language}
            difficulty={difficulty}
            rated={rated}
            savedRating={loadAbility(language, `listening`)}
            error={error}
            generateLabel={`Generate Listening Exercise`}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onRatedChange={setRated}
            onGenerate={handleGenerate}
          />
        )}

        {phase === `setup` && isPending && (
          <LoadingView message={`Generating passage…`} />
        )}

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
            onGoAgain={handleGoAgain}
            onHome={() => navigate(`/`)}
          />
        )}
      </div>
    </div>
  );
}
