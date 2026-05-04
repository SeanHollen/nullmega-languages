import { useNavigate } from "react-router-dom";
import { FaBook, FaPen, FaHeadphones, FaMicrophone } from "react-icons/fa";
import { IconType } from "react-icons";

interface Mode {
  label: string;
  Icon: IconType;
  href: string;
  active: boolean;
  description: string;
}

const MODES: Mode[] = [
  {
    label: `Reading`,
    Icon: FaBook,
    href: `/reading`,
    active: true,
    description: `Read a passage and answer comprehension questions`,
  },
  {
    label: `Writing`,
    Icon: FaPen,
    href: `/writing`,
    active: false,
    description: `Coming soon`,
  },
  {
    label: `Listening`,
    Icon: FaHeadphones,
    href: `/listening`,
    active: true,
    description: `Listen to a passage and answer comprehension questions`,
  },
  {
    label: `Pronunciation`,
    Icon: FaMicrophone,
    href: `/pronunciation`,
    active: true,
    description: `Listen, speak, and rate your pronunciation`,
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{`Language Lab`}</h1>
          <p className="text-gray-500">{`Practice at your level, in any language`}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {MODES.map(({ label, Icon, href, active, description }) =>
            active ? (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-green-200 transition group cursor-pointer"
              >
                <Icon className="text-3xl text-gray-500 group-hover:text-green-500 transition" />
                <span className="font-semibold text-gray-800 group-hover:text-green-600 transition">
                  {label}
                </span>
                <span className="text-xs text-gray-400 text-center">
                  {description}
                </span>
              </button>
            ) : (
              <div
                key={label}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 opacity-40 cursor-not-allowed"
              >
                <Icon className="text-3xl text-gray-500" />
                <span className="font-semibold text-gray-800">{label}</span>
                <span className="text-xs text-gray-400 text-center">
                  {description}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
