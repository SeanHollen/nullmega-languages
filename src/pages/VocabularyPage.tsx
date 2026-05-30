import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../contexts/LanguageContext";
import { BackHeader } from "../components/BackHeader";
import { useLoading } from "../contexts/LoadingContext";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import type { VocabSettings } from "../utils/vocabSettings";
import { loadVocabSettings, saveVocabSettings, getLearnedTodayCount } from "../utils/vocabSettings";
import { prepareLearnSession, prepareReviewSession } from "../utils/studySession";
import { VocabSettingsPanel } from "../components/vocabulary/VocabSettingsPanel";
import { FlashcardTable } from "../components/vocabulary/FlashcardTable";
import { Button } from "../components/Button";
import { useDayKey } from "../hooks/useDayKey";

export function VocabularyPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { beginLoading } = useLoading();
  const { t } = useTranslation();
  const cards =
    useLiveQuery(
      async () => (await loadFlashcards(language)).sort((a, b) => b.addedAt - a.addedAt),
      [language],
    ) ?? [];
  const dayKey = useDayKey();
  const settings = useLiveQuery(() => loadVocabSettings(), []);
  const learnedToday = useLiveQuery(() => getLearnedTodayCount(), [dayKey]) ?? 0;
  const [learnError, setLearnError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function updateSettings(patch: Partial<VocabSettings>) {
    if (!settings) return;
    void saveVocabSettings({ ...settings, ...patch });
  }

  async function handleStartLearn() {
    if (!settings) return;
    setLearnError(null);
    const task = beginLoading(t(`Generating contexts…`));
    try {
      const data = await prepareLearnSession(language, settings);
      if (data) void navigate(`/vocabulary/learn`, { state: data });
    } catch (err) {
      setLearnError(String(err));
    }
    task.done();
  }

  async function handleStartReview() {
    if (!settings) return;
    setReviewError(null);
    const task = beginLoading(t(`Regenerating contexts…`));
    try {
      const data = await prepareReviewSession(language, settings);
      if (data) void navigate(`/vocabulary/review`, { state: data });
    } catch (err) {
      setReviewError(String(err));
    }
    task.done();
  }

  const availableNewCount = settings
    ? Math.max(
        0,
        Math.min(
          cards.filter((c) => computeStatus(c) === `new`).length,
          settings.newWordsPerDay - learnedToday,
        ),
      )
    : 0;
  const learningCount = cards.filter((c) => computeStatus(c) === `learning`).length;
  const dueCount = cards.filter((c) => computeStatus(c) === `due`).length;
  const relearningCount = cards.filter((c) => computeStatus(c) === `relearning`).length;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <BackHeader title={t(`Vocabulary Flashcards`)} to="/" />

        <div className="flex flex-col min-[420px]:flex-row justify-center gap-4 mb-8">
          <div className="flex flex-col items-center gap-1">
            <Button
              onClick={() => void handleStartLearn()}
              disabled={!settings || (availableNewCount === 0 && learningCount === 0)}
              className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
            >
              <div>{t(`Learn new cards →`)}</div>
              <div className="text-sm font-normal text-green-600 mt-1">
                {t(`new: {{new}} · learning: {{learning}}`, {
                  new: availableNewCount,
                  learning: learningCount,
                })}
              </div>
            </Button>
            {learnError && <p className="text-xs text-red-500">{learnError}</p>}
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              onClick={() => void handleStartReview()}
              disabled={!settings || (dueCount === 0 && relearningCount === 0)}
              className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
            >
              <div>{t(`Review cards →`)}</div>
              <div className="text-sm font-normal text-green-600 mt-1">
                {t(`due: {{due}} · relearning: {{relearning}}`, {
                  due: dueCount,
                  relearning: relearningCount,
                })}
              </div>
            </Button>
            {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
          </div>
        </div>

        {settings && <VocabSettingsPanel settings={settings} onUpdate={updateSettings} />}
        <FlashcardTable cards={cards} language={language} />
      </div>
    </div>
  );
}
