import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { loadGrammarCards, computeGrammarStatus } from "../utils/grammarCards";
import { SrsStatsView } from "../components/stats/SrsStatsView";

export function GrammarStatsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const cards = loadGrammarCards(language).map((c) => ({
    status: computeGrammarStatus(c),
    lastReviewed: c.lastReviewed,
    currentInterval: c.currentInterval,
  }));

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/grammar`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Grammar Stats`}</h1>
        </div>
        <SrsStatsView
          language={language}
          cards={cards}
          emptyMessage={`No grammar cards yet for ${language}.`}
        />
      </div>
    </div>
  );
}
