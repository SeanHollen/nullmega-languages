import { useNavigate } from "react-router-dom";
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
import { recordToday, loadStreaks, computeCurrentStreak } from "../utils/streaks";
import { useLiveQuery } from "dexie-react-hooks";

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

function computeDayState(
  goals: Goals,
  vocabNewLimit: number,
  learnedToday: number,
  vocabCards: Flashcard[],
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
      if (vocabCards.length > 0) {
        const due = vocabCards.filter((c) => computeStatus(c) === `due`).length;
        const learning = vocabCards.filter((c) => {
          const s = computeStatus(c);
          return s === `learning` || s === `relearning`;
        }).length;
        const availableNew = Math.max(
          0,
          Math.min(
            vocabCards.filter((c) => computeStatus(c) === `new`).length,
            vocabNewLimit - learnedToday,
          ),
        );
        const studyCount = due + learning + availableNew;
        states.push({ hasObligation: true, met: studyCount === 0 });
      }
    } else if (m.kind === `grammar`) {
      if (grammarCards.length > 0) {
        const studyCount = grammarCards.filter((c) => {
          const s = computeGrammarStatus(c);
          return s === `learning` || s === `due`;
        }).length;
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
  const goals = useLiveQuery(() => loadGoals(language), [language]);
  const vocabSettings = useLiveQuery(() => loadVocabSettings(), []);
  const learnedToday = useLiveQuery(() => getLearnedTodayCount(), []) ?? 0;
  const vocabCards = useLiveQuery(() => loadFlashcards(language), [language]) ?? [];
  const grammarCards = useLiveQuery(() => loadGrammarCards(language), [language]) ?? [];
  const allModes = Object.keys(DEFAULT_LANGUAGE_COMPLEXITY) as Mode[];
  const completedTodayByMode = useLiveQuery(async () => {
    const entries = await Promise.all(
      allModes.map(async (m) => [m, await getCompletedToday(m)] as const),
    );
    return Object.fromEntries(entries) as Record<Mode, number>;
  }, []) ?? { reading: 0, listening: 0, writing: 0, pronunciation: 0 };
  const ratingsByMode = useLiveQuery(async () => {
    const entries = await Promise.all(
      allModes.map(async (m) => [m, await loadAbility(language, m)] as const),
    );
    return Object.fromEntries(entries) as Record<Mode, number | null>;
  }, [language]) ?? { reading: null, listening: null, writing: null, pronunciation: null };

  // Visiting the home page records today's progress. Fire-and-forget — Dexie put is
  // idempotent by primary key so repeated renders just overwrite today's record. Only
  // run once async state has loaded so we don't snapshot a stale "no obligations" state.
  if (goals && vocabSettings) {
    const { hadObligations, complete } = computeDayState(
      goals,
      vocabSettings.newWordsPerDay,
      learnedToday,
      vocabCards,
      grammarCards,
      completedTodayByMode,
    );
    void recordToday(complete, hadObligations);
  }
  const streakRecords = useLiveQuery(() => loadStreaks(), []);
  const currentStreak = streakRecords ? computeCurrentStreak(streakRecords) : 0;

  return (
    <div className="min-h-screen bg-green-100 flex flex-col items-center px-4 pt-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{`The Language Lab`}</h1>
          <p className="text-gray-500">{`Any language, any level`}</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={() => navigate(`/goals`)}
              className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer"
            >
              {`Set daily goals →`}
            </button>
            <button
              onClick={() => navigate(`/streaks`)}
              className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer"
            >
              {`View streaks →`}
            </button>
          </div>
          {currentStreak > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {`Current streak: ${currentStreak} ${currentStreak === 1 ? `day` : `days`}`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, mode, kind }) => {
            const rating = mode ? ratingsByMode[mode] : null;
            const completedToday = mode ? completedTodayByMode[mode] : 0;
            const goal = mode && goals ? goals[mode] : 0;
            const met = completedToday >= goal;
            const showBadge = mode && (goal > 0 || completedToday > 0);

            const cardCount = kind === `vocab` ? vocabCards.length : null;
            const studyCount =
              kind === `vocab` && vocabSettings
                ? (() => {
                    const due = vocabCards.filter((c) => computeStatus(c) === `due`).length;
                    const learning = vocabCards.filter((c) => {
                      const s = computeStatus(c);
                      return s === `learning` || s === `relearning`;
                    }).length;
                    const availableNew = Math.max(
                      0,
                      Math.min(
                        vocabCards.filter((c) => computeStatus(c) === `new`).length,
                        vocabSettings.newWordsPerDay - learnedToday,
                      ),
                    );
                    return due + learning + availableNew;
                  })()
                : null;

            const grammarCount = kind === `grammar` ? grammarCards.length : null;
            const grammarStudyCount =
              kind === `grammar`
                ? grammarCards.filter((c) => {
                    const s = computeGrammarStatus(c);
                    return s === `learning` || s === `due`;
                  }).length
                : null;
            return (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-1 hover:shadow-md hover:border-green-200 transition group cursor-pointer text-center"
              >
                <Icon className="text-3xl text-gray-500 group-hover:text-green-500 transition" />
                <span className="font-semibold text-gray-800 group-hover:text-green-600 transition">
                  {label}
                </span>
                {mode && (
                  <span className="text-xs font-medium">
                    {rating !== null ? (
                      <span className="text-green-600">{`Rating: ${rating}`}</span>
                    ) : (
                      <span className="text-gray-300">{`Unrated`}</span>
                    )}
                  </span>
                )}
                {cardCount !== null && (
                  <span className="text-xs font-medium text-green-600">
                    {cardCount === 1 ? `1 card saved` : `${cardCount} cards saved`}
                  </span>
                )}
                {studyCount !== null && cardCount !== null && cardCount > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      studyCount > 0
                        ? `text-yellow-700 bg-yellow-100`
                        : `text-green-700 bg-green-100`
                    }`}
                  >
                    {studyCount > 0 ? `${studyCount} cards left` : `All caught up!`}
                  </span>
                )}
                {grammarCount !== null && (
                  <span className="text-xs font-medium text-green-600">
                    {grammarCount === 1 ? `1 card` : `${grammarCount} cards`}
                  </span>
                )}
                {grammarStudyCount !== null && grammarCount !== null && grammarCount > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      grammarStudyCount > 0
                        ? `text-yellow-700 bg-yellow-100`
                        : `text-green-700 bg-green-100`
                    }`}
                  >
                    {grammarStudyCount > 0 ? `${grammarStudyCount} cards left` : `All caught up!`}
                  </span>
                )}
                {showBadge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      met ? `text-green-700 bg-green-100` : `text-yellow-700 bg-yellow-100`
                    }`}
                  >
                    {goal > 0
                      ? `${completedToday}/${goal} completed today`
                      : `${completedToday} completed today`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
