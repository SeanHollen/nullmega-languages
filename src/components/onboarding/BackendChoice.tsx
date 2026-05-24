import type { BackendMode } from "../../utils/onboarding";

interface Props {
  selected: BackendMode | null;
  onSelect: (mode: BackendMode) => void;
}

export function BackendChoice({ selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <button
        onClick={() => onSelect(`standard`)}
        className={`w-full text-left p-5 rounded-2xl border-2 transition cursor-pointer ${
          selected === `standard`
            ? `border-green-500 bg-green-50`
            : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-800">{`Standard`}</h3>
          <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
            {`Recommended`}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {`Use `}
          <em>{`The Language Lab`}</em>
          {` services, standard backend, faster loading times.`}
        </p>
      </button>
      <button
        onClick={() => onSelect(`byok`)}
        className={`w-full text-left p-5 rounded-2xl border-2 transition cursor-pointer ${
          selected === `byok`
            ? `border-green-500 bg-green-50`
            : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
        }`}
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{`Bring your own API key`}</h3>
        <p className="text-sm text-gray-500">
          {`Only select this if you know what you're doing. Allows more open-source customization.`}
        </p>
      </button>
    </div>
  );
}
