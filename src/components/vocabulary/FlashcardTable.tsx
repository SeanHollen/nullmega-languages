import { useRef, useState } from "react";
import { FaPlus, FaFileImport, FaFileExport, FaPen } from "react-icons/fa";
import type { Flashcard, FlashcardStatusDerived } from "../../utils/flashcards";
import {
  updateFlashcardTags,
  computeStatus,
  addFlashcard,
  removeFlashcard,
  exportFlashcards,
  importFlashcards,
} from "../../utils/flashcards";
import { EditCardModal } from "./EditCardModal";

const STATUS_STYLES: Record<FlashcardStatusDerived, string> = {
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

interface Props {
  cards: Flashcard[];
  language: string;
  onRefresh: () => void;
}

export function FlashcardTable({ cards, language, onRefresh }: Props) {
  const [search, setSearch] = useState(``);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newSource, setNewSource] = useState(``);
  const [newTranslation, setNewTranslation] = useState(``);
  const [newTags, setNewTags] = useState(``);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAddCard() {
    const source = newSource.trim();
    const translation = newTranslation.trim();
    if (!source || !translation) return;
    const card = addFlashcard(language, source, translation);
    if (card) {
      const tags = parseTags(newTags);
      if (tags.length > 0) updateFlashcardTags(card.id, tags);
      setActionMessage(`Added "${source}"`);
    } else {
      setActionMessage(`"${source}" already exists`);
    }
    setNewSource(``);
    setNewTranslation(``);
    setNewTags(``);
    setAddingCard(false);
    onRefresh();
  }

  function handleExport() {
    const json = exportFlashcards(language);
    const blob = new Blob([json], { type: `application/json` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement(`a`);
    const slug = language.toLowerCase().replace(/[^a-z0-9]+/g, `-`);
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `flashcards-${slug}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMessage(`Exported ${cards.length} card${cards.length === 1 ? `` : `s`}`);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ``;
    if (!file) return;
    file
      .text()
      .then((json) => {
        try {
          const { added, skipped } = importFlashcards(language, json);
          setActionMessage(
            `Imported ${added} card${added === 1 ? `` : `s`}${skipped > 0 ? ` (skipped ${skipped})` : ``}`,
          );
          onRefresh();
        } catch (err) {
          setActionMessage(`Import failed: ${String(err)}`);
        }
      })
      .catch((err) => setActionMessage(`Read failed: ${String(err)}`));
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? cards.filter(
        (c) =>
          c.source.toLowerCase().includes(q) ||
          c.translation.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : cards;

  return (
    <>
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={() => {
            setEditingCard(null);
            onRefresh();
          }}
          onClose={() => setEditingCard(null)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => {
            setAddingCard((p) => !p);
            setActionMessage(null);
          }}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer"
        >
          <FaPlus className="text-xs" />
          {addingCard ? `Cancel` : `Card`}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title={`Import cards from JSON`}
          className="bg-white border border-gray-200 text-gray-500 p-2 rounded-lg hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
        >
          <FaFileImport />
        </button>
        <button
          onClick={handleExport}
          disabled={cards.length === 0}
          title={`Export cards to JSON`}
          className="bg-white border border-gray-200 text-gray-500 p-2 rounded-lg hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          <FaFileExport />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />
        {actionMessage && <span className="text-xs text-gray-500 ml-2">{actionMessage}</span>}
      </div>

      {addingCard && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              autoFocus
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder={`Source (${language})`}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              value={newTranslation}
              onChange={(e) => setNewTranslation(e.target.value)}
              placeholder={`English translation`}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === `Enter`) handleAddCard();
              if (e.key === `Escape`) {
                setAddingCard(false);
                setNewSource(``);
                setNewTranslation(``);
                setNewTags(``);
              }
            }}
            placeholder={`Tags (comma-separated, optional)`}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAddingCard(false);
                setNewSource(``);
                setNewTranslation(``);
                setNewTags(``);
              }}
              className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition"
            >
              {`Cancel`}
            </button>
            <button
              onClick={handleAddCard}
              disabled={!newSource.trim() || !newTranslation.trim()}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {`Add card`}
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-500">
            {`No flashcards yet. Save words from any exercise, click + Card above, or import from JSON.`}
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">
                      {`No matches for "${search}"`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const status = computeStatus(c);
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
                          <span className="flex flex-wrap gap-1">
                            {c.tags.length === 0 ? (
                              <span className="text-gray-300">{`—`}</span>
                            ) : (
                              c.tags.map((t) => (
                                <span
                                  key={t}
                                  className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                >
                                  {t}
                                </span>
                              ))
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {relativeTime(c.addedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingCard(c)}
                              className="text-gray-300 hover:text-blue-400 transition cursor-pointer"
                              title={`Edit card`}
                            >
                              <FaPen className="text-xs" />
                            </button>
                            <button
                              onClick={() => {
                                removeFlashcard(language, c.source);
                                onRefresh();
                              }}
                              className="text-gray-300 hover:text-red-400 transition cursor-pointer"
                              title={`Delete card`}
                            >
                              ✕
                            </button>
                          </div>
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
    </>
  );
}
