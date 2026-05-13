import { Mode } from "../hooks/useAbility";
import { getHistory } from "../utils/history";

interface Props {
  mode: Mode;
  language: string;
  limit?: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return `Just now`;
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function scoreColor(pct: number): string {
  if (pct >= 0.9) return `text-green-600`;
  if (pct >= 0.6) return `text-yellow-600`;
  return `text-red-500`;
}

export function HistoryList({ mode, language, limit = 10 }: Props) {
  const records = getHistory(mode, language).slice(0, limit);
  if (records.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{`Recent exercises`}</h3>
      <div className="divide-y divide-gray-50">
        {records.map((r) => {
          const pct = r.scoreMax > 0 ? r.scoreEarned / r.scoreMax : 0;
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700 truncate">{r.title || `Untitled`}</p>
                <p className="text-xs text-gray-400">{relativeTime(r.completedAt)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs shrink-0">
                <span className="text-gray-500">{`Difficulty ${r.difficulty}`}</span>
                <span className={`font-semibold ${scoreColor(pct)}`}>
                  {`${r.scoreEarned}/${r.scoreMax}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
