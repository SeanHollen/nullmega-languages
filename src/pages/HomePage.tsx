import { useNavigate } from "react-router-dom";
import { FaBook, FaPen, FaHeadphones, FaMicrophone } from "react-icons/fa";
import { IconType } from "react-icons";
import { loadAbility, Mode } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getCompletedToday } from "../utils/history";

interface ModeConfig {
  label: string;
  Icon: IconType;
  href: string;
  active: boolean;
  mode: Mode | null;
}

const MODES: ModeConfig[] = [
  { label: `Reading`, Icon: FaBook, href: `/reading`, active: true, mode: `reading` },
  { label: `Writing`, Icon: FaPen, href: `/writing`, active: true, mode: `writing` },
  { label: `Listening`, Icon: FaHeadphones, href: `/listening`, active: true, mode: `listening` },
  {
    label: `Pronunciation`,
    Icon: FaMicrophone,
    href: `/pronunciation`,
    active: true,
    mode: `pronunciation`,
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-green-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{`The Language Lab`}</h1>
          <p className="text-gray-500">{`Practice at your level, in any language`}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, active, mode }) => {
            const rating = mode ? loadAbility(language, mode) : null;
            const completedToday = mode ? getCompletedToday(mode) : 0;
            return active ? (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-1 hover:shadow-md hover:border-green-200 transition group cursor-pointer text-center"
              >
                <Icon className="text-3xl text-gray-500 group-hover:text-green-500 transition" />
                <span className="font-semibold text-gray-800 group-hover:text-green-600 transition">
                  {label}
                </span>
                <span className="text-xs font-medium">
                  {rating !== null ? (
                    <span className="text-green-600">{`Rating: ${rating}`}</span>
                  ) : (
                    <span className="text-gray-300">{`Unrated`}</span>
                  )}
                </span>
                {completedToday > 0 && (
                  <span className="text-xs text-gray-400">{`${completedToday} completed today`}</span>
                )}
              </button>
            ) : (
              <div
                key={label}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-2 opacity-40 cursor-not-allowed text-center"
              >
                <Icon className="text-3xl text-gray-500" />
                <span className="font-semibold text-gray-800">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
