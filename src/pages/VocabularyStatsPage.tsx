import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLanguage } from "../contexts/LanguageContext";
import { loadFlashcards, computeStatus } from "../utils/flashcards";
import { SrsStatsView } from "../components/stats/SrsStatsView";
import { BackHeader } from "../components/BackHeader";

export function VocabularyStatsPage() {
  const { language } = useLanguage();
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState(``);

  const raw = useLiveQuery(() => loadFlashcards(language), [language]) ?? [];

  const allTags = [...new Set(raw.flatMap((c) => c.tags))].sort();

  // Cards must match every entered tag (AND semantics) — adding more tags narrows.
  const normalizedTags = tags.map((t) => t.toLowerCase());
  const filtered =
    normalizedTags.length === 0
      ? raw
      : raw.filter((c) => {
          const cardTags = c.tags.map((t) => t.toLowerCase());
          return normalizedTags.every((t) => cardTags.includes(t));
        });

  const cards = filtered.map((c) => ({
    status: computeStatus(c),
    lastReviewed: c.lastReviewed,
    currentInterval: c.currentInterval,
    addedAt: c.addedAt,
    reviewHistory: c.reviewHistory,
  }));

  function commitDraft() {
    const t = draft.trim();
    if (!t) return;
    if (!tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
      setTags([...tags, t]);
    }
    setDraft(``);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === `Enter` || e.key === `,`) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === `Backspace` && draft === `` && tags.length > 0) {
      // Pop the last chip when backspacing into an empty input.
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <BackHeader title="Vocabulary Stats" to="/vocabulary" />
        <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
          <label htmlFor="tag-filter" className="text-gray-600">
            {`Filter by tag:`}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap bg-white border border-gray-200 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-green-200">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-md px-2 py-0.5 text-xs font-medium"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-green-600 hover:text-green-800 cursor-pointer"
                  aria-label={`Remove ${tag}`}
                >
                  {`×`}
                </button>
              </span>
            ))}
            <input
              id="tag-filter"
              type="text"
              list="tag-filter-options"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitDraft}
              placeholder={tags.length === 0 ? `type tags` : ``}
              className="flex-1 min-w-[6rem] outline-none text-gray-700 py-0.5"
            />
          </div>
          <datalist id="tag-filter-options">
            {allTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          {tags.length > 0 && (
            <button
              onClick={() => {
                setTags([]);
                setDraft(``);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              {`Clear`}
            </button>
          )}
        </div>
        <SrsStatsView cards={cards} emptyMessage={`No flashcards yet for ${language}.`} />
      </div>
    </div>
  );
}
