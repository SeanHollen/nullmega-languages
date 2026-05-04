import { Exercise } from "../../types";
import { QuestionCard } from "./QuestionCard";

interface Props {
  exercise: Exercise;
  language: string;
  difficulty: number;
  selected: (number | null)[];
  onSelect: (questionIndex: number, optionIndex: number) => void;
  onSubmit: () => void;
}

export function PassageView({
  exercise,
  language,
  difficulty,
  selected,
  onSelect,
  onSubmit,
}: Props) {
  const allAnswered = selected.every((s) => s !== null);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">
          {`${language} · Level ${difficulty}`}
        </p>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {exercise.passage}
        </p>
      </div>

      {exercise.questions.map((q, qi) => (
        <QuestionCard
          key={qi}
          question={q}
          index={qi}
          selected={selected[qi]}
          onSelect={(oi) => onSelect(qi, oi)}
        />
      ))}

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
      >
        {`Submit Answers`}
      </button>
    </div>
  );
}
