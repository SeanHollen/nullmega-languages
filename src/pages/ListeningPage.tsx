import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { SetupView } from "../components/reading/SetupView";
import { ListeningPassageView } from "../components/listening/ListeningPassageView";
import type { Translations } from "../components/reading-listening/ResultsView";
import { ResultsView } from "../components/reading-listening/ResultsView";
import { HistoryList, type ResumeState } from "../components/HistoryList";
import type { ListeningBody } from "../utils/history";
import { useGenerateReading } from "../hooks/useGenerateReading";
import { translateBatch } from "../hooks/useTranslate";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import type { ExerciseAudio } from "../hooks/useTTS";
import { generateExerciseAudio } from "../hooks/useTTS";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment, updateAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { resolveSliderComplexity } from "../utils/sliderComplexity";
import { loadPerModeDefault } from "../utils/onboarding";
import type { ReadingLength } from "../utils/prompts";
import type { Exercise } from "../types";

type Phase = "setup" | "listening" | "results";

export function ListeningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `listening`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as ListeningBody | undefined) : undefined;
  const savedRating = useLiveQuery(() => loadAbility(language, `listening`), [language]) ?? null;
  const onboardingDefault =
    useLiveQuery(() => loadPerModeDefault(language, `listening`), [language]) ?? null;
  const [complexityOverride, setComplexityOverride] = useState<number | null>(null);
  const sliderComplexity = resolveSliderComplexity({
    override: complexityOverride,
    savedRating,
    defaultComplexity: onboardingDefault ?? DEFAULT_LANGUAGE_COMPLEXITY.listening,
  });
  const [rated, setRated] = useState(true);
  const [length, setLength] = useState<ReadingLength>(
    () => resumeBody?.exercise?.length ?? `medium`,
  );
  const [phase, setPhase] = useState<Phase>(() => (resumeBody ? `listening` : `setup`));
  const [exercise, setExercise] = useState<Exercise | null>(() => resumeBody?.exercise ?? null);
  const [audio, setAudio] = useState<ExerciseAudio | null>(() =>
    resume?.listeningAudio
      ? {
          passageUrl: resume.listeningAudio.passageUrl ?? "",
          questionUrls: resume.listeningAudio.questionUrls.map((u) => u ?? ""),
        }
      : null,
  );
  const [selected, setSelected] = useState<(number | null)[]>(() => resumeBody?.selected ?? []);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(() => resume?.record.id ?? null);
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [audioError, setAudioError] = useState(``);
  const { mutate, error: genError } = useGenerateReading();
  const { beginLoading } = useLoading();
  const [activeResumeId, setActiveResumeId] = useState<string | null>(resume?.record.id ?? null);

  const incomingResumeId = resume?.record.id ?? null;
  if (incomingResumeId !== activeResumeId) {
    setActiveResumeId(incomingResumeId);
    if (resume && resumeBody) {
      setExercise(resumeBody.exercise);
      setSelected(resumeBody.selected);
      setAssessmentId(resume.record.id);
      setPhase(`listening`);
      setComplexityOverride(null);
      setLength(resumeBody.exercise.length ?? `medium`);
      setRatingResult(null);
      setTranslations(null);
      setAudioError(``);
      if (resume.listeningAudio) {
        setAudio({
          passageUrl: resume.listeningAudio.passageUrl ?? ``,
          questionUrls: resume.listeningAudio.questionUrls.map((u) => u ?? ``),
        });
      }
    }
  }

  function handleGenerate() {
    setAudioError(``);
    const task = beginLoading(t(`Generating passage…`));
    mutate(
      { language, languageComplexity: sliderComplexity, length, mode: `listening` },
      {
        onSuccess: (data: Exercise) => {
          void (async () => {
            const initialSelected = Array.from(
              { length: data.questions.length },
              () => null as number | null,
            );
            const id = await saveAssessment({
              mode: `listening`,
              language,
              title: data.title,
              difficulty: data.languageComplexity,
              scoreEarned: 0,
              scoreMax: data.questions.length,
              ratingBefore: null,
              ratingAfter: null,
              completedAt: null,
            });
            const audioKeyPassage = `assessment-${id}-passage`;
            const audioKeyQuestions = data.questions.map((_, i) => `assessment-${id}-q-${i}`);
            setAssessmentId(id);
            setExercise(data);
            setSelected(initialSelected);
            task.update(t(`Generating audio…`));
            try {
              const exerciseAudio = await generateExerciseAudio(
                data,
                {
                  passage: audioKeyPassage,
                  questions: audioKeyQuestions,
                },
                language,
              );
              setAudio(exerciseAudio);
              await updateAssessment(id, {
                body: {
                  exercise: data,
                  selected: initialSelected,
                  audioKeyPassage,
                  audioKeyQuestions,
                },
              });
              setPhase(`listening`);
            } catch {
              setAudioError(t(`Failed to generate audio. Please try again.`));
            }
            task.done();
          })();
        },
        onError: () => task.done(),
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

  async function handleSubmit() {
    if (!exercise || !assessmentId) return;
    const correct = selected.filter((s, i) => s === exercise.questions[i].correct).length;
    const total = exercise.questions.length;
    let rr: RatingResult | null = null;
    if (rated) {
      rr = await computeRating(language, correct, total, exercise.languageComplexity, `listening`);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    void updateAssessment(assessmentId, {
      scoreEarned: correct,
      scoreMax: total,
      ratingBefore: rr?.oldRating ?? null,
      ratingAfter: rr?.newRating ?? null,
      completedAt,
      body: {
        exercise,
        selected,
        audioKeyPassage: `assessment-${assessmentId}-passage`,
        audioKeyQuestions: exercise.questions.map((_, i) => `assessment-${assessmentId}-q-${i}`),
      },
    });
    if (exercise.id) {
      uploadAssessment({
        id: exercise.id,
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
    setComplexityOverride(null);
    setPhase(`setup`);
  }

  const error = genError?.message ?? audioError;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader title={t(`Listening Comprehension`)} to="/" />

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={sliderComplexity}
              rated={rated}
              savedRating={savedRating}
              error={error}
              generateLabel={t(`Generate Listening Exercise`)}
              length={length}
              onLengthChange={setLength}
              onLanguageComplexityChange={setComplexityOverride}
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
            languageComplexity={exercise.languageComplexity}
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
            mode="listening"
            selected={selected}
            ratingResult={ratingResult}
            assessmentId={assessmentId}
            translations={translations}
            audio={
              audio
                ? {
                    passageUrl: audio.passageUrl || null,
                    questionUrls: audio.questionUrls.map((u) => u || null),
                  }
                : undefined
            }
            onGoAgain={handleGoAgain}
            onHome={() => navigate(`/`)}
          />
        )}
      </div>
    </div>
  );
}
