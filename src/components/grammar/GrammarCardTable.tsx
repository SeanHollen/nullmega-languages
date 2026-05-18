import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaFileImport, FaFileExport } from "react-icons/fa";
import type { GrammarCard, GrammarCategory, GrammarCardStatus } from "../../utils/grammarCards";
import {
  computeGrammarStatus,
  removeGrammarCard,
  exportGrammarCards,
  importGrammarCards,
} from "../../utils/grammarCards";
import { relativeTime } from "../../utils/relativeTime";
import { SortableHeader, type SortDir } from "../SortableHeader";

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

const STATUS_ORDER: Record<GrammarCardStatus, number> = {
  due: 0,
  learning: 1,
  new: 2,
  scheduled: 3,
  dropped: 4,
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

type SortCol =
  | "title"
  | "category"
  | "level"
  | "questions"
  | "status"
  | "lastReviewed"
  | "interval";

function sortCards(cards: GrammarCard[], col: SortCol, dir: SortDir): GrammarCard[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "category":
        cmp = a.category.localeCompare(b.category);
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
  const [search, setSearch] = useState(``);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir } | null>(null);
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
      setActionMessage(`Exported ${cards.length} card${cards.length === 1 ? `` : `s`}`);
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
      setActionMessage(`Read failed: ${String(err)}`);
      return;
    }
    try {
      const { added, skipped } = await importGrammarCards(language, json);
      setActionMessage(
        `Imported ${added} card${added === 1 ? `` : `s`}${skipped > 0 ? ` (skipped ${skipped})` : ``}`,
      );
    } catch (err) {
      setActionMessage(`Import failed: ${String(err)}`);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? cards.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.prompt.toLowerCase().includes(q) ||
          CATEGORY_LABELS[c.category].toLowerCase().includes(q),
      )
    : cards;

  const sorted = sort ? sortCards(filtered, sort.col, sort.dir) : filtered;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <Link
          to={`/grammar/stats`}
          className="ml-auto text-xs text-green-600 hover:text-green-700 font-medium"
        >
          {`View stats →`}
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-500">
            {`No grammar cards yet. Click "Learn new cards" to generate your first set, or import from JSON.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search title, prompt, or category…`}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500">
                <tr className="text-left">
                  {th("title", "Title")}
                  {th("category", "Category")}
                  {th("level", "Level")}
                  {th("questions", "Questions")}
                  {th("status", "Status")}
                  {th("lastReviewed", "Last reviewed")}
                  {th("interval", "Interval")}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">
                      {`No matches for "${search}"`}
                    </td>
                  </tr>
                ) : (
                  sorted.map((c) => {
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
                              void removeGrammarCard(c.id);
                            }}
                            className="text-gray-300 hover:text-red-400 transition cursor-pointer"
                            title={`Delete card`}
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
    </>
  );
}
