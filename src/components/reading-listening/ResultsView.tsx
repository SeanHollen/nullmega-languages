import { FaCheck, FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { Exercise } from "../../types";
import type { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";
import { AudioPlayer } from "../listening/AudioPlayer";
import { ClickableText } from "../ClickableText";
import { ResultsScoreCard } from "../ResultsScoreCard";
import { Button } from "../Button";

export interface ResultsAudio {
  passageUrl: string | null;
  questionUrls: (string | null)[];
}

function optionClass(
  optionIndex: number,
  correctIndex: number,
  selectedIndex: number | null,
): string {
  if (optionIndex === correctIndex) return `bg-green-50 text-green-800 font-medium`;
  if (optionIndex === selectedIndex) return `bg-red-50 text-red-700`;
  return `text-gray-500`;
}

export interface Translations {
  questions: string[];
  options: string[][];
}

interface Props {
  exercise: Exercise;
  language: string;
  selected: (number | null)[];
  ratingResult: RatingResult | null;
  assessmentId: string | null;
  translations: Translations | null;
  audio?: ResultsAudio;
  onGoAgain: () => void;
  onHome: () => void;
}

export function ResultsView({
  exercise,
  language,
  selected,
  ratingResult,
  assessmentId,
  translations,
  audio,
  onGoAgain,
  onHome,
}: Props) {
  const { t } = useTranslation();
  const score = selected.filter((s, i) => s === exercise.questions[i].correct).length;
  const total = exercise.questions.length;

  return (
    <div className="space-y-6">
      <ResultsScoreCard
        title={exercise.title}
        scoreText={`${score}/${total}`}
        ratingResult={ratingResult}
        language={language}
      />

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Passage`)}</p>
        {audio?.passageUrl && <AudioPlayer src={audio.passageUrl} label={t(`Play passage`)} />}
        <p className="text-gray-800 leading-relaxed">
          <ClickableText text={exercise.passage} language={language} />
        </p>
        <div className="border-t border-green-100 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
            {t(`English Translation`)}
          </p>
          <p className="text-gray-500 leading-relaxed italic text-sm whitespace-pre-wrap">
            {exercise.translation}
          </p>
        </div>
        {exercise.difficultWords.length > 0 && (
          <div className="border-t border-green-100 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t(`Vocabulary`)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {exercise.difficultWords.map((w, i) => (
                <span key={i} className="text-sm text-gray-500">
                  <span className="text-gray-700">{w.source}</span>
                  {` — `}
                  {w.translation}
                </span>
              ))}
            </div>
          </div>
        )}
        {exercise.insight && (
          <div className="border-t border-green-100 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              {t(`Language Note`)}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">{exercise.insight}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {exercise.questions.map((q, qi) => {
          const correct = selected[qi] === q.correct;
          const tq = translations?.questions[qi];
          const topts = translations?.options[qi];
          const qAudio = audio?.questionUrls[qi];
          return (
            <div
              key={qi}
              className={`bg-white rounded-2xl border shadow-sm p-6 ${correct ? `border-green-200` : `border-red-200`}`}
            >
              <div className="flex items-start gap-2 mb-1">
                {correct ? (
                  <FaCheck className="text-green-500 mt-1 shrink-0" />
                ) : (
                  <FaTimes className="text-red-500 mt-1 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {`${qi + 1}. `}
                    <ClickableText text={q.question} language={language} />
                  </p>
                  {tq && <p className="text-xs text-gray-400 mt-0.5">{tq}</p>}
                  {qAudio && (
                    <div className="mt-2">
                      <AudioPlayer src={qAudio} label={t(`Replay question`)} small />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1 pl-6 mt-3">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`text-sm px-3 py-2 rounded-lg ${optionClass(oi, q.correct, selected[qi])}`}
                  >
                    <p>
                      <ClickableText text={opt} language={language} />
                    </p>
                    {topts?.[oi] && <p className="text-xs opacity-60 mt-0.5">{topts[oi]}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {assessmentId && <AssessmentFeedback assessmentId={assessmentId} />}

      {exercise.summary && (
        <p className="text-sm text-gray-500 leading-relaxed italic">
          <span className="text-xs text-gray-400 uppercase tracking-wide not-italic">
            {`${t(`Summary`)} — `}
          </span>
          {exercise.summary}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          onClick={onGoAgain}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
        >
          {t(`Go Again`)}
        </Button>
        <Button
          onClick={onHome}
          className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
        >
          {t(`Home`)}
        </Button>
      </div>
    </div>
  );
}
