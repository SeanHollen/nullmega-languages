import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaCog } from "react-icons/fa";
import { LANGUAGES, getCustomLanguages, addCustomLanguage } from "../utils/language";
import { useLanguage } from "../contexts/LanguageContext";

const OTHER = `__other__`;

export function LanguageBanner() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [customLanguages, setCustomLanguages] = useState(getCustomLanguages);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState(``);
  const inputRef = useRef<HTMLInputElement>(null);

  const allLanguages = [...LANGUAGES, ...customLanguages.filter((l) => !LANGUAGES.includes(l))];

  function applyLanguage(lang: string) {
    setLanguage(lang);
    navigate(`/`);
  }

  function handleSelectChange(value: string) {
    if (value === OTHER) {
      setAddingCustom(true);
      setCustomInput(``);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    applyLanguage(value);
  }

  function handleAddCustom() {
    const lang = customInput.trim();
    if (!lang) return;
    const updated = addCustomLanguage(lang);
    setCustomLanguages(updated);
    setCustomInput(``);
    setAddingCustom(false);
    applyLanguage(lang);
  }

  function handleCancelCustom() {
    setAddingCustom(false);
    setCustomInput(``);
  }

  return (
    <header className="bg-green-600 sticky top-0 z-10 shadow-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-center gap-3 sm:gap-8">
        {addingCustom ? (
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === `Enter`) handleAddCustom();
                if (e.key === `Escape`) handleCancelCustom();
              }}
              placeholder={`Enter a language…`}
              className="flex-1 border border-green-700 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <button
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="px-3 py-1.5 bg-white text-green-700 rounded-lg text-sm font-semibold hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {`Add`}
            </button>
            <button
              onClick={handleCancelCustom}
              className="px-3 py-1.5 border border-green-300 text-white rounded-lg text-sm font-medium hover:bg-white/10 cursor-pointer transition"
            >
              {`Cancel`}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline text-sm font-medium text-white">{`Language:`}</span>
            <select
              value={language}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="border border-green-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-300 font-medium"
            >
              {allLanguages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option disabled value="">{`──────────`}</option>
              <option value={OTHER}>{`Other…`}</option>
            </select>
          </div>
        )}

        <button
          onClick={() => navigate(`/settings`)}
          className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-white hover:bg-white/10 transition cursor-pointer text-sm font-medium whitespace-nowrap shrink-0"
          title={`Configure AI provider keys`}
        >
          <FaCog />
          <span className="hidden sm:inline">{`AI provider`}</span>
        </button>
      </div>
    </header>
  );
}
