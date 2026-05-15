import { useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import {
  VocabSettings,
  NEW_WORDS_PER_DAY_MIN,
  NEW_WORDS_PER_DAY_MAX,
  CONTEXTS_PER_CARD_MIN,
  CONTEXTS_PER_CARD_MAX,
} from "../../utils/vocabSettings";

interface Props {
  settings: VocabSettings;
  onUpdate: (patch: Partial<VocabSettings>) => void;
}

export function VocabSettingsPanel({ settings, onUpdate }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
      >
        {open ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
        <span>{`Settings`}</span>
      </button>
      {open && (
        <div className="px-6 py-4 border-t border-gray-100 flex gap-32 text-sm">
          <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-3 items-center">
            <span className="text-gray-600">{`New words per day`}</span>
            <input
              type="number"
              min={NEW_WORDS_PER_DAY_MIN}
              max={NEW_WORDS_PER_DAY_MAX}
              value={settings.newWordsPerDay}
              onChange={(e) => onUpdate({ newWordsPerDay: parseInt(e.target.value, 10) || 1 })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-16 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <span className="text-gray-600">{`New word selection order`}</span>
            <select
              value={settings.order}
              onChange={(e) => onUpdate({ order: e.target.value === `added` ? `added` : `random` })}
              className="border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="random">{`Random`}</option>
              <option value="added">{`Order added`}</option>
            </select>
            <span className="text-gray-600">{`Contexts per card`}</span>
            <input
              type="number"
              min={CONTEXTS_PER_CARD_MIN}
              max={CONTEXTS_PER_CARD_MAX}
              value={settings.contextsPerCard}
              onChange={(e) => onUpdate({ contextsPerCard: parseInt(e.target.value, 10) || 1 })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-16 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showText}
                onChange={(e) => onUpdate({ showText: e.target.checked })}
                className="accent-green-600 cursor-pointer"
              />
              <span className="text-gray-600">{`Show text`}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.generateAudio}
                onChange={(e) => onUpdate({ generateAudio: e.target.checked })}
                className="accent-green-600 cursor-pointer"
              />
              <span className="text-gray-600">{`Generate audio`}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.autoplayAudio}
                onChange={(e) => onUpdate({ autoplayAudio: e.target.checked })}
                className="accent-green-600 cursor-pointer"
              />
              <span className="text-gray-600">{`Autoplay audio`}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
