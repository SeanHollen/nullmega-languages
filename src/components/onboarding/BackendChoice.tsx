import { useTranslation } from "react-i18next";
import type { BackendMode } from "../../utils/onboarding";
import { Button } from "../Button";

interface Props {
  selected: BackendMode | null;
  onSelect: (mode: BackendMode) => void;
}

export function BackendChoice({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Button
        onClick={() => onSelect(`standard`)}
        className={`w-full text-left p-5 rounded-2xl border-2 transition cursor-pointer ${
          selected === `standard`
            ? `border-green-500 bg-green-50`
            : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-800">{t(`Standard`)}</h3>
          <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
            {t(`Recommended`)}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {t(`Use `)}
          <em>{t(`The Language Lab`)}</em>
          {t(` services, standard backend, faster loading times.`)}
        </p>
      </Button>
      <Button
        onClick={() => onSelect(`byok`)}
        className={`w-full text-left p-5 rounded-2xl border-2 transition cursor-pointer ${
          selected === `byok`
            ? `border-green-500 bg-green-50`
            : `border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50`
        }`}
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{t(`Bring your own API key`)}</h3>
        <p className="text-sm text-gray-500">
          {t(
            `Only select this if you know what you're doing. Allows more open-source customization.`,
          )}
        </p>
      </Button>
    </div>
  );
}
