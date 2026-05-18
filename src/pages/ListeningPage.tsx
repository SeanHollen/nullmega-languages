import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { SetupView } from "../components/reading/SetupView";
import { ListeningPassageView } from "../components/listening/ListeningPassageView";
import type { Translations } from "../components/reading/ResultsView";
import { ResultsView } from "../components/reading/ResultsView";
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
import { getUserId } from "../utils/user";
import type { Exercise } from "../types";

type Phase = "setup" | "listening" | "results";

export function ListeningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `listening`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as ListeningBody | undefined) : undefined;
  const [languageComplexity, setLanguageComplexity] = useState(
    () =>
      resume?.record.difficulty ??
      loadAbility(language, `listening`) ??
      DEFAULT_LANGUAGE_COMPLEXITY.listening,
  );
  const [rated, setRated] = useState(true);
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
      setLanguageComplexity(resume.record.difficulty);
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
    const task = beginLoading(`Generating passage…`);
    mutate(
      { language, languageComplexity, mode: `listening` },
      {
        onSuccess: (data: Exercise) => {
          const initialSelected = Array.from(
            { length: data.questions.length },
            () => null as number | null,
          );
          const id = saveAssessment({
            mode: `listening`,
            language,
            title: data.title,
            difficulty: languageComplexity,
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
          task.update(`Generating audio…`);
          void (async () => {
            try {
              const exerciseAudio = await generateExerciseAudio(data, {
                passage: audioKeyPassage,
                questions: audioKeyQuestions,
              });
              setAudio(exerciseAudio);
              updateAssessment(id, {
                body: {
                  exercise: data,
                  selected: initialSelected,
                  audioKeyPassage,
                  audioKeyQuestions,
                },
              });
              setPhase(`listening`);
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
      rr = computeRating(language, correct, total, languageComplexity, `listening`);
    }
    setRatingResult(rr);
    const completedAt = Date.now();
    updateAssessment(assessmentId, {
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
