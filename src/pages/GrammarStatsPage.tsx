import { useLiveQuery } from "dexie-react-hooks";
import { useLanguage } from "../contexts/LanguageContext";
import { loadGrammarCards, computeGrammarStatus } from "../utils/grammarCards";
import { SrsStatsView } from "../components/stats/SrsStatsView";
import { BackHeader } from "../components/BackHeader";

export function GrammarStatsPage() {
  const { language } = useLanguage();

  const cards =
    useLiveQuery(
      async () =>
        (await loadGrammarCards(language)).map((c) => ({
          status: computeGrammarStatus(c),
          lastReviewed: c.lastReviewed,
          currentInterval: c.currentInterval,
          addedAt: c.addedAt,
        })),
      [language],
    ) ?? [];

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <BackHeader title="Grammar Stats" to="/grammar" />
        <SrsStatsView
          language={language}
          cards={cards}
          emptyMessage={`No grammar cards yet for ${language}.`}
        />
      </div>
    </div>
  );
}
