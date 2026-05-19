import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { PronunciationExerciseView } from "../components/pronunciation/PronunciationExerciseView";
import { PronunciationResultsView } from "../components/pronunciation/PronunciationResultsView";
import { HistoryList, type ResumeState } from "../components/HistoryList";
import type { PronunciationBody } from "../utils/history";
import type { PronunciationExercise } from "../hooks/useGeneratePronunciation";
import { useGeneratePronunciation } from "../hooks/useGeneratePronunciation";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { generatePhrasesAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment, updateAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";
import { resolveSliderComplexity } from "../utils/sliderComplexity";

type Phase = "setup" | "exercise" | "results";

export function PronunciationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `pronunciation`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as PronunciationBody | undefined) : undefined;
  const resumeExercise: PronunciationExercise | null =
    resumeBody && resume
      ? {
          title: resumeBody.title,
          phrases: resumeBody.phrases,
          languageComplexity: resume.record.difficulty,
        }
      : null;
  const savedRating =
    useLiveQuery(() => loadAbility(language, `pronunciation`), [language]) ?? null;
  const [complexityOverride, setComplexityOverride] = useState<number | null>(null);
  const sliderComplexity = resolveSliderComplexity({
    override: complexityOverride,
    savedRating,
    defaultComplexity: DEFAULT_LANGUAGE_COMPLEXITY.pronunciation,
  });
  const [rated, setRated] = useState(true);
  const [phase, setPhase] = useState<Phase>(() => (resumeBody ? `exercise` : `setup`));
  const [exercise, setExercise] = useState<PronunciationExercise | null>(() => resumeExercise);
  const [audioUrls, setAudioUrls] = useState<string[]>(
    () => resume?.pronunciationAudioUrls?.map((u) => u ?? ``) ?? [],
  );
  const [ratings, setRatings] = useState<("good" | "medium" | "bad" | null)[]>(
    () => resumeBody?.ratings ?? [],
  );
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(() => resume?.record.id ?? null);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(resume?.record.id ?? null);

  const incomingResumeId = resume?.record.id ?? null;
  if (incomingResumeId !== activeResumeId) {
    setActiveResumeId(incomingResumeId);
    if (resume && resumeBody && resumeExercise) {
      setExercise(resumeExercise);
      setRatings(resumeBody.ratings);
      setAssessmentId(resume.record.id);
      setPhase(`exercise`);
      setComplexityOverride(null);
      setRatingResult(null);
      setAudioUrls(resume.pronunciationAudioUrls?.map((u) => u ?? ``) ?? []);
    }
  }
  const [audioError, setAudioError] = useState(``);
  const { mutate, error: genError } = useGeneratePronunciation();
  const { beginLoading } = useLoading();

  function handleGenerate() {
    setAudioError(``);
    const task = beginLoading(`Generating phrases…`);
    mutate(
      { language, languageComplexity: sliderComplexity },
      {
        onSuccess: (data: PronunciationExercise) => {
          void (async () => {
            const initialRatings = Array.from(
              { length: data.phrases.length },
              () => null as "good" | "medium" | "bad" | null,
            );
            const id = await saveAssessment({
              mode: `pronunciation`,
              language,
              title: data.title,
              difficulty: data.languageComplexity,
              scoreEarned: 0,
              scoreMax: data.phrases.length,
              ratingBefore: null,
              ratingAfter: null,
              completedAt: null,
            });
            const audioKeys = data.phrases.map((_, i) => `assessment-${id}-phrase-${i}`);
            setAssessmentId(id);
            setExercise(data);
            setRatings(initialRatings);
            task.update(`Generating audio…`);
            try {
              const urls = await generatePhrasesAudio(
                data.phrases.map((p) => p.phrase),
                audioKeys,
              );
              setAudioUrls(urls);
              await updateAssessment(id, {
                body: {
                  title: data.title,
                  phrases: data.phrases,
                  audioKeys,
                  ratings: initialRatings,
                },
              });
              setPhase(`exercise`);
            } catch {
              setAudioError(`Failed to generate audio. Please try again.`);
            }
            task.done();
          })();
        },
        onError: () => task.done(),
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

  async function handleSubmit() {
    if (!exercise || !assessmentId) return;
    const goodCount = ratings.filter((r) => r === "good").length;
    const mediumCount = ratings.filter((r) => r === "medium").length;
    const weighted = goodCount + 0.75 * mediumCount;
    const total = exercise.phrases.length;
    let rr: RatingResult | null = null;
    if (rated) {
      rr = await computeRating(
        language,
        weighted,
        total,
        exercise.languageComplexity,
        `pronunciation`,
      );
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    void updateAssessment(assessmentId, {
      scoreEarned: weighted,
      scoreMax: total,
      ratingBefore: rr?.oldRating ?? null,
      ratingAfter: rr?.newRating ?? null,
      completedAt,
      body: {
        title: exercise.title,
        phrases: exercise.phrases,
        audioKeys: exercise.phrases.map((_, i) => `assessment-${assessmentId}-phrase-${i}`),
        ratings,
      },
    });
    if (exercise.id) {
      uploadAssessment({
        id: exercise.id,
        userId: await getUserId(),
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
    setComplexityOverride(null);
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
              languageComplexity={sliderComplexity}
              rated={rated}
              savedRating={savedRating}
              error={error}
              generateLabel={`Generate Pronunciation Exercise`}
              onLanguageComplexityChange={setComplexityOverride}
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
            languageComplexity={exercise.languageComplexity}
            title={exercise.title}
            ratings={ratings}
            onRate={handleRate}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `results` && exercise && (
          <PronunciationResultsView
            phrases={exercise.phrases}
            language={language}
            title={exercise.title}
            ratings={ratings}
            ratingResult={ratingResult}
            assessmentId={assessmentId}
            audioUrls={audioUrls.map((u) => u || null)}
            onGoAgain={handleGoAgain}
            onHome={() => navigate(`/`)}
          />
        )}
      </div>
    </div>
  );
}
