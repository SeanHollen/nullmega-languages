import type { GrammarCard, GrammarCategory } from "../../utils/grammarCards";
import { computeGrammarStatus } from "../../utils/grammarCards";

const CATEGORY_LABELS: Record<GrammarCategory, string> = {
  "tense-conjugation": `Tense`,
  "word-order": `Word Order`,
  "parts-of-speech": `Parts of Speech`,
  misc: `Misc`,
};

const CATEGORY_COLORS: Record<GrammarCategory, string> = {
  "tense-conjugation": `bg-blue-100 text-blue-700`,
  "word-order": `bg-purple-100 text-purple-700`,
  "parts-of-speech": `bg-green-100 text-green-700`,
  misc: `bg-gray-100 text-gray-600`,
};

const STATUS_COLORS = {
  learning: `bg-yellow-100 text-yellow-700`,
  due: `bg-orange-100 text-orange-700`,
};

interface Props {
  cards: GrammarCard[];
  onPlay: (card: GrammarCard) => void;
}

export function ActiveCardsList({ cards, onPlay }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-1">
        {cards.map((card) => {
          const status = computeGrammarStatus(card);
          const statusColor = status === `due` ? STATUS_COLORS.due : STATUS_COLORS.learning;
          return (
            <button
              key={card.id}
              onClick={() => onPlay(card)}
              className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 hover:border-green-200 hover:shadow-md transition cursor-pointer text-left"
            >
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[card.category]}`}
              >
                {CATEGORY_LABELS[card.category]}
              </span>
              <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 truncate">
                {card.title}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
