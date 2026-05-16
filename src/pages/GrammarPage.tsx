import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import type { GrammarCard } from "../utils/grammarCards";
import { loadGrammarCards, computeGrammarStatus } from "../utils/grammarCards";
import type { GrammarSettings } from "../utils/grammarSettings";
import {
  loadGrammarSettings,
  saveGrammarSettings,
  getGeneratedTodayCount,
  NEW_CARDS_PER_DAY_MIN,
  NEW_CARDS_PER_DAY_MAX,
} from "../utils/grammarSettings";
import { prepareGrammarLearnSession, prepareGrammarReviewSession } from "../utils/grammarSession";
import { ActiveCardsList } from "../components/grammar/ActiveCardsList";
import { GrammarCardTable } from "../components/grammar/GrammarCardTable";

const LEVEL_LABELS: Record<number, string> = {
  1: `Absolute Beginner`,
  2: `Beginner`,
  3: `Beginner+`,
  4: `Elementary`,
  5: `Lower Intermediate`,
  6: `Intermediate`,
  7: `Upper Intermediate`,
  8: `Advanced`,
  9: `Proficient`,
  10: `Expert`,
};

export function GrammarPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [cards, setCards] = useState<GrammarCard[]>(() =>
    loadGrammarCards(language).sort((a, b) => b.addedAt - a.addedAt),
  );
  const [settings, setSettingsState] = useState<GrammarSettings>(loadGrammarSettings);
  const [learnLoading, setLearnLoading] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function updateSettings(patch: Partial<GrammarSettings>) {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    saveGrammarSettings(next);
  }

  function refreshCards() {
    setCards(loadGrammarCards(language).sort((a, b) => b.addedAt - a.addedAt));
  }

  function handleLearn() {
    setLearnLoading(true);
    setLearnError(null);
    prepareGrammarLearnSession(language, settings)
      .then((data) => {
        if (!data) {
          setLearnLoading(false);
          return;
        }
        void navigate(`/grammar/learn`, { state: data });
      })
      .catch((err) => {
        setLearnError(String(err));
        setLearnLoading(false);
      });
  }

  function handleReview() {
    setReviewLoading(true);
    setReviewError(null);
    prepareGrammarReviewSession(language)
      .then((data) => {
        if (!data) {
          setReviewLoading(false);
          return;
        }
        void navigate(`/grammar/review`, { state: data });
      })
      .catch((err) => {
        setReviewError(String(err));
        setReviewLoading(false);
      });
  }

  function handlePlayCard(card: GrammarCard) {
    const mode = computeGrammarStatus(card) === `due` ? `review` : `learn`;
    void navigate(`/grammar/${mode}`, {
      state: { cards: [card], current: card, mode },
    });
  }

  const learningCount = cards.filter((c) => computeGrammarStatus(c) === `learning`).length;
  const dueCount = cards.filter((c) => computeGrammarStatus(c) === `due`).length;
  const canGenerate = Math.max(0, settings.newCardsPerDay - getGeneratedTodayCount());
  const learnDisabled = (learningCount === 0 && canGenerate === 0) || learnLoading;

  const activeCards = cards.filter((c) => {
    const s = computeGrammarStatus(c);
    return s === `learning` || s === `due`;
  });

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Grammar Quizzes`}</h1>
        </div>

        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex flex-col min-[420px]:flex-row justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleLearn}
                disabled={learnDisabled}
                className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
              >
                <div>{learnLoading ? `Preparing…` : `Learn new cards →`}</div>
                <div className="text-sm font-normal text-green-600 mt-1">
                  {`learning: ${learningCount} · generate: ${canGenerate}`}
                </div>
              </button>
              {learnError && <p className="text-xs text-red-500">{learnError}</p>}
            </div>

            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleReview}
                disabled={dueCount === 0 || reviewLoading}
                className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
              >
                <div>{reviewLoading ? `Preparing…` : `Review cards →`}</div>
                <div className="text-sm font-normal text-green-600 mt-1">{`due: ${dueCount}`}</div>
              </button>
              {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
            </div>
          </div>
        </div>

        {activeCards.length > 0 && <ActiveCardsList cards={activeCards} onPlay={handlePlayCard} />}

        <div className="mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-4 pb-1 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{`Settings`}</p>
            </div>
            <div className="px-6 py-3 flex items-center justify-center gap-3 text-sm">
              <span className="text-gray-600">{`New cards per day`}</span>
              <input
                type="number"
                min={NEW_CARDS_PER_DAY_MIN}
                max={NEW_CARDS_PER_DAY_MAX}
                value={settings.newCardsPerDay}
                onChange={(e) =>
                  updateSettings({ newCardsPerDay: parseInt(e.target.value, 10) || 1 })
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="px-6 py-3 flex flex-col items-center gap-1 text-sm">
              <span className="text-gray-600">{`Level`}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.level}
                onChange={(e) => updateSettings({ level: parseInt(e.target.value, 10) })}
                className="w-48 accent-green-500 cursor-pointer"
              />
              <span className="text-xs text-gray-400">{`${settings.level} — ${LEVEL_LABELS[settings.level]}`}</span>
            </div>
          </div>
        </div>

        <GrammarCardTable cards={cards} onRefresh={refreshCards} />
      </div>
    </div>
  );
}
