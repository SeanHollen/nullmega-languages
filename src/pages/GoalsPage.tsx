import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import type { Mode } from "../hooks/useAbility";
import { loadGoals, saveGoals, GOAL_MIN, GOAL_MAX } from "../utils/goals";
import { useLanguage } from "../contexts/LanguageContext";

const MODE_LABELS: Record<Mode, string> = {
  reading: `Reading`,
  listening: `Listening`,
  pronunciation: `Pronunciation`,
  writing: `Writing`,
};

const MODES: Mode[] = [`reading`, `listening`, `pronunciation`, `writing`];

export function GoalsPage() {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const goals = useLiveQuery(() => loadGoals(language), [language]);

  function update(mode: Mode, value: number) {
    if (!goals) return;
    void saveGoals(language, { ...goals, [mode]: value });
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader title={t(`Daily Goals`)} to="/" />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <p className="text-sm text-gray-500">
            {t(`How many exercises per category would you like to complete each day?`)}
          </p>
          {MODES.map((mode) => {
            let goalLabel: string;
            if (!goals) {
              goalLabel = `—`;
            } else if (goals[mode] === 0) {
              goalLabel = t(`Off`);
            } else {
              goalLabel = t(`{{count}} / day`, { count: goals[mode] });
            }
            return (
              <div key={mode} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{t(MODE_LABELS[mode])}</span>
                  <span className="text-sm font-semibold text-green-600">{goalLabel}</span>
                </div>
                <input
                  type="range"
                  min={GOAL_MIN}
                  max={GOAL_MAX}
                  value={goals?.[mode] ?? 0}
                  onChange={(e) => update(mode, parseInt(e.target.value, 10))}
                  className="w-full accent-green-600 cursor-pointer"
                  disabled={!goals}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{GOAL_MIN}</span>
                  <span>{GOAL_MAX}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
