import { useLiveQuery } from "dexie-react-hooks";
import { useLanguage } from "../contexts/LanguageContext";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import { SrsStatsView } from "../components/stats/SrsStatsView";
import { BackHeader } from "../components/BackHeader";

export function VocabularyStatsPage() {
  const { language } = useLanguage();

  const cards =
    useLiveQuery(
      async () =>
        (await loadFlashcards(language)).map((c) => ({
          status: computeStatus(c),
          lastReviewed: c.lastReviewed,
          currentInterval: c.currentInterval,
          addedAt: c.addedAt,
          reviewHistory: c.reviewHistory,
        })),
      [language],
    ) ?? [];

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <BackHeader title="Vocabulary Stats" to="/vocabulary" />
        <SrsStatsView
          language={language}
          cards={cards}
          emptyMessage={`No flashcards yet for ${language}.`}
        />
      </div>
    </div>
  );
}
