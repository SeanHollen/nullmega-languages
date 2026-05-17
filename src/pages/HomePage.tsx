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
import { loadAbility } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getCompletedToday } from "../utils/history";
import { loadGoals } from "../utils/goals";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import { loadVocabSettings, getLearnedTodayCount } from "../utils/vocabSettings";
import { loadGrammarCards, computeGrammarStatus } from "../utils/grammarCards";

interface ModeConfig {
  label: string;
  Icon: IconType;
  href: string;
  mode: Mode | null;
  kind: `exercise` | `vocab` | `grammar`;
}

const MODES: ModeConfig[] = [
  { label: `Reading`, Icon: FaBook, href: `/reading`, mode: `reading`, kind: `exercise` },
  { label: `Writing`, Icon: FaPen, href: `/writing`, mode: `writing`, kind: `exercise` },
  {
    label: `Listening`,
    Icon: FaHeadphones,
    href: `/listening`,
    mode: `listening`,
    kind: `exercise`,
  },
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

export function HomePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const goals = loadGoals();

  return (
    <div className="min-h-screen bg-green-100 flex flex-col items-center px-4 pt-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{`The Language Lab`}</h1>
          <p className="text-gray-500">{`Any language, any level`}</p>
          <button
            onClick={() => navigate(`/goals`)}
            className="text-sm text-green-600 hover:text-green-700 font-medium mt-3 cursor-pointer"
          >
            {`Set daily goals →`}
          </button>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, mode, kind }) => {
            const rating = mode ? loadAbility(language, mode) : null;
            const completedToday = mode ? getCompletedToday(mode) : 0;
            const goal = mode ? goals[mode] : 0;
            const met = completedToday >= goal;
            const showBadge = mode && (goal > 0 || completedToday > 0);

            const vocabCards = kind === `vocab` ? loadFlashcards(language) : null;
            const cardCount = vocabCards ? vocabCards.length : null;
            const studyCount = vocabCards
              ? (() => {
                  const settings = loadVocabSettings();
                  const due = vocabCards.filter((c) => computeStatus(c) === `due`).length;
                  const learning = vocabCards.filter((c) => {
                    const s = computeStatus(c);
                    return s === `learning` || s === `relearning`;
                  }).length;
                  const availableNew = Math.max(
                    0,
                    Math.min(
                      vocabCards.filter((c) => computeStatus(c) === `new`).length,
                      settings.newWordsPerDay - getLearnedTodayCount(),
                    ),
                  );
                  return due + learning + availableNew;
                })()
              : null;

            const grammarCards = kind === `grammar` ? loadGrammarCards(language) : null;
            const grammarCount = grammarCards ? grammarCards.length : null;
            const grammarStudyCount = grammarCards
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
