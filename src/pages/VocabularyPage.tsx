import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import {
  loadFlashcards,
  updateFlashcardTags,
  computeStatus,
  Flashcard,
  FlashcardStatus,
} from "../utils/flashcards";

const STATUS_STYLES: Record<FlashcardStatus, string> = {
  new: `bg-gray-100 text-gray-600`,
  learning: `bg-yellow-100 text-yellow-700`,
  scheduled: `bg-blue-100 text-blue-700`,
  due: `bg-orange-100 text-orange-700`,
  dropped: `bg-gray-100 text-gray-400 line-through`,
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
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / (60 * 60_000))}h`;
  return `${Math.round(ms / (24 * 60 * 60_000))}d`;
}

function parseTags(input: string): string[] {
  return input
    .split(`,`)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function VocabularyPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [cards, setCards] = useState<Flashcard[]>(() =>
    loadFlashcards(language).sort((a, b) => b.addedAt - a.addedAt),
  );
  const [search, setSearch] = useState(``);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState(``);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? cards.filter(
        (c) =>
          c.source.toLowerCase().includes(q) ||
          c.translation.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : cards;

  function startEdit(c: Flashcard) {
    setEditingId(c.id);
    setTagInput(c.tags.join(`, `));
  }

  function saveEdit() {
    if (editingId === null) return;
    const tags = parseTags(tagInput);
    updateFlashcardTags(editingId, tags);
    setCards(loadFlashcards(language).sort((a, b) => b.addedAt - a.addedAt));
    setEditingId(null);
    setTagInput(``);
  }

  function cancelEdit() {
    setEditingId(null);
    setTagInput(``);
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate(`/`)}
              className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{`Vocabulary`}</h1>
            <span className="text-sm text-gray-400">{`— ${language}`}</span>
          </div>
          {cards.length > 0 && (
            <button
              onClick={() => navigate(`/practice`)}
              className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-green-700 transition cursor-pointer whitespace-nowrap"
            >
              {`Practice →`}
            </button>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {`No flashcards yet. Save words and phrases from any exercise's results page.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search source, translation, or tags…`}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">{`Source`}</th>
                    <th className="px-4 py-3">{`Translation`}</th>
                    <th className="px-4 py-3">{`Status`}</th>
                    <th className="px-4 py-3">{`Last reviewed`}</th>
                    <th className="px-4 py-3">{`Interval`}</th>
                    <th className="px-4 py-3">{`Tags`}</th>
                    <th className="px-4 py-3">{`Added`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                        {`No matches for "${search}"`}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => {
                      const status = computeStatus(c);
                      const isEditing = editingId === c.id;
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-medium text-gray-800">{c.source}</td>
                          <td className="px-4 py-3 text-gray-600 italic">{c.translation}</td>
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
                          <td className="px-4 py-3 text-xs">
                            {isEditing ? (
                              <input
                                autoFocus
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={(e) => {
                                  if (e.key === `Enter`) saveEdit();
                                  if (e.key === `Escape`) cancelEdit();
                                }}
                                placeholder={`tag1, tag2`}
                                className="w-32 text-xs border border-green-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            ) : (
                              <button
                                onClick={() => startEdit(c)}
                                className="text-left cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 transition"
                                title={`Click to edit tags`}
                              >
                                {c.tags.length === 0 ? (
                                  <span className="text-gray-300">{`+ add`}</span>
                                ) : (
                                  <span className="flex flex-wrap gap-1">
                                    {c.tags.map((t) => (
                                      <span
                                        key={t}
                                        className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {relativeTime(c.addedAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
