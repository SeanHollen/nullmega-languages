import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { SetupView } from "../components/reading/SetupView";
import { WritingPassageView } from "../components/writing/WritingPassageView";
import { WritingResultsView } from "../components/writing/WritingResultsView";
import { DictoglossListeningView } from "../components/writing/DictoglossListeningView";
import { DictoglossWritingView } from "../components/writing/DictoglossWritingView";
import { VocabParagraphWritingView } from "../components/writing/VocabParagraphWritingView";
import { HistoryList, type ResumeState } from "../components/HistoryList";
import type { WritingBody } from "../utils/history";
import type { WritingExercise, WritingMode, WritingQuestion } from "../hooks/useGenerateWriting";
import { useGenerateWriting, buildVocabParagraphExercise } from "../hooks/useGenerateWriting";
import type { WritingGrade } from "../hooks/useGradeWriting";
import { useGradeWriting } from "../hooks/useGradeWriting";
import { useGradeVocabParagraph } from "../hooks/useGradeVocabParagraph";
import { generatePhrasesAudio } from "../hooks/useTTS";
import { loadFlashcards } from "../utils/flashcards";
import { pickUpcomingVocabWords } from "../utils/pickUpcomingVocabWords";
import type { RatingResult } from "../hooks/useAbility";
import { loadAbility, computeRating, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import { saveAssessment, updateAssessment } from "../utils/history";
import { uploadAssessment } from "../utils/api";
import { getUserId } from "../utils/user";
import { resolveSliderComplexity } from "../utils/sliderComplexity";
import { loadPerModeDefault } from "../utils/onboarding";

type Phase = "setup" | "listening" | "writing" | "results";

const DICTOGLOSS_PROMPT = `Summarize the passage in as much detail as you can recall.`;

function dictoglossQuestion(): WritingQuestion {
  return { type: `essay`, question: DICTOGLOSS_PROMPT };
}

function initialAnswers(exercise: WritingExercise): string[] {
  if (exercise.mode === `dictogloss` || exercise.mode === `vocab-paragraph`) return [``];
  return Array.from({ length: exercise.questions.length }, () => ``);
}

function gradingQuestions(exercise: WritingExercise): WritingQuestion[] {
  if (exercise.mode === `dictogloss`) return [dictoglossQuestion()];
  return exercise.questions;
}

function gradingMaxScore(exercise: WritingExercise): number {
  if (exercise.mode === `dictogloss` || exercise.mode === `vocab-paragraph`) return 5;
  return exercise.questions.length * 5;
}

export function WritingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const resume =
    (location.state as ResumeState | null)?.record?.mode === `writing`
      ? (location.state as ResumeState)
      : null;
  const resumeBody = resume ? (resume.record.body as WritingBody | undefined) : undefined;
  const savedRating = useLiveQuery(() => loadAbility(language, `writing`), [language]) ?? null;
  const onboardingDefault =
    useLiveQuery(() => loadPerModeDefault(language, `writing`), [language]) ?? null;
  const [complexityOverride, setComplexityOverride] = useState<number | null>(null);
  const sliderComplexity = resolveSliderComplexity({
    override: complexityOverride,
    savedRating,
    defaultComplexity: onboardingDefault ?? DEFAULT_LANGUAGE_COMPLEXITY.writing,
  });
  const [rated, setRated] = useState(true);
  const [mode, setMode] = useState<WritingMode | null>(() => resumeBody?.exercise?.mode ?? null);
  const [phase, setPhase] = useState<Phase>(() => {
    if (!resumeBody) return `setup`;
    return resumeBody.exercise.mode === `dictogloss` ? `listening` : `writing`;
  });
  // Phase init mirrors the resume logic above — kept in sync in the resume track-and-reset
  // block below.
  const [exercise, setExercise] = useState<WritingExercise | null>(
    () => resumeBody?.exercise ?? null,
  );
  const [answers, setAnswers] = useState<string[]>(() => (resumeBody ? resumeBody.answers : []));
  const [audioUrl, setAudioUrl] = useState<string | null>(() => resume?.writingPassageUrl ?? null);
  const [grades, setGrades] = useState<WritingGrade[]>([]);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(() => resume?.record.id ?? null);
  const generateWriting = useGenerateWriting();
  const gradeWriting = useGradeWriting();
  const gradeVocabParagraph = useGradeVocabParagraph();
  const upcomingVocabCount =
    useLiveQuery(async () => {
      const all = await loadFlashcards(language);
      return all.filter((c) => c.status === `scheduled`).length;
    }, [language]) ?? 0;
  const { beginLoading } = useLoading();
  const [activeResumeId, setActiveResumeId] = useState<string | null>(resume?.record.id ?? null);

  const incomingResumeId = resume?.record.id ?? null;
  if (incomingResumeId !== activeResumeId) {
    setActiveResumeId(incomingResumeId);
    if (resume && resumeBody) {
      setExercise(resumeBody.exercise);
      setAnswers(resumeBody.answers);
      setAssessmentId(resume.record.id);
      setMode(resumeBody.exercise.mode);
      setPhase(resumeBody.exercise.mode === `dictogloss` ? `listening` : `writing`);
      setComplexityOverride(null);
      setGrades([]);
      setRatingResult(null);
      setAudioUrl(resume.writingPassageUrl ?? null);
    }
  }

  function handleGenerate() {
    if (!mode) return;
    if (mode === `vocab-paragraph`) {
      void handleGenerateVocabParagraph();
      return;
    }
    const llmMode = mode;
    const task = beginLoading(t(`Generating passage…`));
    generateWriting.mutate(
      { language, languageComplexity: sliderComplexity, mode: llmMode },
      {
        onSuccess: (data: WritingExercise) => {
          void (async () => {
            const answersSeed = initialAnswers(data);
            const maxScore = gradingMaxScore(data);
            const id = await saveAssessment({
              mode: `writing`,
              language,
              title: data.title,
              difficulty: data.languageComplexity,
              scoreEarned: 0,
              scoreMax: maxScore,
              ratingBefore: null,
              ratingAfter: null,
              completedAt: null,
              body: { exercise: data, answers: answersSeed, grades: [] },
            });
            setAssessmentId(id);
            setExercise(data);
            setAnswers(answersSeed);

            if (data.mode === `dictogloss`) {
              task.update(t(`Generating audio…`));
              try {
                const audioKeyPassage = `assessment-${id}-passage`;
                const [url] = await generatePhrasesAudio(
                  [data.passage],
                  [audioKeyPassage],
                  `passage`,
                  language,
                );
                setAudioUrl(url);
                await updateAssessment(id, {
                  body: {
                    exercise: data,
                    answers: answersSeed,
                    grades: [],
                    audioKeyPassage,
                  },
                });
                setPhase(`listening`);
              } catch {
                // Audio failed — fall through to setup; user can retry.
              }
            } else {
              setPhase(`writing`);
            }
            task.done();
          })();
        },
        onError: () => task.done(),
      },
    );
  }

  async function handleGenerateVocabParagraph() {
    const task = beginLoading(t(`Picking vocab…`));
    const cards = await loadFlashcards(language);
    const picked = pickUpcomingVocabWords(cards);
    if (picked.length === 0) {
      task.done();
      return;
    }
    const data = buildVocabParagraphExercise({
      languageComplexity: sliderComplexity,
      requiredWords: picked.map((c) => ({ source: c.source, translation: c.translation })),
    });
    const answersSeed = initialAnswers(data);
    const id = await saveAssessment({
      mode: `writing`,
      language,
      title: t(`Vocab paragraph`),
      difficulty: data.languageComplexity,
      scoreEarned: 0,
      scoreMax: gradingMaxScore(data),
      ratingBefore: null,
      ratingAfter: null,
      completedAt: null,
      body: { exercise: data, answers: answersSeed, grades: [] },
    });
    setAssessmentId(id);
    setExercise(data);
    setAnswers(answersSeed);
    setPhase(`writing`);
    task.done();
  }

  function handleAnswerChange(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleAppendToAnswer(index: number, text: string) {
    setAnswers((prev) => {
      const next = [...prev];
      const existing = next[index] ?? ``;
      const sep = existing && !/\s$/.test(existing) ? ` ` : ``;
      next[index] = existing + sep + text;
      return next;
    });
  }

  function handleSubmit() {
    if (!exercise || !assessmentId) return;
    const task = beginLoading(t(`Grading your answers…`));

    const onGraded = async (result: { grades: WritingGrade[] }) => {
      setGrades(result.grades);
      const totalScore = result.grades.reduce((sum, g) => sum + g.score, 0);
      const maxScore = gradingMaxScore(exercise);
      let rr: RatingResult | null = null;
      if (rated) {
        rr = await computeRating(
          language,
          totalScore,
          maxScore,
          exercise.languageComplexity,
          `writing`,
        );
      }
      setRatingResult(rr);
      const completedAt = Date.now();
      await updateAssessment(assessmentId, {
        scoreEarned: totalScore,
        scoreMax: maxScore,
        ratingBefore: rr?.oldRating ?? null,
        ratingAfter: rr?.newRating ?? null,
        completedAt,
        body: {
          exercise,
          answers,
          grades: result.grades,
          audioKeyPassage:
            exercise.mode === `dictogloss` ? `assessment-${assessmentId}-passage` : undefined,
        },
      });
      if (exercise.id) {
        uploadAssessment({
          id: exercise.id,
          userId: await getUserId(),
          scoreEarned: totalScore,
          scoreMax: maxScore,
          completedAt,
        });
      }
      setPhase(`results`);
    };

    if (exercise.mode === `vocab-paragraph`) {
      gradeVocabParagraph.mutate(
        {
          language,
          languageComplexity: exercise.languageComplexity,
          requiredWords: exercise.requiredWords ?? [],
          paragraph: answers[0] ?? ``,
        },
        {
          onSettled: () => task.done(),
          onSuccess: (result) => {
            void onGraded(result);
          },
        },
      );
      return;
    }

    const questionsForGrading = gradingQuestions(exercise);
    const exerciseForGrading: WritingExercise = { ...exercise, questions: questionsForGrading };
    gradeWriting.mutate(
      {
        exercise: exerciseForGrading,
        answers,
        language,
        languageComplexity: exercise.languageComplexity,
      },
      {
        onSettled: () => task.done(),
        onSuccess: (result) => {
          void onGraded(result);
        },
      },
    );
  }

  function handleGoAgain() {
    setExercise(null);
    setAnswers([]);
    setGrades([]);
    setRatingResult(null);
    setAssessmentId(null);
    setComplexityOverride(null);
    setAudioUrl(null);
    setMode(null);
    setPhase(`setup`);
  }

  const error = generateWriting.error?.message ?? gradeWriting.error?.message ?? ``;

  function computeDisabledReason(): string | null {
    if (!mode) return t(`Pick a writing mode first`);
    if (mode === `vocab-paragraph` && upcomingVocabCount === 0) {
      return t(`You have no upcoming vocab cards. Add words to your vocabulary first.`);
    }
    return null;
  }
  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader title={t(`Writing Practice`)} to="/" />

        {phase === `setup` && (
          <>
            <SetupView
              language={language}
              languageComplexity={sliderComplexity}
              rated={rated}
              savedRating={savedRating}
              error={error}
              generateLabel={t(`Generate Writing Exercise`)}
              writingMode={mode}
              onWritingModeChange={setMode}
              disabledReason={computeDisabledReason()}
              onLanguageComplexityChange={setComplexityOverride}
              onRatedChange={setRated}
              onGenerate={handleGenerate}
            />
            <HistoryList mode={`writing`} language={language} writingMode={mode} />
          </>
        )}

        {phase === `listening` && exercise && audioUrl && (
          <DictoglossListeningView
            exercise={exercise}
            language={language}
            languageComplexity={exercise.languageComplexity}
            audioUrl={audioUrl}
            onContinue={() => setPhase(`writing`)}
          />
        )}

        {phase === `writing` && exercise && exercise.mode === `dictogloss` && (
          <DictoglossWritingView
            exercise={exercise}
            language={language}
            languageComplexity={exercise.languageComplexity}
            summary={answers[0] ?? ``}
            onSummaryChange={(s) => handleAnswerChange(0, s)}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `writing` && exercise && exercise.mode === `short-answer` && (
          <WritingPassageView
            exercise={exercise}
            language={language}
            languageComplexity={exercise.languageComplexity}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onAppendToAnswer={handleAppendToAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `writing` && exercise && exercise.mode === `vocab-paragraph` && (
          <VocabParagraphWritingView
            exercise={exercise}
            language={language}
            languageComplexity={exercise.languageComplexity}
            paragraph={answers[0] ?? ``}
            onParagraphChange={(s) => handleAnswerChange(0, s)}
            onSubmit={handleSubmit}
          />
        )}

        {phase === `results` && exercise && grades.length > 0 && (
          <WritingResultsView
            exercise={exercise}
            language={language}
            answers={answers}
            grades={grades}
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
