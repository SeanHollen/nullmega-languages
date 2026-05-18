import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import { SrsStatsView } from "../components/stats/SrsStatsView";

export function VocabularyStatsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const cards =
    useLiveQuery(
      async () =>
        (await loadFlashcards(language)).map((c) => ({
          status: computeStatus(c),
          lastReviewed: c.lastReviewed,
          currentInterval: c.currentInterval,
        })),
      [language],
    ) ?? [];

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/vocabulary`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Vocabulary Stats`}</h1>
        </div>
        <SrsStatsView
          language={language}
          cards={cards}
          emptyMessage={`No flashcards yet for ${language}.`}
        />
      </div>
    </div>
  );
}
