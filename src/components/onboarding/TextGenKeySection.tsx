import { useState } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function TextGenKeySection({ value, onChange }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [touched, setTouched] = useState(false);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">{`Text Generation`}</h2>
      <p className="text-sm text-gray-400 mb-4">
        {`Enter your OpenAI API key to call the model directly (BYOK). Leave blank to route through the backend.`}
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{`Provider`}</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
            <option>{`OpenAI`}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{`API Key`}</label>
          <input
            type={showKey ? `text` : `password`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={`sk-…`}
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showKey}
                onChange={(e) => setShowKey(e.target.checked)}
                className="accent-green-500 cursor-pointer"
              />
              <span className="text-xs text-gray-500">{`Show key`}</span>
            </label>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(``);
                  setTouched(false);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                {`Clear`}
              </button>
            )}
          </div>
          {touched && value && !value.startsWith(`sk-`) && (
            <p className="text-xs text-red-500 mt-1">{`Key should start with "sk-"`}</p>
          )}
        </div>
      </div>
    </section>
  );
}
