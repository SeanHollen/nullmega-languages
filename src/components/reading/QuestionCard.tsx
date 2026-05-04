import { Question } from "../../types";

interface Props {
  question: Question;
  index: number;
  selected: number | null;
  onSelect: (index: number) => void;
}

export function QuestionCard({ question, index, selected, onSelect }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
      <p className="font-medium text-gray-800 mb-4">{`${index + 1}. ${question.question}`}</p>
      <div className="space-y-2">
        {question.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => onSelect(selected === oi ? -1 : oi)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-100 text-sm cursor-pointer ${
              selected === oi
                ? "border-green-500 bg-green-50 text-green-800"
                : "border-gray-200 hover:border-green-300 hover:bg-green-50/40 hover:text-gray-900 active:scale-[0.99] text-gray-700"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
