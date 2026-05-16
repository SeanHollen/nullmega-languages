import { useState } from "react";
import type { Flashcard, FlashcardStatus } from "../../utils/flashcards";
import { patchFlashcard, updateFlashcardTags } from "../../utils/flashcards";

const DAY = 24 * 60 * 60 * 1000;
const ALL_STATUSES: FlashcardStatus[] = ["new", "learning", "scheduled", "dropped"];
const INTERVAL_DAYS = [1, 3, 7, 14, 30, 90, 180, 365];

function parseTags(input: string): string[] {
  return input
    .split(`,`)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

interface Props {
  card: Flashcard;
  onSave: () => void;
  onClose: () => void;
}

export function EditCardModal({ card, onSave, onClose }: Props) {
  const [source, setSource] = useState(card.source);
  const [translation, setTranslation] = useState(card.translation);
  const [status, setStatus] = useState<FlashcardStatus>(card.status);
  const currentDays = Math.round(card.currentInterval / DAY);
  const nearestDays = INTERVAL_DAYS.reduce((a, b) =>
    Math.abs(b - currentDays) < Math.abs(a - currentDays) ? b : a,
  );
  const [intervalDays, setIntervalDays] = useState(nearestDays);
  const [tags, setTags] = useState(card.tags.join(`, `));

  function save() {
    const trimmedSource = source.trim();
    const trimmedTranslation = translation.trim();
    const days = intervalDays;
    patchFlashcard(card.id, {
      ...(trimmedSource ? { source: trimmedSource } : {}),
      ...(trimmedTranslation ? { translation: trimmedTranslation } : {}),
      status,
      currentInterval: days * DAY,
    });
    updateFlashcardTags(card.id, parseTags(tags));
    onSave();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">{`Edit card`}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{`Source`}</label>
            <input
              autoFocus
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{`Translation`}</label>
            <input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{`Status`}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FlashcardStatus)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{`Current interval (days)`}</label>
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
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{`Tags`}</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={`tag1, tag2`}
              onKeyDown={(e) => {
                if (e.key === `Enter`) save();
                if (e.key === `Escape`) onClose();
              }}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition"
          >
            {`Cancel`}
          </button>
          <button
            onClick={save}
            className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 cursor-pointer transition"
          >
            {`Save`}
          </button>
        </div>
      </div>
    </div>
  );
}
