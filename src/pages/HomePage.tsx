import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FaBook,
  FaPen,
  FaHeadphones,
  FaMicrophone,
  FaListUl,
  FaGraduationCap,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import type { Mode } from "../hooks/useAbility";
import { loadAbility, DEFAULT_LANGUAGE_COMPLEXITY } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getCompletedToday } from "../utils/history";
import { loadGoals, type Goals } from "../utils/goals";
import { loadFlashcards, computeStatus, type Flashcard } from "../utils/flashcards";
import { loadVocabSettings, getLearnedTodayCount } from "../utils/vocabSettings";
import { loadGrammarCards, computeGrammarStatus, type GrammarCard } from "../utils/grammarCards";
import { loadGrammarSettings, getGeneratedTodayCount } from "../utils/grammarSettings";
import { useLiveQuery } from "dexie-react-hooks";
import { loadStreaks, recordToday, computeCurrentStreak } from "../utils/streaks";
import { Button } from "../components/Button";

interface ModeConfig {
  label: string;
  Icon: IconType;
  href: string;
  mode: Mode | null;
  kind: `exercise` | `vocab` | `grammar`;
}

const MODES: ModeConfig[] = [
  { label: `Reading`, Icon: FaBook, href: `/reading`, mode: `reading`, kind: `exercise` },
  {
    label: `Listening`,
    Icon: FaHeadphones,
    href: `/listening`,
    mode: `listening`,
    kind: `exercise`,
  },
  { label: `Writing`, Icon: FaPen, href: `/writing`, mode: `writing`, kind: `exercise` },
  {
    label: `Pronunciation`,
    Icon: FaMicrophone,
    href: `/pronunciation`,
    mode: `pronunciation`,
    kind: `exercise`,
  },
  { label: `Vocabulary`, Icon: FaListUl, href: `/vocabulary`, mode: null, kind: `vocab` },
  { label: `Grammar`, Icon: FaGraduationCap, href: `/grammar`, mode: null, kind: `grammar` },
];

interface ModeState {
  hasObligation: boolean;
  met: boolean;
}

function vocabStudyCount(
  vocabCards: Flashcard[],
  vocabNewLimit: number,
  vocabLearnedToday: number,
): number {
  const due = vocabCards.filter((c) => {
    const s = computeStatus(c);
    return s === `due` || s === `relearning`;
  }).length;
  const learning = vocabCards.filter((c) => computeStatus(c) === `learning`).length;
  const remainingNewGoal = Math.max(0, vocabNewLimit - vocabLearnedToday);
  return due + learning + remainingNewGoal;
}

function grammarStudyCount(
  grammarCards: GrammarCard[],
  grammarNewLimit: number,
  grammarGeneratedToday: number,
): number {
  const studyCount = grammarCards.filter((c) => {
    const s = computeGrammarStatus(c);
    return s === `learning` || s === `due`;
  }).length;
  const remainingNewGoal = Math.max(0, grammarNewLimit - grammarGeneratedToday);
  return studyCount + remainingNewGoal;
}

function computeDayState(
  goals: Goals,
  vocabNewLimit: number,
  vocabLearnedToday: number,
  vocabCards: Flashcard[],
  grammarNewLimit: number,
  grammarGeneratedToday: number,
  grammarCards: GrammarCard[],
  completedTodayByMode: Record<Mode, number>,
): { hadObligations: boolean; complete: boolean } {
  const states: ModeState[] = [];

  for (const m of MODES) {
    if (m.kind === `exercise` && m.mode) {
      const goal = goals[m.mode];
      if (goal > 0) {
        states.push({ hasObligation: true, met: completedTodayByMode[m.mode] >= goal });
      }
    } else if (m.kind === `vocab`) {
      if (vocabCards.length > 0 || vocabNewLimit > 0) {
        const studyCount = vocabStudyCount(vocabCards, vocabNewLimit, vocabLearnedToday);
        states.push({ hasObligation: true, met: studyCount === 0 });
      }
    } else if (m.kind === `grammar`) {
      if (grammarCards.length > 0 || grammarNewLimit > 0) {
        const studyCount = grammarStudyCount(grammarCards, grammarNewLimit, grammarGeneratedToday);
        states.push({ hasObligation: true, met: studyCount === 0 });
      }
    }
  }

  const hadObligations = states.length > 0;
  const complete = hadObligations && states.every((s) => s.met);
  return { hadObligations, complete };
}

export function HomePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const goals = useLiveQuery(() => loadGoals(language), [language]);
  const vocabSettings = useLiveQuery(() => loadVocabSettings(), []);
  const learnedToday = useLiveQuery(() => getLearnedTodayCount(), []) ?? 0;
  const vocabCards = useLiveQuery(() => loadFlashcards(language), [language]) ?? [];
  const grammarSettings = useLiveQuery(() => loadGrammarSettings(), []);
  const grammarGeneratedToday = useLiveQuery(() => getGeneratedTodayCount(), []) ?? 0;
  const grammarCards = useLiveQuery(() => loadGrammarCards(language), [language]) ?? [];
  const allModes = Object.keys(DEFAULT_LANGUAGE_COMPLEXITY) as Mode[];
  const completedTodayByMode = useLiveQuery(async () => {
    const entries = await Promise.all(
      allModes.map(async (m) => [m, await getCompletedToday(m, language)] as const),
    );
    return Object.fromEntries(entries) as Record<Mode, number>;
  }, [language]) ?? { reading: 0, listening: 0, writing: 0, pronunciation: 0 };
  const ratingsByMode = useLiveQuery(async () => {
    const entries = await Promise.all(
      allModes.map(async (m) => [m, await loadAbility(language, m)] as const),
    );
    return Object.fromEntries(entries) as Record<Mode, number | null>;
  }, [language]) ?? { reading: null, listening: null, writing: null, pronunciation: null };

  const streakRecords = useLiveQuery(() => loadStreaks(language), [language]);
  const currentStreak = streakRecords ? computeCurrentStreak(streakRecords) : 0;
  const dayState =
    goals && vocabSettings && grammarSettings
      ? computeDayState(
          goals,
          vocabSettings.newWordsPerDay,
          learnedToday,
          vocabCards,
          grammarSettings.newCardsPerDay,
          grammarGeneratedToday,
          grammarCards,
          completedTodayByMode,
        )
      : null;
  const complete = dayState?.complete ?? null;
  const hadObligations = dayState?.hadObligations ?? null;
  useEffect(() => {
    if (complete === null || hadObligations === null) return;
    void recordToday(language, complete, hadObligations);
  }, [language, complete, hadObligations]);

  return (
    <div className="min-h-screen bg-green-100 flex flex-col items-center px-4 pt-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t(`The Language Lab`)}</h1>
          <p className="text-gray-500">{t(`Any language, any level`)}</p>
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-3">
            {currentStreak > 0 && (
              <span className="text-sm text-gray-500">
                {currentStreak === 1
                  ? t(`Current streak: {{count}} day`, { count: currentStreak })
                  : t(`Current streak: {{count}} days`, { count: currentStreak })}
              </span>
            )}
            <Button
              onClick={() => void navigate(`/goals`)}
              className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer"
            >
              {t(`Set daily goals →`)}
            </Button>
            <Button
              onClick={() => void navigate(`/streaks`)}
              className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer"
            >
              {t(`View streaks →`)}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, mode, kind }) => {
            const rating = mode ? ratingsByMode[mode] : null;
            const completedToday = mode ? completedTodayByMode[mode] : 0;
            const goal = mode && goals ? goals[mode] : 0;
            const met = completedToday >= goal;
            const showBadge = mode && (goal > 0 || completedToday > 0);

            const cardCount = kind === `vocab` ? vocabCards.length : null;
            const vocabNewLimit = vocabSettings?.newWordsPerDay ?? 0;
            const studyCount =
              kind === `vocab` && vocabSettings
                ? vocabStudyCount(vocabCards, vocabNewLimit, learnedToday)
                : null;
            const showStudyBadge = studyCount !== null && cardCount !== null && cardCount > 0;

            const grammarCount = kind === `grammar` ? grammarCards.length : null;
            const grammarNewLimit = grammarSettings?.newCardsPerDay ?? 0;
            const grammarStudyCountValue =
              kind === `grammar` && grammarSettings
                ? grammarStudyCount(grammarCards, grammarNewLimit, grammarGeneratedToday)
                : null;
            const showGrammarStudyBadge =
              grammarStudyCountValue !== null && grammarCount !== null && grammarCount > 0;
            return (
              <Button
                key={label}
                onClick={() => void navigate(href)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-1 hover:shadow-md hover:border-green-200 transition group cursor-pointer text-center"
              >
                <Icon className="text-3xl text-gray-500 group-hover:text-green-500 transition" />
                <span className="font-semibold text-gray-800 group-hover:text-green-600 transition">
                  {t(label)}
                </span>
                {mode && (
                  <span className="text-xs font-medium">
                    {rating !== null ? (
                      <span className="text-green-600">{t(`Rating: {{rating}}`, { rating })}</span>
                    ) : (
                      <span className="text-gray-300">{t(`Unrated`)}</span>
                    )}
                  </span>
                )}
                {cardCount !== null && (
                  <span className="text-xs font-medium text-green-600">
                    {cardCount === 1
                      ? t(`1 card saved`)
                      : t(`{{count}} cards saved`, { count: cardCount })}
                  </span>
                )}
                {showStudyBadge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      studyCount > 0
                        ? `text-yellow-700 bg-yellow-100`
                        : `text-green-700 bg-green-100`
                    }`}
                  >
                    {studyCount > 0
                      ? t(`{{count}} cards left`, { count: studyCount })
                      : t(`All caught up!`)}
                  </span>
                )}
                {grammarCount !== null && (
                  <span className="text-xs font-medium text-green-600">
                    {grammarCount === 1
                      ? t(`1 card`)
                      : t(`{{count}} cards`, { count: grammarCount })}
                  </span>
                )}
                {showGrammarStudyBadge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      grammarStudyCountValue > 0
                        ? `text-yellow-700 bg-yellow-100`
                        : `text-green-700 bg-green-100`
                    }`}
                  >
                    {grammarStudyCountValue > 0
                      ? t(`{{count}} cards left`, { count: grammarStudyCountValue })
                      : t(`All caught up!`)}
                  </span>
                )}
                {showBadge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      met ? `text-green-700 bg-green-100` : `text-yellow-700 bg-yellow-100`
                    }`}
                  >
                    {goal > 0
                      ? t(`{{completed}}/{{goal}} completed today`, {
                          completed: completedToday,
                          goal,
                        })
                      : t(`{{completed}} completed today`, { completed: completedToday })}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
