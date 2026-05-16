import type { GrammarCard, GrammarCategory, GrammarCardStatus } from "../../utils/grammarCards";
import { computeGrammarStatus, removeGrammarCard } from "../../utils/grammarCards";

const CATEGORY_LABELS: Record<GrammarCategory, string> = {
  "tense-conjugation": `Tense`,
  "word-order": `Word Order`,
  "parts-of-speech": `Parts of Speech`,
  misc: `Misc`,
};

const CATEGORY_COLORS: Record<GrammarCategory, string> = {
  "tense-conjugation": `bg-blue-100 text-blue-700`,
  "word-order": `bg-purple-100 text-purple-700`,
  "parts-of-speech": `bg-green-100 text-green-700`,
  misc: `bg-gray-100 text-gray-600`,
};

const STATUS_STYLES: Record<GrammarCardStatus, string> = {
  new: `bg-gray-100 text-gray-600`,
  learning: `bg-yellow-100 text-yellow-700`,
  scheduled: `bg-blue-100 text-blue-700`,
  due: `bg-orange-100 text-orange-700`,
  dropped: `bg-gray-100 text-gray-400 line-through`,
};

const LEVEL_LABELS: Record<number, string> = {
  1: `Beginner`,
  2: `Elementary`,
  3: `Intermediate`,
  4: `Advanced`,
  5: `Expert`,
};

function relativeTime(ts: number | null): string {
  if (ts === null) return `Never`;
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

function formatInterval(ms: number): string {
  if (ms === 0) return `—`;
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return `<1d`;
  return `${days}d`;
}

interface Props {
  cards: GrammarCard[];
  onRefresh: () => void;
}

export function GrammarCardTable({ cards, onRefresh }: Props) {
  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <p className="text-gray-500">
          {`No grammar cards yet. Click "Learn new cards" to generate your first set.`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">{`Title`}</th>
              <th className="px-4 py-3">{`Category`}</th>
              <th className="px-4 py-3">{`Level`}</th>
              <th className="px-4 py-3">{`Questions`}</th>
              <th className="px-4 py-3">{`Status`}</th>
              <th className="px-4 py-3">{`Last reviewed`}</th>
              <th className="px-4 py-3">{`Interval`}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cards.map((c) => {
              const status = computeGrammarStatus(c);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[c.category]}`}
                    >
                      {CATEGORY_LABELS[c.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {LEVEL_LABELS[c.level] ?? `L${c.level}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.questions.length}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {relativeTime(c.lastReviewed)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatInterval(c.currentInterval)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        removeGrammarCard(c.id);
                        onRefresh();
                      }}
                      className="text-gray-300 hover:text-red-400 transition cursor-pointer"
                      title={`Delete card`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
