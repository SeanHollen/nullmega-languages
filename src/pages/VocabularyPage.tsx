import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { useLoading } from "../contexts/LoadingContext";
import type { Flashcard } from "../utils/flashcards";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import type { VocabSettings } from "../utils/vocabSettings";
import { loadVocabSettings, saveVocabSettings, getLearnedTodayCount } from "../utils/vocabSettings";
import { prepareLearnSession, prepareReviewSession } from "../utils/studySession";
import { VocabSettingsPanel } from "../components/vocabulary/VocabSettingsPanel";
import { FlashcardTable } from "../components/vocabulary/FlashcardTable";

export function VocabularyPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { beginLoading } = useLoading();
  const [cards, setCards] = useState<Flashcard[]>(() =>
    loadFlashcards(language).sort((a, b) => b.addedAt - a.addedAt),
  );
  const [settings, setSettingsState] = useState<VocabSettings>(loadVocabSettings);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function updateSettings(patch: Partial<VocabSettings>) {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    saveVocabSettings(next);
  }

  function refreshCards() {
    setCards(loadFlashcards(language).sort((a, b) => b.addedAt - a.addedAt));
  }

  async function handleStartLearn() {
    setLearnError(null);
    const task = beginLoading(`Preparing learn session…`);
    try {
      const data = await prepareLearnSession(language, settings);
      if (data) void navigate(`/vocabulary/learn`, { state: data });
    } catch (err) {
      setLearnError(String(err));
    }
    task.done();
  }

  async function handleStartReview() {
    setReviewError(null);
    const task = beginLoading(`Preparing review session…`);
    try {
      const data = await prepareReviewSession(language, settings);
      if (data) void navigate(`/vocabulary/review`, { state: data });
    } catch (err) {
      setReviewError(String(err));
    }
    task.done();
  }

  const availableNewCount = Math.max(
    0,
    Math.min(
      cards.filter((c) => computeStatus(c) === `new`).length,
      settings.newWordsPerDay - getLearnedTodayCount(),
    ),
  );
  const learningCount = cards.filter((c) => {
    const s = computeStatus(c);
    return s === `learning` || s === `relearning`;
  }).length;
  const dueCount = cards.filter((c) => computeStatus(c) === `due`).length;

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
          <h1 className="text-2xl font-bold text-gray-800">{`Vocabulary Flashcards`}</h1>
        </div>

        <div className="flex flex-col min-[420px]:flex-row justify-center gap-4 mb-8">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleStartLearn}
              disabled={availableNewCount === 0 && learningCount === 0}
              className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
            >
              <div>{`Learn new cards →`}</div>
              <div className="text-sm font-normal text-green-600 mt-1">
                {`new: ${availableNewCount} · learning: ${learningCount}`}
              </div>
            </button>
            {learnError && <p className="text-xs text-red-500">{learnError}</p>}
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleStartReview}
              disabled={dueCount === 0}
              className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
            >
              <div>{`Review cards →`}</div>
              <div className="text-sm font-normal text-green-600 mt-1">{`due: ${dueCount}`}</div>
            </button>
            {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
          </div>
        </div>

        <VocabSettingsPanel settings={settings} onUpdate={updateSettings} />
        <FlashcardTable cards={cards} language={language} onRefresh={refreshCards} />
      </div>
    </div>
  );
}
