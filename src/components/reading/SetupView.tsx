import { FaExclamationTriangle } from "react-icons/fa";

interface Props {
  language: string;
  languageComplexity: number;
  rated: boolean;
  savedRating: number | null;
  error: string;
  generateLabel?: string;
  onLanguageComplexityChange: (d: number) => void;
  onRatedChange: (r: boolean) => void;
  onGenerate: () => void;
}

export function SetupView({
  language,
  languageComplexity,
  rated,
  savedRating,
  error,
  generateLabel = `Generate Passage`,
  onLanguageComplexityChange,
  onRatedChange,
  onGenerate,
}: Props) {
  const isUnratedLanguage = savedRating === null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {`Language complexity: `}
          <span className="text-green-600 font-bold">{languageComplexity}</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={languageComplexity}
          onChange={(e) => onLanguageComplexityChange(Number(e.target.value))}
          className="w-full accent-green-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{`1 — Beginner`}</span>
          <span>{`100 — Advanced`}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {`Your ${language} rating: `}
          {isUnratedLanguage ? (
            <span className="font-medium text-gray-400">{`Unrated`}</span>
          ) : (
            <span className="font-semibold text-gray-600">{savedRating}</span>
          )}
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!rated}
          onChange={(e) => onRatedChange(!e.target.checked)}
          className="w-4 h-4 accent-green-600 cursor-pointer"
        />
        <span className="text-sm text-gray-600">{`Unrated exercise`}</span>
      </label>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <FaExclamationTriangle className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{`Something went wrong`}</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <button
        onClick={onGenerate}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
      >
        {rated ? generateLabel : `${generateLabel} (Unrated)`}
      </button>
    </div>
  );
}
