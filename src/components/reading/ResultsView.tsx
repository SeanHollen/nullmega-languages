import { useState, useEffect } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import { Exercise } from "../../types";
import { RatingResult } from "../../hooks/useAbility";
import { translateBatch } from "../../hooks/useTranslate";

const OUTCOME_STYLE = {
  win: { label: `Win`, color: `text-green-600`, bg: `bg-green-100 border-green-200` },
  draw: { label: `Draw`, color: `text-yellow-600`, bg: `bg-yellow-50 border-yellow-100` },
  loss: { label: `Loss`, color: `text-red-600`, bg: `bg-red-50 border-red-100` },
};

function boldWords(text: string, words: string[]): React.ReactNode {
  if (!words.length) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface Translations {
  questions: string[];
  options: string[][];
}

interface Props {
  exercise: Exercise;
  language: string;
  selected: (number | null)[];
  ratingResult: RatingResult | null;
  onGoAgain: () => void;
  onHome: () => void;
}

export function ResultsView({
  exercise,
  language,
  selected,
  ratingResult,
  onGoAgain,
  onHome,
}: Props) {
  const [translations, setTranslations] = useState<Translations | null>(null);

  useEffect(() => {
    const allTexts = [
      ...exercise.questions.map((q) => q.question),
      ...exercise.questions.flatMap((q) => q.options),
    ];
    translateBatch(allTexts).then((results) => {
      const nq = exercise.questions.length;
      const questions = results.slice(0, nq);
      const options: string[][] = [];
      let cursor = nq;
      for (const q of exercise.questions) {
        options.push(results.slice(cursor, cursor + q.options.length));
        cursor += q.options.length;
      }
      setTranslations({ questions, options });
    });
  }, [exercise]);

  const score = selected.filter((s, i) => s === exercise.questions[i].correct).length;
  const total = exercise.questions.length;
  const outcome = ratingResult ? OUTCOME_STYLE[ratingResult.outcome] : null;

  return (
    <div className="space-y-6">
      <div className={`bg-white rounded-2xl border shadow-sm p-8 text-center ${outcome ? outcome.bg : `border-green-100`}`}>
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
                {ratingResult.change >= 0 ? `(+${ratingResult.change})` : `(${ratingResult.change})`}
              </span>
            </div>
          )
        ) : (
          <p className="text-sm text-gray-400">{`Unrated session`}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{`Passage`}</p>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {boldWords(exercise.passage, exercise.difficultWords.map((w) => w.source))}
        </p>
        <div className="border-t border-green-100 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`English Translation`}</p>
          <p className="text-gray-500 leading-relaxed italic text-sm whitespace-pre-wrap">
            {boldWords(exercise.translation, exercise.difficultWords.map((w) => w.translation))}
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
                <div>
                  <p className="font-medium text-gray-800">{`${qi + 1}. ${q.question}`}</p>
                  {tq && <p className="text-xs text-gray-400 mt-0.5">{tq}</p>}
                </div>
              </div>
              <div className="space-y-1 pl-6 mt-3">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`text-sm px-3 py-2 rounded-lg ${
                      oi === q.correct
                        ? `bg-green-50 text-green-800 font-medium`
                        : oi === selected[qi]
                          ? `bg-red-50 text-red-700`
                          : `text-gray-500`
                    }`}
                  >
                    <p>{opt}</p>
                    {topts?.[oi] && (
                      <p className="text-xs opacity-60 mt-0.5">{topts[oi]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onGoAgain}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
        >
          {`Go Again`}
        </button>
        <button
          onClick={onHome}
          className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:border-gray-300 transition cursor-pointer"
        >
          {`Home`}
        </button>
      </div>
    </div>
  );
}
