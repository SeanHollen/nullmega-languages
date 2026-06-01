import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { UsageByDayChart } from "../components/stats/UsageByDayChart";
import { loadAllUsage, USAGE_CATEGORIES, type UsageCategory } from "../utils/apiUsage";

const CATEGORY_LABEL_KEY: Record<UsageCategory, string> = {
  reading: `Reading`,
  listening: `Listening`,
  writing: `Writing`,
  pronunciation: `Pronunciation`,
  vocabulary: `Vocabulary`,
  grammar: `Grammar`,
};

function formatUsd(value: number): string {
  if (value === 0) return `$0`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

export function ApiUsageStatsPage() {
  const { t } = useTranslation();
  const rows = useLiveQuery(() => loadAllUsage(), []) ?? [];

  const totalsByCategory = Object.fromEntries(USAGE_CATEGORIES.map((c) => [c, 0])) as Record<
    UsageCategory,
    number
  >;
  let totalCost = 0;
  let totalCalls = 0;
  for (const r of rows) {
    totalsByCategory[r.category] += r.costUsd;
    totalCost += r.costUsd;
    totalCalls++;
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <BackHeader title={t(`API usage`)} to="/settings" />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-500">{t(`Lifetime totals (BYOK only)`)}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-gray-500">{t(`Total spend`)}</span>
              <span className="font-semibold text-gray-800">{formatUsd(totalCost)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-gray-500">{t(`Calls`)}</span>
              <span className="font-semibold text-gray-800">{totalCalls}</span>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {USAGE_CATEGORIES.map((c) => (
              <div key={c} className="flex items-baseline justify-between">
                <span className="text-gray-500">{t(CATEGORY_LABEL_KEY[c])}</span>
                <span className="font-medium text-gray-700">{formatUsd(totalsByCategory[c])}</span>
              </div>
            ))}
          </div>
        </div>

        <UsageByDayChart rows={rows} />
      </div>
    </div>
  );
}
