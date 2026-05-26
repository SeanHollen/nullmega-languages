import { useTranslation } from "react-i18next";
import type { GrammarCard } from "../../utils/grammarCards";
import { computeGrammarStatus } from "../../utils/grammarCards";
import { Button } from "../Button";

const STATUS_COLORS = {
  learning: `bg-yellow-100 text-yellow-700`,
  due: `bg-orange-100 text-orange-700`,
  relearning: `bg-red-100 text-red-700`,
};

interface Props {
  cards: GrammarCard[];
  onPlay: (card: GrammarCard) => void;
}

export function ActiveCardsList({ cards, onPlay }: Props) {
  const { t } = useTranslation();
  if (cards.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-1">
        {cards.map((card) => {
          const status = computeGrammarStatus(card);
          let statusColor = STATUS_COLORS.learning;
          if (status === `due`) statusColor = STATUS_COLORS.due;
          if (status === `relearning`) statusColor = STATUS_COLORS.relearning;
          return (
            <Button
              key={card.id}
              onClick={() => onPlay(card)}
              className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 hover:border-green-200 hover:shadow-md transition cursor-pointer text-left"
            >
              <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 truncate">
                {card.title}
              </span>
              {card.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0"
                >
                  {tag}
                </span>
              ))}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}
              >
                {t(status)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
