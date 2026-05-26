import { useTranslation } from "react-i18next";
import type { ComplexityExamples } from "../../hooks/useGenerateComplexityExample";

interface Props {
  value: number;
  onChange: (v: number) => void;
  examples: ComplexityExamples | null;
  error: string | null;
}

const CEFR_TICKS = [`Pre-A1`, `A1`, `A2`, `B1`, `B2`, `C1`, `C2`];

function cefrFor(level: number): string {
  if (level <= 10) return `Pre-A1`;
  if (level <= 25) return `A1`;
  if (level <= 40) return `A2`;
  if (level <= 55) return `B1`;
  if (level <= 70) return `B2`;
  if (level <= 85) return `C1`;
  return `C2`;
}

// Find the closest level for which an example exists. The LLM occasionally omits a
// level; fall back to the nearest neighbor rather than showing nothing.
function nearestExample(examples: ComplexityExamples, level: number): string {
  if (examples[level]) return examples[level];
  for (let d = 1; d < 100; d++) {
    if (examples[level - d]) return examples[level - d];
    if (examples[level + d]) return examples[level + d];
  }
  return ``;
}

export function ComplexitySlider({ value, onChange, examples, error }: Props) {
  const { t } = useTranslation();
  const example = examples ? nearestExample(examples, value) : ``;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">{t(`Difficulty level`)}</label>
          <span className="text-2xl font-bold text-green-600">
            {value}
            <span className="text-sm font-medium text-gray-500 ml-2">{cefrFor(value)}</span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-green-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          {CEFR_TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 min-h-[5rem] flex items-center justify-center">
        {error && (
          <span className="text-sm text-red-500">
            {t(`Could not generate examples: {{error}}`, { error })}
          </span>
        )}
        {!error && !examples && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-bounce" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              {t(`Generating 100 example sentences at every difficulty level…`)}
            </p>
            <p className="text-xs text-gray-400">{t(`This usually takes 30–60 seconds.`)}</p>
          </div>
        )}
        {!error && example && (
          <p className="text-base text-gray-800 text-center leading-relaxed">{example}</p>
        )}
      </div>
    </div>
  );
}
