import { useNavigate } from "react-router-dom";
import { FaBook, FaPen, FaHeadphones, FaMicrophone, FaListUl } from "react-icons/fa";
import { IconType } from "react-icons";
import { loadAbility, Mode } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getCompletedToday } from "../utils/history";
import { loadGoals } from "../utils/goals";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import { loadVocabSettings, getLearnedTodayCount } from "../utils/vocabSettings";

interface ModeConfig {
  label: string;
  Icon: IconType;
  href: string;
  mode: Mode | null;
}

const MODES: ModeConfig[] = [
  { label: `Reading`, Icon: FaBook, href: `/reading`, mode: `reading` },
  { label: `Writing`, Icon: FaPen, href: `/writing`, mode: `writing` },
  { label: `Listening`, Icon: FaHeadphones, href: `/listening`, mode: `listening` },
  { label: `Pronunciation`, Icon: FaMicrophone, href: `/pronunciation`, mode: `pronunciation` },
  { label: `Vocabulary`, Icon: FaListUl, href: `/vocabulary`, mode: null },
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
          <p className="text-gray-500">{`Practice at your level, in any language`}</p>
          <button
            onClick={() => navigate(`/goals`)}
            className="text-sm text-green-600 hover:text-green-700 font-medium mt-3 cursor-pointer"
          >
            {`Set daily goals →`}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, mode }) => {
            const rating = mode ? loadAbility(language, mode) : null;
            const completedToday = mode ? getCompletedToday(mode) : 0;
            const goal = mode ? goals[mode] : 0;
            const met = completedToday >= goal;
            const showBadge = mode && (goal > 0 || completedToday > 0);
            const allCards = mode ? null : loadFlashcards(language);
            const cardCount = allCards ? allCards.length : null;
            const studyCount = allCards
              ? (() => {
                  const settings = loadVocabSettings();
                  const due = allCards.filter((c) => computeStatus(c) === `due`).length;
                  const learning = allCards.filter((c) => computeStatus(c) === `learning`).length;
                  const availableNew = Math.max(
                    0,
                    Math.min(
                      allCards.filter((c) => computeStatus(c) === `new`).length,
                      settings.newWordsPerDay - getLearnedTodayCount(),
                    ),
                  );
                  return due + learning + availableNew;
                })()
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
