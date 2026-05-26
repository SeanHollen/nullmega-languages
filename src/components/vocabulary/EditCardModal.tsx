import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import type { Flashcard, FlashcardStatus } from "../../utils/flashcards";
import { patchFlashcard, updateFlashcardTags } from "../../utils/flashcards";
import { relativeTime } from "../../utils/relativeTime";

const DAY = 24 * 60 * 60 * 1000;
const ALL_STATUSES: FlashcardStatus[] = ["new", "learning", "scheduled", "dropped"];
const INTERVAL_DAYS = [1, 3, 7, 14, 30, 90, 180, 365];

function parseTags(input: string): string[] {
  return input
    .split(`,`)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

interface Props {
  card: Flashcard;
  onSave: () => void;
  onClose: () => void;
}

export function EditCardModal({ card, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [source, setSource] = useState(card.source);
  const [translation, setTranslation] = useState(card.translation);
  const [status, setStatus] = useState<FlashcardStatus>(card.status);
  const currentDays = Math.round(card.currentInterval / DAY);
  const nearestDays = INTERVAL_DAYS.reduce((a, b) =>
    Math.abs(b - currentDays) < Math.abs(a - currentDays) ? b : a,
  );
  const [intervalDays, setIntervalDays] = useState(nearestDays);
  const [tags, setTags] = useState(card.tags.join(`, `));
  const [detailsOpen, setDetailsOpen] = useState(false);

  function save() {
    const trimmedSource = source.trim();
    const trimmedTranslation = translation.trim();
    const days = intervalDays;
    void (async () => {
      await patchFlashcard(card.id, {
        ...(trimmedSource ? { source: trimmedSource } : {}),
        ...(trimmedTranslation ? { translation: trimmedTranslation } : {}),
        status,
        currentInterval: days * DAY,
      });
      await updateFlashcardTags(card.id, parseTags(tags));
      onSave();
    })();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-800">{t(`Edit card`)}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t(`Source`)}
            </label>
            <input
              autoFocus
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t(`Translation`)}
            </label>
            <input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {t(`Status`)}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FlashcardStatus)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {t(`Current interval (days)`)}
              </label>
              <select
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {INTERVAL_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t(`Tags`)}
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t(`tag1, tag2`)}
              onKeyDown={(e) => {
                if (e.key === `Enter`) save();
                if (e.key === `Escape`) onClose();
              }}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div>
          <button
            onClick={() => setDetailsOpen((p) => !p)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 text-sm font-medium text-gray-700 cursor-pointer transition"
          >
            <span>{t(`Card details`)}</span>
            {detailsOpen ? (
              <FaChevronDown className="text-gray-500 text-xs" />
            ) : (
              <FaChevronRight className="text-gray-500 text-xs" />
            )}
          </button>
          {detailsOpen && (
            <div className="mt-2">
              <DetailsBlock card={card} t={t} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition"
          >
            {t(`Cancel`)}
          </button>
          <button
            onClick={save}
            className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 cursor-pointer transition"
          >
            {t(`Save`)}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsBlock({ card, t }: { card: Flashcard; t: ReturnType<typeof useTranslation>["t"] }) {
  const reviews = card.reviewHistory ?? [];
  const correct = reviews.filter((r) => r.outcome === `correct`).length;
  const incorrect = reviews.length - correct;
  const accuracy = reviews.length > 0 ? `${Math.round((correct / reviews.length) * 100)}%` : `—`;
  const lastReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  const inRelearning = card.relearningStartedAt !== null;
  let contextsValue: string;
  if (card.contexts.length === 0) {
    contextsValue = t(`none`);
  } else if (card.dateContextGenerated) {
    contextsValue = `${card.contexts.length} · ${relativeTime(card.dateContextGenerated)}`;
  } else {
    contextsValue = `${card.contexts.length}`;
  }

  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 grid grid-cols-2 gap-x-4 gap-y-1.5">
      <Row label={t(`Language`)} value={card.language} />
      <Row label={t(`Added`)} value={relativeTime(card.addedAt)} />
      <Row label={t(`Last reviewed`)} value={relativeTime(card.lastReviewed)} />
      <Row
        label={t(`Reviews`)}
        value={t(`{{count}} ({{correct}} ✓ / {{incorrect}} ✗)`, {
          count: reviews.length,
          correct,
          incorrect,
        })}
      />
      <Row label={t(`Accuracy`)} value={accuracy} />
      <Row label={t(`Contexts`)} value={contextsValue} />
      {card.learningCorrectCount !== null && (
        <Row label={t(`Learning streak`)} value={String(card.learningCorrectCount)} />
      )}
      {inRelearning && (
        <Row label={t(`Relearning since`)} value={relativeTime(card.relearningStartedAt)} />
      )}
      {lastReview && (
        <Row
          label={t(`Last answer`)}
          value={`${t(lastReview.outcome)} · ${relativeTime(lastReview.timestamp)}`}
        />
      )}
      <Row label={t(`ID`)} value={<span className="font-mono text-[10px]">{card.id}</span>} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 truncate">{value}</span>
    </>
  );
}
