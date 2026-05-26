import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import type { VocabSettings } from "../../utils/vocabSettings";
import {
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-4 pb-1 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {t(`Settings`)}
          </p>
        </div>
        <div className="px-6 py-3 flex items-center justify-center gap-3 text-sm">
          <span className="text-gray-600">{t(`New words per day`)}</span>
          <input
            type="number"
            min={NEW_WORDS_PER_DAY_MIN}
            max={NEW_WORDS_PER_DAY_MAX}
            value={settings.newWordsPerDay}
            onChange={(e) => onUpdate({ newWordsPerDay: parseInt(e.target.value, 10) || 1 })}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={() => setOpen((p) => !p)}
          className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer"
        >
          {open ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
          <span>{t(`Advanced`)}</span>
        </button>
        {open && (
          <div className="px-6 pb-4 flex justify-center text-sm">
            <div className="flex flex-col gap-3 items-start">
              <div className="flex items-center gap-3">
                <span className="text-gray-600">{t(`New word selection order`)}</span>
                <select
                  value={settings.order}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === `first-added` || v === `latest-added` || v === `random`) {
                      onUpdate({ order: v });
                    }
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="random">{t(`Random`)}</option>
                  <option value="first-added">{t(`First added`)}</option>
                  <option value="latest-added">{t(`Latest added`)}</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-600">{t(`Contexts per card`)}</span>
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
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showText}
                  onChange={(e) => onUpdate({ showText: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">{t(`Show text by default`)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.generateAudio}
                  onChange={(e) => onUpdate({ generateAudio: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">{t(`Generate audio`)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.autoplayAudio}
                  onChange={(e) => onUpdate({ autoplayAudio: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">{t(`Autoplay audio if existing`)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showUpcomingBeforeLearning}
                  onChange={(e) => onUpdate({ showUpcomingBeforeLearning: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">{t(`Show upcoming before learning`)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showDueBeforeRelearning}
                  onChange={(e) => onUpdate({ showDueBeforeRelearning: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">{t(`Show due before relearning`)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.includeTranslationInContexts}
                  onChange={(e) => onUpdate({ includeTranslationInContexts: e.target.checked })}
                  className="accent-green-600 cursor-pointer"
                />
                <span className="text-gray-600">
                  {t(`Include translation in context generation`)}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
