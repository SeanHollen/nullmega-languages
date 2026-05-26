import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../../utils/language";
import { flagFor } from "../../data/languageFlags";

interface Props {
  selected: string | null;
  onSelect: (language: string) => void;
}

export function LanguageGrid({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [customInput, setCustomInput] = useState(``);

  function submitCustom() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    setCustomInput(``);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang;
          return (
            <button
              key={lang}
              onClick={() => onSelect(lang)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition cursor-pointer ${
                isSelected
                  ? `border-green-500 bg-green-50`
                  : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
              }`}
            >
              <span className="text-3xl">{flagFor(lang)}</span>
              <span className="text-sm font-medium text-gray-700">{lang}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === `Enter`) submitCustom();
          }}
          placeholder={t(`Other (type a language)`)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={submitCustom}
          disabled={!customInput.trim()}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {t(`Add`)}
        </button>
      </div>
      {selected && (
        <p className="text-sm text-gray-500 text-center">
          {t(`Selected:`)}
          {` `}
          <span className="font-semibold text-gray-700">
            {flagFor(selected)} {selected}
          </span>
        </p>
      )}
    </div>
  );
}
