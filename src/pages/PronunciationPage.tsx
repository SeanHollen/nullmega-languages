import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { PronunciationExerciseView } from "../components/pronunciation/PronunciationExerciseView";
import { PronunciationResultsView } from "../components/pronunciation/PronunciationResultsView";
import { HistoryList } from "../components/HistoryList";
import type { PronunciationExercise } from "../hooks/useGeneratePronunciation";
import { useGeneratePronunciation } from "../hooks/useGeneratePronunciation";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { generatePhrasesAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";

type Phase = "setup" | "exercise" | "results";

export function PronunciationPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [languageComplexity, setLanguageComplexity] = useState(
    () => loadAbility(language, `pronunciation`) ?? DEFAULT_LANGUAGE_COMPLEXITY.pronunciation,
  );
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(`setup`);
  const [exercise, setExercise] = useState<PronunciationExercise | null>(null);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [ratings, setRatings] = useState<("good" | "medium" | "bad" | null)[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(``);
  const { mutate, error: genError } = useGeneratePronunciation();
  const { beginLoading } = useLoading();

  function handleGenerate() {
    setAudioError(``);
    const done = beginLoading();
    mutate(
      { language, languageComplexity },
      {
        onSuccess: (data: PronunciationExercise) => {
          setExercise(data);
          setRatings(Array.from({ length: data.phrases.length }, () => null));
          void generatePhrasesAudio(data.phrases.map((p) => p.phrase)).then(
            (urls) => {
              setAudioUrls(urls);
              setPhase(`exercise`);
              done();
            },
            () => {
              setAudioError(`Failed to generate audio. Please try again.`);
              done();
            },
          );
        },
        onError: () => done(),
      },
    );
  }

  function handleRate(index: number, rating: "good" | "medium" | "bad") {
    setRatings((prev) => {
      const next = [...prev];
      next[index] = rating;
      return next;
    });
  }

  function handleSubmit() {
    if (!exercise) return;
    const goodCount = ratings.filter((r) => r === "good").length;
    const mediumCount = ratings.filter((r) => r === "medium").length;
    const weighted = goodCount + 0.75 * mediumCount;
    const total = exercise.phrases.length;
    let rr: RatingResult | null = null;
    if (rated) {
      rr = computeRating(language, weighted, total, languageComplexity, `pronunciation`);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    const localId = saveAssessment({
      mode: `pronunciation`,
      language,
      title: exercise.title,
      difficulty: languageComplexity,
      scoreEarned: weighted,
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
        scoreEarned: weighted,
        scoreMax: total,
        completedAt,
      });
    }
    setPhase(`results`);
  }

  function handleGoAgain() {
    setExercise(null);
    setAudioUrls([]);
    setRatings([]);
    setRatingResult(null);
    setAssessmentId(null);
    setLanguageComplexity(
      loadAbility(language, `pronunciation`) ?? DEFAULT_LANGUAGE_COMPLEXITY.pronunciation,
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
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Pronunciation Practice`}</h1>
        </div>

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={languageComplexity}
              rated={rated}
              savedRating={loadAbility(language, `pronunciation`)}
              error={error}
              generateLabel={`Generate Pronunciation Exercise`}
              onLanguageComplexityChange={setLanguageComplexity}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`pronunciation`} language={language} />
          </>
        )}

        {phase === `exercise` && exercise && (
          <PronunciationExerciseView
            phrases={exercise.phrases}
            audioUrls={audioUrls}
            language={language}
            languageComplexity={languageComplexity}
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
