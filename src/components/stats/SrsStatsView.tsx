import type { SrsCard } from "../../utils/srsForecast";
import type { ReviewEntry } from "../../utils/flashcards";
import { CardsBreakdownChart } from "./CardsBreakdownChart";
import { ForecastChart } from "./ForecastChart";
import { CardsAddedChart } from "./CardsAddedChart";
import { ReviewOutcomesChart } from "./ReviewOutcomesChart";

export interface SrsCardWithStatus extends SrsCard {
  status: string;
  addedAt: number;
  // Optional because only Flashcards record review outcomes today; GrammarCards don't.
  reviewHistory?: ReviewEntry[];
}

interface Props {
  cards: SrsCardWithStatus[];
  emptyMessage: string;
}

export function SrsStatsView({ cards, emptyMessage }: Props) {
  return (
    <div className="space-y-6">
      <CardsBreakdownChart cards={cards} emptyMessage={emptyMessage} />
      <ForecastChart cards={cards} />
      <CardsAddedChart cards={cards} emptyMessage={emptyMessage} />
      <ReviewOutcomesChart cards={cards} />
    </div>
  );
}
