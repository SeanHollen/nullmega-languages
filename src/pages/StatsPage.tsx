import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import type { Mode } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getHistory } from "../utils/history";
import { deltaColor } from "../utils/colors";

const MODE_LABELS: Record<Mode, string> = {
  reading: `Reading`,
  writing: `Writing`,
  listening: `Listening`,
  pronunciation: `Pronunciation`,
};

const MODE_COLORS: Record<Mode, string> = {
  reading: `#16a34a`,
  writing: `#0ea5e9`,
  listening: `#f59e0b`,
  pronunciation: `#a855f7`,
};

const VALID_MODES: Mode[] = [`reading`, `writing`, `listening`, `pronunciation`];

interface Point {
  t: number;
  rating: number;
}

const WIDTH = 600;
const HEIGHT = 280;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

export function StatsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { mode: modeParam } = useParams<{ mode: string }>();

  if (!modeParam || !VALID_MODES.includes(modeParam as Mode)) {
    return (
      <div className="min-h-screen bg-green-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer mb-6 flex items-center gap-2"
          >
            <FaArrowLeft />
            <span>{`Home`}</span>
          </button>
          <p className="text-gray-500">{`Unknown mode.`}</p>
        </div>
      </div>
    );
  }

  const mode = modeParam as Mode;
  const color = MODE_COLORS[mode];
  const label = MODE_LABELS[mode];

  const points: Point[] = getHistory(mode, language)
    .filter((r) => typeof r.ratingAfter === `number`)
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((r) => ({ t: r.completedAt, rating: r.ratingAfter as number }));

  const hasData = points.length > 0;

  const tMin = hasData ? points[0].t : 0;
  const tMax = hasData ? points[points.length - 1].t : 0;
  const tSpan = Math.max(tMax - tMin, 1);

  const ratingMin = hasData ? Math.min(...points.map((p) => p.rating)) : 0;
  const ratingMax = hasData ? Math.max(...points.map((p) => p.rating)) : 100;
  const yLow = Math.max(1, Math.floor(ratingMin - 5));
  const yHigh = Math.min(100, Math.ceil(ratingMax + 5));
  const ySpan = Math.max(yHigh - yLow, 1);

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  function x(t: number): number {
    if (tSpan === 0) return PAD_L + innerW / 2;
    return PAD_L + ((t - tMin) / tSpan) * innerW;
  }

  function y(rating: number): number {
    return PAD_T + innerH - ((rating - yLow) / ySpan) * innerH;
  }

  const yTicks = [yLow, Math.round((yLow + yHigh) / 2), yHigh];
  const latest = hasData ? points[points.length - 1].rating : null;
  const first = hasData ? points[0].rating : null;
  const delta = latest !== null && first !== null ? latest - first : 0;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/${mode}`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`${label} Stats`}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-500">{`Rating over time — ${language}`}</p>
            {hasData && (
              <div className="text-sm">
                <span className="text-gray-500">{`Latest: `}</span>
                <span className="font-semibold text-gray-800">{latest}</span>
                {first !== latest && (
                  <span className={`ml-2 text-xs font-medium ${deltaColor(delta)}`}>
                    {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                    {` overall`}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasData ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`${label} rating chart`}
            >
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD_L}
                    x2={WIDTH - PAD_R}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD_L - 6}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className="fill-gray-400"
                    fontSize="11"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={HEIGHT - PAD_B} stroke="#e5e7eb" />
              <line
                x1={PAD_L}
                x2={WIDTH - PAD_R}
                y1={HEIGHT - PAD_B}
                y2={HEIGHT - PAD_B}
                stroke="#e5e7eb"
              />

              <text x={PAD_L} y={HEIGHT - 8} className="fill-gray-400" fontSize="11">
                {new Date(tMin).toLocaleDateString()}
              </text>
              <text
                x={WIDTH - PAD_R}
                y={HEIGHT - 8}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="11"
              >
                {new Date(tMax).toLocaleDateString()}
              </text>

              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points.map((p) => `${x(p.t)},${y(p.rating)}`).join(` `)}
              />
              {points.map((p, i) => (
                <circle key={i} cx={x(p.t)} cy={y(p.rating)} r="3" fill={color} />
              ))}
            </svg>
          ) : (
            <p className="text-sm text-gray-400 italic py-8 text-center">
              {`No rated ${label.toLowerCase()} exercises yet for ${language}.`}
            </p>
          )}

          {hasData && (
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
              {`${points.length} rated exercise${points.length === 1 ? `` : `s`}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
