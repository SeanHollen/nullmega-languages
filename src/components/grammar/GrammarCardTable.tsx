import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaFileImport, FaFileExport } from "react-icons/fa";
import type { GrammarCard, GrammarCardStatusDerived } from "../../utils/grammarCards";
import {
  computeGrammarStatus,
  removeGrammarCard,
  exportGrammarCards,
  importGrammarCards,
} from "../../utils/grammarCards";
import { relativeTime } from "../../utils/relativeTime";
import { SortableHeader, type SortDir } from "../SortableHeader";
import { ConfirmModal } from "../ConfirmModal";

const STATUS_STYLES: Record<GrammarCardStatusDerived, string> = {
  new: `bg-gray-100 text-gray-600`,
  learning: `bg-yellow-100 text-yellow-700`,
  relearning: `bg-red-100 text-red-700`,
  scheduled: `bg-blue-100 text-blue-700`,
  due: `bg-orange-100 text-orange-700`,
  dropped: `bg-gray-100 text-gray-400 line-through`,
};

const STATUS_ORDER: Record<GrammarCardStatusDerived, number> = {
  due: 0,
  relearning: 1,
  learning: 2,
  new: 3,
  scheduled: 4,
  dropped: 5,
};

const LEVEL_LABELS: Record<number, string> = {
  10: `Absolute Beginner`,
  20: `Beginner`,
  30: `Beginner+`,
  40: `Elementary`,
  50: `Lower Intermediate`,
  60: `Intermediate`,
  70: `Upper Intermediate`,
  80: `Advanced`,
  90: `Proficient`,
  100: `Expert`,
};

function formatInterval(ms: number): string {
  if (ms === 0) return `—`;
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return `<1d`;
  return `${days}d`;
}

const PAGE_SIZE = 1000;

type SortCol = "title" | "tags" | "level" | "questions" | "status" | "lastReviewed" | "interval";

function sortCards(cards: GrammarCard[], col: SortCol, dir: SortDir): GrammarCard[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "tags":
        cmp = (a.tags[0] ?? ``).localeCompare(b.tags[0] ?? ``);
        break;
      case "level":
        cmp = a.level - b.level;
        break;
      case "questions":
        cmp = a.questions.length - b.questions.length;
        break;
      case "status":
        cmp = STATUS_ORDER[computeGrammarStatus(a)] - STATUS_ORDER[computeGrammarStatus(b)];
        break;
      case "lastReviewed":
        cmp = (a.lastReviewed ?? 0) - (b.lastReviewed ?? 0);
        break;
      case "interval":
        cmp = a.currentInterval - b.currentInterval;
        break;
    }
    return cmp * sign;
  });
}

interface Props {
  cards: GrammarCard[];
  language: string;
}

export function GrammarCardTable({ cards, language }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(``);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
  const [page, setPage] = useState(0);
  const [trackedPageKey, setTrackedPageKey] = useState(``);
  const [pendingDelete, setPendingDelete] = useState<GrammarCard | null>(null);
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

  function handleExport() {
    void (async () => {
      const json = await exportGrammarCards(language);
      const blob = new Blob([json], { type: `application/json` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement(`a`);
      const slug = language.toLowerCase().replace(/[^a-z0-9]+/g, `-`);
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `grammar-${slug}-${date}.json`;
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
      const { added, skipped } = await importGrammarCards(language, json);
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
          c.title.toLowerCase().includes(q) ||
          c.prompt.toLowerCase().includes(q) ||
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
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          to={`/grammar/stats`}
          className="ml-auto text-[0.8125rem] text-green-600 hover:text-green-700 font-medium"
        >
          {t(`View stats →`)}
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-500">
            {t(
              `No grammar cards yet. Click "Learn new cards" to generate your first set, or import from JSON.`,
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
              placeholder={t(`Search title, prompt, or tags…`)}
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
                  {th("title", t(`Title`))}
                  {th("tags", t(`Tags`))}
                  {th("level", t(`Level`))}
                  {th("questions", t(`Questions`))}
                  {th("status", t(`Status`))}
                  {th("lastReviewed", t(`Last reviewed`))}
                  {th("interval", t(`Interval`))}
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
                    const status = computeGrammarStatus(c);
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {LEVEL_LABELS[c.level]
                            ? t(LEVEL_LABELS[c.level])
                            : t(`L{{level}}`, { level: c.level })}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.questions.length}</td>
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
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setPendingDelete(c)}
                            className="text-gray-300 hover:text-red-400 transition cursor-pointer"
                            title={t(`Delete card`)}
                          >
                            ✕
                          </button>
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
          pendingDelete ? t(`Permanently delete "{{title}}"?`, { title: pendingDelete.title }) : ``
        }
        confirmLabel={t(`Delete`)}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeGrammarCard(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
