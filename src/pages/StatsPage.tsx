import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { FaArrowLeft } from "react-icons/fa";
import { BackHeader } from "../components/BackHeader";
import type { Mode } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getHistory } from "../utils/history";
import { Button } from "../components/Button";
import { OutcomesByDifficultyChart } from "../components/stats/OutcomesByDifficultyChart";
import { RatingOverTimeChart } from "../components/stats/RatingOverTimeChart";
import { PointsPerDayChart } from "../components/stats/PointsPerDayChart";

const MODE_LABELS: Record<Mode, string> = {
  reading: `Reading`,
  writing: `Writing`,
  listening: `Listening`,
  pronunciation: `Pronunciation`,
};

const MODE_COLORS: Record<Mode, string> = {
  reading: `#16a34a`,
  writing: `#0ea5e9`,
  listening: `#f59e0b`,
  pronunciation: `#a855f7`,
};

const VALID_MODES: Mode[] = [`reading`, `writing`, `listening`, `pronunciation`];

export function StatsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { mode: modeParam } = useParams<{ mode: string }>();

  const validMode = modeParam && VALID_MODES.includes(modeParam as Mode);
  const mode = (validMode ? (modeParam as Mode) : `reading`) as Mode;
  const history =
    useLiveQuery(
      async () =>
        (await getHistory(mode, language)).filter(
          (r): r is typeof r & { completedAt: number } => typeof r.completedAt === `number`,
        ),
      [mode, language],
    ) ?? [];

  if (!validMode) {
    return (
      <div className="min-h-screen bg-green-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={() => void navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer mb-6 flex items-center gap-2"
          >
            <FaArrowLeft />
            <span>{t(`Home`)}</span>
          </Button>
          <p className="text-gray-500">{t(`Unknown mode.`)}</p>
        </div>
      </div>
    );
  }

  const color = MODE_COLORS[mode];
  const label = MODE_LABELS[mode];

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <BackHeader title={t(`{{label}} Stats`, { label: t(label) })} to={`/${mode}`} />
        <RatingOverTimeChart history={history} color={color} label={label} language={language} />
        <PointsPerDayChart history={history} color={color} label={label} language={language} />
        <OutcomesByDifficultyChart history={history} />
      </div>
    </div>
  );
}
