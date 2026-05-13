import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { LoadingView } from "../components/reading/LoadingView";
import { PronunciationExerciseView } from "../components/pronunciation/PronunciationExerciseView";
import { PronunciationResultsView } from "../components/pronunciation/PronunciationResultsView";
import { useGeneratePronunciation, PronunciationExercise } from "../hooks/useGeneratePronunciation";
import { loadAbility, computeRating, RatingResult } from "../hooks/useAbility";
import { generatePhrasesAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";

type Phase = "setup" | "exercise" | "results";

export function PronunciationPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [difficulty, setDifficulty] = useState(() => loadAbility(language, `pronunciation`) ?? 50);
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<PronunciationExercise | null>(null);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [ratings, setRatings] = useState<("good" | "bad" | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(``);
  const { mutate, isPending, error: genError } = useGeneratePronunciation();

  function handleGenerate() {
    setAudioError(``);
    mutate(
      { language, difficulty },
      {
        onSuccess: async (data: PronunciationExercise) => {
          setExercise(data);
          setRatings(Array.from({ length: data.phrases.length }, () => null));
          setLoadingAudio(true);
          try {
            const urls = await generatePhrasesAudio(data.phrases.map((p) => p.phrase));
            setAudioUrls(urls);
            setPhase(`exercise`);
          } catch {
            setAudioError(`Failed to generate audio. Please try again.`);
          } finally {
            setLoadingAudio(false);
          }
        },
      },
    );
  }

  function handleRate(index: number, rating: "good" | "bad") {
    setRatings((prev) => {
      const next = [...prev];
      next[index] = rating;
      return next;
    });
  }

  function handleSubmit() {
    if (!exercise) return;
    const goodCount = ratings.filter((r) => r === "good").length;
    const total = exercise.phrases.length;
    if (rated) {
      setRatingResult(computeRating(language, goodCount, total, difficulty, `pronunciation`));
    } else {
      setRatingResult(null);
    }
    const id = saveAssessment({
      mode: `pronunciation`,
      language,
      difficulty,
      scoreEarned: goodCount,
      scoreMax: total,
      completedAt: Date.now(),
    });
    setAssessmentId(id);
    uploadAssessment({
      id,
      mode: `pronunciation`,
      language,
      difficulty,
      scoreEarned: goodCount,
      scoreMax: total,
      exercise,
      ratings,
    });
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setAudioUrls([]);
    setRatings([]);
    setRatingResult(null);
    setAssessmentId(null);
    setDifficulty(loadAbility(language, `pronunciation`) ?? 50);
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
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Pronunciation Practice`}</h1>
        </div>

        {phase === `setup` && !isLoading && (
          <SetupView
            language={language}
            difficulty={difficulty}
            rated={rated}
            savedRating={loadAbility(language, `pronunciation`)}
            error={error}
            generateLabel={`Generate Phrases`}
            onDifficultyChange={setDifficulty}
            onRatedChange={setRated}
            onGenerate={handleGenerate}
          />
        )}

        {phase === `setup` && isPending && <LoadingView message={`Generating phrases…`} />}

        {phase === `setup` && loadingAudio && (
          <LoadingView
            message={`Preparing audio…`}
            subMessage={`Synthesising speech for each phrase`}
          />
        )}

        {phase === `exercise` && exercise && (
          <PronunciationExerciseView
            phrases={exercise.phrases}
            audioUrls={audioUrls}
            language={language}
            difficulty={difficulty}
            ratings={ratings}
            onRate={handleRate}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `results` && exercise && (
          <PronunciationResultsView
            phrases={exercise.phrases}
            language={language}
            ratings={ratings}
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
