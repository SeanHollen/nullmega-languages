import type { ReactNode } from "react";
import type { Question } from "../../types";
import { Button } from "../Button";

interface Props {
  question: Question;
  index: number;
  selected: number | null;
  onSelect: (index: number) => void;
  headerSlot?: ReactNode;
}

export function QuestionCard({ question, index, selected, onSelect, headerSlot }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        {question.question && (
          <p className="font-medium text-gray-800">{`${index + 1}. ${question.question}`}</p>
        )}
        {headerSlot}
      </div>
      <div className="space-y-2">
        {question.options.map((opt, oi) => (
          <Button
            key={oi}
            onClick={() => onSelect(selected === oi ? -1 : oi)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-100 text-sm cursor-pointer ${
              selected === oi
                ? "border-green-500 bg-green-50 text-green-800"
                : "border-gray-200 hover:border-green-300 hover:bg-green-50/40 hover:text-gray-900 active:scale-[0.99] text-gray-700"
            }`}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
}
