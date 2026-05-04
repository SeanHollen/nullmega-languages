import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { LoadingView } from "../components/reading/LoadingView";
import { PassageView } from "../components/reading/PassageView";
import { ResultsView } from "../components/reading/ResultsView";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { loadAbility, computeRating, RatingResult } from "../hooks/useAbility";
import { Exercise, Phase } from "../types";

export function ReadingPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(`French`);
  const [difficulty, setDifficulty] = useState(50);
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const { mutate, isPending, error } = useGenerateReading();

  useEffect(() => {
    setDifficulty(loadAbility(language) ?? 50);
  }, [language]);

  function handleGenerate() {
    mutate(
      { language, difficulty },
      {
        onSuccess: (data: Exercise) => {
          setExercise(data);
          setSelected(new Array(data.questions.length).fill(null));
          setPhase(`reading`);
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
      setRatingResult(computeRating(language, correct, exercise.questions.length, difficulty));
    } else {
      setRatingResult(null);
    }
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setSelected([]);
    setRatingResult(null);
    setDifficulty(loadAbility(language) ?? 50);
    setPhase(`setup`);
  }

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
          <h1 className="text-2xl font-bold text-gray-800">{`Reading Comprehension`}</h1>
        </div>

        {phase === `setup` && !isPending && (
          <SetupView
            language={language}
            difficulty={difficulty}
            rated={rated}
            savedRating={loadAbility(language)}
            error={error?.message ?? ``}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onRatedChange={setRated}
            onGenerate={handleGenerate}
          />
        )}

        {phase === `setup` && isPending && <LoadingView />}

        {phase === `reading` && exercise && (
          <PassageView
            exercise={exercise}
            language={language}
            difficulty={difficulty}
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
