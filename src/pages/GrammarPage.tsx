import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { BackHeader } from "../components/BackHeader";
import { useLoading } from "../contexts/LoadingContext";
import type { GrammarCard } from "../utils/grammarCards";
import { loadGrammarCards, computeGrammarStatus } from "../utils/grammarCards";
import type { GrammarSettings } from "../utils/grammarSettings";
import {
  GRAMMAR_SETTINGS_DEFAULTS,
  loadGrammarSettings,
  saveGrammarSettings,
  getGeneratedTodayCount,
  NEW_CARDS_PER_DAY_MIN,
  NEW_CARDS_PER_DAY_MAX,
  GRAMMAR_LEVEL_MIN,
  GRAMMAR_LEVEL_MAX,
  GRAMMAR_LEVEL_STEP,
} from "../utils/grammarSettings";
import { prepareGrammarLearnSession, prepareGrammarReviewSession } from "../utils/grammarSession";
import { loadSrsSettings, saveSrsSettings, SRS_SETTINGS_DEFAULTS } from "../utils/srsSettings";
import { ConfirmModal } from "../components/ConfirmModal";
import { ActiveCardsList } from "../components/grammar/ActiveCardsList";
import { GrammarCardTable } from "../components/grammar/GrammarCardTable";
import { Button } from "../components/Button";

const LEVEL_LABELS: Record<number, string> = {
  10: `Absolute Beginner`,
  20: `Beginner`,
  30: `Beginner+`,
  40: `Elementary`,
  50: `Lower Intermediate`,
  60: `Intermediate`,
  70: `Upper Intermediate`,
  80: `Advanced`,
  90: `Proficient`,
  100: `Expert`,
};

export function GrammarPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { beginLoading } = useLoading();
  const { t } = useTranslation();
  const cards =
    useLiveQuery(
      async () => (await loadGrammarCards(language)).sort((a, b) => b.addedAt - a.addedAt),
      [language],
    ) ?? [];
  const settings = useLiveQuery(() => loadGrammarSettings(language), [language]);
  const srsSettings = useLiveQuery(() => loadSrsSettings(), []);
  const generatedToday = useLiveQuery(() => getGeneratedTodayCount(language), [language]) ?? 0;
  const [learnError, setLearnError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function updateSettings(patch: Partial<GrammarSettings>) {
    if (!settings) return;
    void saveGrammarSettings(language, { ...settings, ...patch });
  }

  function restoreDefaults() {
    void saveGrammarSettings(language, { ...GRAMMAR_SETTINGS_DEFAULTS });
    void saveSrsSettings({ ...SRS_SETTINGS_DEFAULTS });
    setConfirmingReset(false);
  }

  async function handleLearn() {
    if (!settings) return;
    setLearnError(null);
    const task = beginLoading(t(`Generating grammar cards…`));
    try {
      const data = await prepareGrammarLearnSession(language, settings);
      if (data) void navigate(`/grammar/learn`, { state: data });
    } catch (err) {
      setLearnError(String(err));
    }
    task.done();
  }

  async function handleReview() {
    setReviewError(null);
    const task = beginLoading(t(`Preparing grammar review…`));
    try {
      const data = await prepareGrammarReviewSession(language);
      if (data) void navigate(`/grammar/review`, { state: data });
    } catch (err) {
      setReviewError(String(err));
    }
    task.done();
  }

  function handlePlayCard(card: GrammarCard) {
    const mode = computeGrammarStatus(card) === `due` ? `review` : `learn`;
    void navigate(`/grammar/${mode}`, {
      state: { cards: [card], current: card, mode },
    });
  }

  const learningCount = cards.filter((c) => computeGrammarStatus(c) === `learning`).length;
  const dueCount = cards.filter((c) => computeGrammarStatus(c) === `due`).length;
  const relearningCount = cards.filter((c) => computeGrammarStatus(c) === `relearning`).length;
  const canGenerate = settings ? Math.max(0, settings.newCardsPerDay - generatedToday) : 0;
  const learnDisabled = !settings || (learningCount === 0 && canGenerate === 0);

  const activeCards = cards.filter((c) => {
    const s = computeGrammarStatus(c);
    return s === `learning` || s === `due` || s === `relearning`;
  });

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <BackHeader title={t(`Grammar Quizzes`)} to="/" />

        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex flex-col min-[420px]:flex-row justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Button
                onClick={() => void handleLearn()}
                disabled={learnDisabled}
                className="bg-white border-2 border-green-400 text-green-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-center min-w-48"
              >
                <div>{t(`Learn new cards →`)}</div>
                <div className="text-sm font-normal text-green-600 mt-1">
                  {t(`generate: {{generate}} · learning: {{learning}}`, {
                    generate: canGenerate,
                    learning: learningCount,
                  })}
                </div>
              </Button>
              {learnError && <p className="text-xs text-red-500">{learnError}</p>}
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button
                onClick={() => void handleReview()}
                disabled={dueCount === 0 && relearningCount === 0}
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
        </div>

        {activeCards.length > 0 && <ActiveCardsList cards={activeCards} onPlay={handlePlayCard} />}

        <div className="mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-4 pb-1 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {t(`Settings`)}
              </p>
            </div>
            <div className="px-6 py-3 flex items-center justify-center gap-3 text-sm">
              <span className="text-gray-600">{t(`New cards per day`)}</span>
              <input
                type="number"
                min={NEW_CARDS_PER_DAY_MIN}
                max={NEW_CARDS_PER_DAY_MAX}
                value={settings?.newCardsPerDay ?? 0}
                onChange={(e) =>
                  updateSettings({ newCardsPerDay: parseInt(e.target.value, 10) || 1 })
                }
                onWheel={(e) => e.currentTarget.blur()}
                disabled={!settings}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="px-6 pt-3 flex items-center justify-center gap-3 text-sm">
              <span className="text-gray-600">{t(`Level`)}</span>
              <input
                type="range"
                min={GRAMMAR_LEVEL_MIN}
                max={GRAMMAR_LEVEL_MAX}
                step={GRAMMAR_LEVEL_STEP}
                value={settings?.level ?? GRAMMAR_LEVEL_MIN}
                onChange={(e) => updateSettings({ level: parseInt(e.target.value, 10) })}
                disabled={!settings}
                className="w-48 accent-green-500 cursor-pointer"
              />
            </div>
            <div className="px-6 pb-3 text-center text-xs text-gray-400">
              {settings
                ? t(`{{level}} — {{label}}`, {
                    level: settings.level,
                    label: t(LEVEL_LABELS[settings.level]),
                  })
                : `—`}
            </div>
            <Button
              onClick={() => setAdvancedOpen((p) => !p)}
              className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer"
            >
              {advancedOpen ? (
                <FaChevronDown className="text-xs" />
              ) : (
                <FaChevronRight className="text-xs" />
              )}
              <span>{t(`Advanced`)}</span>
            </Button>
            {advancedOpen && (
              <div className="px-6 pb-4 flex justify-center text-sm">
                <div className="flex flex-col gap-3 items-start">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={srsSettings?.useEaseFromHistory ?? true}
                      onChange={(e) => {
                        if (!srsSettings) return;
                        void saveSrsSettings({
                          ...srsSettings,
                          useEaseFromHistory: e.target.checked,
                        });
                      }}
                      disabled={!srsSettings}
                      className="accent-green-600 cursor-pointer"
                    />
                    <span className="text-gray-600">{t(`Show harder cards more often`)}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={srsSettings?.showUpcomingBeforeLearning ?? false}
                      onChange={(e) => {
                        if (!srsSettings) return;
                        void saveSrsSettings({
                          ...srsSettings,
                          showUpcomingBeforeLearning: e.target.checked,
                        });
                      }}
                      disabled={!srsSettings}
                      className="accent-green-600 cursor-pointer"
                    />
                    <span className="text-gray-600">
                      {t(`Show upcoming cards before learning cards`)}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={srsSettings?.showDueBeforeRelearning ?? true}
                      onChange={(e) => {
                        if (!srsSettings) return;
                        void saveSrsSettings({
                          ...srsSettings,
                          showDueBeforeRelearning: e.target.checked,
                        });
                      }}
                      disabled={!srsSettings}
                      className="accent-green-600 cursor-pointer"
                    />
                    <span className="text-gray-600">
                      {t(`Show due cards before relearning cards`)}
                    </span>
                  </label>
                </div>
              </div>
            )}
            {advancedOpen && (
              <div className="px-6 pb-4 text-center">
                <Button
                  onClick={() => setConfirmingReset(true)}
                  className="text-sm text-gray-500 hover:text-red-600 underline underline-offset-2 transition cursor-pointer"
                >
                  {t(`Restore defaults`)}
                </Button>
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          open={confirmingReset}
          title={t(`Restore default settings?`)}
          body={t(`This will reset all grammar and SRS settings to their defaults.`)}
          confirmLabel={t(`Restore`)}
          destructive
          onCancel={() => setConfirmingReset(false)}
          onConfirm={restoreDefaults}
        />

        <GrammarCardTable cards={cards} language={language} />
      </div>
    </div>
  );
}
