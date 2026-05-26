import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { BackHeader } from "../BackHeader";
import { SrsStatsView } from "./SrsStatsView";
import type { SrsCard } from "../../utils/srs";
import { computeSrsStatus } from "../../utils/srs";

interface Props {
  title: string;
  backTo: string;
  loadCards: (language: string) => Promise<SrsCard[]>;
  emptyMessage: (language: string) => string;
}

export function SrsStatsPageShell({ title, backTo, loadCards, emptyMessage }: Props) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState(``);

  const raw = useLiveQuery(() => loadCards(language), [language, loadCards]) ?? [];

  const allTags = [...new Set(raw.flatMap((c) => c.tags))].sort();

  // AND semantics — adding more tags narrows the result.
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const filtered =
    normalizedTags.length === 0
      ? raw
      : raw.filter((c) => {
          const cardTags = c.tags.map((tag) => tag.toLowerCase());
          return normalizedTags.every((tag) => cardTags.includes(tag));
        });

  const cards = filtered.map((c) => ({
    status: computeSrsStatus(c),
    lastReviewed: c.lastReviewed,
    currentInterval: c.currentInterval,
    addedAt: c.addedAt,
    reviewHistory: c.reviewHistory,
  }));

  function commitDraft() {
    const tag = draft.trim();
    if (!tag) return;
    if (!tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setTags([...tags, tag]);
    }
    setDraft(``);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((existing) => existing !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === `Enter` || e.key === `,`) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === `Backspace` && draft === `` && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <BackHeader title={title} to={backTo} />
        <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
          <label htmlFor="tag-filter" className="text-gray-600">
            {t(`Filter by tag:`)}
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
                  aria-label={t(`Remove {{tag}}`, { tag })}
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
              placeholder={tags.length === 0 ? t(`tag1 tag2`) : ``}
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
              {t(`Clear`)}
            </button>
          )}
        </div>
        <SrsStatsView cards={cards} emptyMessage={emptyMessage(language)} />
      </div>
    </div>
  );
}
