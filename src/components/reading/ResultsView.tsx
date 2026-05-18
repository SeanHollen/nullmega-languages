import { FaCheck, FaTimes } from "react-icons/fa";
import type { Exercise } from "../../types";
import type { RatingResult } from "../../hooks/useAbility";
import { AssessmentFeedback } from "../AssessmentFeedback";
import { AudioPlayer } from "../listening/AudioPlayer";
import { ClickableText } from "../ClickableText";

export interface ResultsAudio {
  passageUrl: string | null;
  questionUrls: (string | null)[];
}

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

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
  const score = selected.filter((s, i) => s === exercise.questions[i].correct).length;
  const total = exercise.questions.length;
  const outcome = ratingResult ? OUTCOME_STYLE[ratingResult.outcome] : null;

  return (
    <div className="space-y-6">
      <div
        className={`bg-white rounded-2xl border shadow-sm p-8 text-center ${outcome ? outcome.bg : `border-green-100`}`}
      >
        {exercise.title && (
          <h2 className="text-lg font-semibold text-gray-700 mb-2">{exercise.title}</h2>
        )}
        {outcome && (
          <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${outcome.color}`}>
            {outcome.label}
          </p>
        )}
        <p className="text-5xl font-bold text-gray-800 mb-3">{`${score}/${total}`}</p>
        {ratingResult ? (
          ratingResult.isPlacement ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} initial rating:`}</span>
              <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">{`${language} rating:`}</span>
              <span className="text-gray-600">{ratingResult.oldRating}</span>
              <span className="text-gray-300">{`→`}</span>
              <span className="font-semibold text-gray-800">{ratingResult.newRating}</span>
              <span className={ratingResult.change >= 0 ? `text-green-600` : `text-red-500`}>
                {ratingResult.change >= 0
                  ? `(+${ratingResult.change})`
                  : `(${ratingResult.change})`}
              </span>
            </div>
          )
        ) : (
          <p className="text-sm text-gray-400">{`Unrated exercise`}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{`Passage`}</p>
        {audio?.passageUrl && <AudioPlayer src={audio.passageUrl} label={`Play passage`} />}
        <p className="text-gray-800 leading-relaxed">
          <ClickableText text={exercise.passage} language={language} />
        </p>
        <div className="border-t border-green-100 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`English Translation`}</p>
          <p className="text-gray-500 leading-relaxed italic text-sm whitespace-pre-wrap">
            {exercise.translation}
          </p>
        </div>
        {exercise.insight && (
          <div className="border-t border-green-100 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`Language Note`}</p>
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
                      <AudioPlayer src={qAudio} label={`Replay question`} small />
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

      <div className="flex gap-3">
        <button
          onClick={onGoAgain}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
        >
          {`Go Again`}
        </button>
        <button
          onClick={onHome}
          className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
        >
          {`Home`}
        </button>
      </div>
    </div>
  );
}
