import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaTimes } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { loadFlashcards } from "../utils/flashcards";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function PracticePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [cards] = useState(() => loadFlashcards(language));

  const [currentId, setCurrentId] = useState<string | null>(() =>
    cards.length === 0 ? null : pickRandom(cards).id,
  );
  const [revealed, setRevealed] = useState(false);
  const [recent, setRecent] = useState<string[]>(currentId ? [currentId] : []);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });

  const current = currentId ? (cards.find((c) => c.id === currentId) ?? null) : null;

  function pickNext() {
    if (cards.length === 0) return;
    const buffer = Math.min(5, Math.max(0, cards.length - 1));
    const recentTail = new Set(recent.slice(-buffer));
    const pool = cards.filter((c) => !recentTail.has(c.id));
    const next = pickRandom(pool.length > 0 ? pool : cards);
    setCurrentId(next.id);
    setRecent((prev) => [...prev, next.id].slice(-Math.max(buffer, 1)));
    setRevealed(false);
  }

  function handleAnswer(right: boolean) {
    setStats((prev) => ({
      right: prev.right + (right ? 1 : 0),
      wrong: prev.wrong + (right ? 0 : 1),
    }));
    pickNext();
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/vocabulary`)}
              className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{`Practice`}</h1>
            <span className="text-sm text-gray-400">{`— ${language}`}</span>
          </div>
          {(stats.right > 0 || stats.wrong > 0) && (
            <div className="flex items-center gap-3 text-sm font-medium">
              <span className="flex items-center gap-1 text-green-600">
                <FaCheck className="text-xs" />
                {stats.right}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <FaTimes className="text-xs" />
                {stats.wrong}
              </span>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {`No flashcards yet. Save some from any exercise's results page first.`}
            </p>
          </div>
        ) : current ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 space-y-6 text-center">
            <p className="text-3xl font-semibold text-gray-800 break-words">{current.source}</p>
            {revealed && (
              <p className="text-xl text-gray-500 italic break-words border-t border-gray-100 pt-6">
                {current.translation || `—`}
              </p>
            )}
            <div className="pt-2">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
                >
                  {`Show answer`}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnswer(false)}
                    className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition cursor-pointer"
                  >
                    {`Wrong`}
                  </button>
                  <button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
                  >
                    {`Right`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
