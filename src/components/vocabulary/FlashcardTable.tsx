import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaPlus, FaFileImport, FaFileExport, FaPen } from "react-icons/fa";
import {
  updateFlashcardTags,
  computeStatus,
  addFlashcard,
  removeFlashcard,
  exportFlashcards,
  importFlashcards,
} from "../../utils/flashcards";
import type { Flashcard, FlashcardStatusDerived } from "../../utils/flashcards";
import { relativeTime } from "../../utils/relativeTime";
import { SortableHeader, type SortDir } from "../SortableHeader";
import { EditCardModal } from "./EditCardModal";
import { ConfirmModal } from "../ConfirmModal";

const STATUS_STYLES: Record<FlashcardStatusDerived, string> = {
  new: `bg-gray-100 text-gray-600`,
  learning: `bg-yellow-100 text-yellow-700`,
  relearning: `bg-red-100 text-red-700`,
  scheduled: `bg-blue-100 text-blue-700`,
  due: `bg-orange-100 text-orange-700`,
  dropped: `bg-gray-100 text-gray-400 line-through`,
};

const STATUS_ORDER: Record<FlashcardStatusDerived, number> = {
  due: 0,
  relearning: 1,
  learning: 2,
  new: 3,
  scheduled: 4,
  dropped: 5,
};

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
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

const PAGE_SIZE = 1000;

type SortCol =
  | "source"
  | "translation"
  | "status"
  | "lastReviewed"
  | "interval"
  | "tags"
  | "addedAt";

function sortCards(cards: Flashcard[], col: SortCol, dir: SortDir): Flashcard[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "source":
        cmp = a.source.localeCompare(b.source);
        break;
      case "translation":
        cmp = a.translation.localeCompare(b.translation);
        break;
      case "status":
        cmp = STATUS_ORDER[computeStatus(a)] - STATUS_ORDER[computeStatus(b)];
        break;
      case "lastReviewed":
        cmp = (a.lastReviewed ?? 0) - (b.lastReviewed ?? 0);
        break;
      case "interval":
        cmp = a.currentInterval - b.currentInterval;
        break;
      case "tags":
        cmp = a.tags.length - b.tags.length;
        break;
      case "addedAt":
        cmp = a.addedAt - b.addedAt;
        break;
    }
    return cmp * sign;
  });
}

interface Props {
  cards: Flashcard[];
  language: string;
}

export function FlashcardTable({ cards, language }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(``);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Flashcard | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newSource, setNewSource] = useState(``);
  const [newTranslation, setNewTranslation] = useState(``);
  const [newTags, setNewTags] = useState(``);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
  const [page, setPage] = useState(0);
  const [trackedPageKey, setTrackedPageKey] = useState(``);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSort(col: SortCol) {
    setSort((prev) =>
      prev?.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" },
    );
  }

  function th(col: SortCol, label: string) {
    return (
      <SortableHeader
        label={label}
        active={sort?.col === col}
        dir={sort?.col === col ? sort.dir : "asc"}
        onClick={() => handleSort(col)}
      />
    );
  }

  function handleAddCard() {
    const source = newSource.trim();
    const translation = newTranslation.trim();
    if (!source || !translation) return;
    void (async () => {
      const card = await addFlashcard(language, source, translation);
      if (card) {
        const tags = parseTags(newTags);
        if (tags.length > 0) await updateFlashcardTags(card.id, tags);
        setActionMessage(t(`Added "{{source}}"`, { source }));
      } else {
        setActionMessage(t(`"{{source}}" already exists`, { source }));
      }
      setNewSource(``);
      setNewTranslation(``);
      setNewTags(``);
      setAddingCard(false);
    })();
  }

  function handleExport() {
    void (async () => {
      const json = await exportFlashcards(language);
      const blob = new Blob([json], { type: `application/json` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement(`a`);
      const slug = language.toLowerCase().replace(/[^a-z0-9]+/g, `-`);
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `flashcards-${slug}-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage(
        cards.length === 1
          ? t(`Exported {{count}} card`, { count: cards.length })
          : t(`Exported {{count}} cards`, { count: cards.length }),
      );
    })();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ``;
    if (!file) return;
    let json: string;
    try {
      json = await file.text();
    } catch (err) {
      setActionMessage(t(`Read failed: {{error}}`, { error: String(err) }));
      return;
    }
    try {
      const { added, skipped } = await importFlashcards(language, json);
      const base =
        added === 1
          ? t(`Imported {{count}} card`, { count: added })
          : t(`Imported {{count}} cards`, { count: added });
      setActionMessage(skipped > 0 ? `${base} ${t(`(skipped {{skipped}})`, { skipped })}` : base);
    } catch (err) {
      setActionMessage(t(`Import failed: {{error}}`, { error: String(err) }));
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? cards.filter(
        (c) =>
          c.source.toLowerCase().includes(q) ||
          c.translation.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    : cards;

  const sorted = sort ? sortCards(filtered, sort.col, sort.dir) : filtered;

  const pageKey = `${q}|${sort?.col ?? ``}|${sort?.dir ?? ``}`;
  if (pageKey !== trackedPageKey) {
    setTrackedPageKey(pageKey);
    setPage(0);
  }
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total);
  const paginated = sorted.slice(pageStart, pageEnd);

  let showingLabel: string;
  if (total === 0) {
    showingLabel = t(`No matches`);
  } else if (q) {
    showingLabel = t(`Showing {{start}}–{{end}} of {{total}} (filtered from {{all}})`, {
      start: pageStart + 1,
      end: pageEnd,
      total,
      all: cards.length,
    });
  } else {
    showingLabel = t(`Showing {{start}}–{{end}} of {{total}}`, {
      start: pageStart + 1,
      end: pageEnd,
      total,
    });
  }

  return (
    <>
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={() => {
            setEditingCard(null);
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
          {addingCard ? t(`Cancel`) : t(`Card`)}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title={t(`Import cards from JSON`)}
          className="bg-white border border-gray-200 text-gray-500 p-2 rounded-lg hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
        >
          <FaFileImport />
        </button>
        <button
          onClick={handleExport}
          disabled={cards.length === 0}
          title={t(`Export cards to JSON`)}
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
        <Link
          to={`/vocabulary/stats`}
          className="ml-auto text-[0.8125rem] text-green-600 hover:text-green-700 font-medium"
        >
          {t(`View stats →`)}
        </Link>
      </div>

      {addingCard && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              autoFocus
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder={t(`Source ({{language}})`, { language })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              value={newTranslation}
              onChange={(e) => setNewTranslation(e.target.value)}
              placeholder={t(`English translation`)}
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
            placeholder={t(`Tags (comma-separated, optional)`)}
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
              {t(`Cancel`)}
            </button>
            <button
              onClick={handleAddCard}
              disabled={!newSource.trim() || !newTranslation.trim()}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {t(`Add card`)}
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-500">
            {t(
              `No flashcards yet. Save words from any exercise, click + Card above, or import from JSON.`,
            )}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(`Search source, translation, or tags…`)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            <span>{showingLabel}</span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={clampedPage === 0}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
                >
                  {t(`Prev`)}
                </button>
                <span>
                  {t(`Page {{page}} of {{pages}}`, {
                    page: clampedPage + 1,
                    pages: pageCount,
                  })}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={clampedPage >= pageCount - 1}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
                >
                  {t(`Next`)}
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500">
                <tr className="text-left">
                  {th("source", t(`Source`))}
                  {th("translation", t(`Translation`))}
                  {th("status", t(`Status`))}
                  {th("lastReviewed", t(`Last reviewed`))}
                  {th("interval", t(`Interval`))}
                  {th("tags", t(`Tags`))}
                  {th("addedAt", t(`Added`))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">
                      {t(`No matches for "{{search}}"`, { search })}
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => {
                    const status = computeStatus(c);
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.source}</td>
                        <td className="px-4 py-3 text-gray-600 italic">{c.translation}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
                          >
                            {t(status)}
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
                              c.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                >
                                  {tag}
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
                              title={t(`Edit card`)}
                            >
                              <FaPen className="text-xs" />
                            </button>
                            <button
                              onClick={() => setPendingDelete(c)}
                              className="text-gray-300 hover:text-red-400 transition cursor-pointer"
                              title={t(`Delete card`)}
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
      <ConfirmModal
        open={pendingDelete !== null}
        title={t(`Delete card?`)}
        body={
          pendingDelete
            ? t(`Permanently delete "{{source}}"?`, { source: pendingDelete.source })
            : ``
        }
        confirmLabel={t(`Delete`)}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeFlashcard(language, pendingDelete.source);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
