import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { Mode } from "../hooks/useAbility";
import { Goals, loadGoals, saveGoals, GOAL_MIN, GOAL_MAX } from "../utils/goals";

const MODE_LABELS: Record<Mode, string> = {
  reading: `Reading`,
  listening: `Listening`,
  pronunciation: `Pronunciation`,
  writing: `Writing`,
};

const MODES: Mode[] = [`reading`, `listening`, `pronunciation`, `writing`];

export function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoalsState] = useState<Goals>(loadGoals);

  function update(mode: Mode, value: number) {
    const next = { ...goals, [mode]: value };
    setGoalsState(next);
    saveGoals(next);
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`Daily Goals`}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <p className="text-sm text-gray-500">
            {`How many exercises per category would you like to complete each day?`}
          </p>
          {MODES.map((mode) => (
            <div key={mode} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">{MODE_LABELS[mode]}</span>
                <span className="text-sm font-semibold text-green-600">
                  {goals[mode] === 0 ? `Off` : `${goals[mode]} / day`}
                </span>
              </div>
              <input
                type="range"
                min={GOAL_MIN}
                max={GOAL_MAX}
                value={goals[mode]}
                onChange={(e) => update(mode, parseInt(e.target.value, 10))}
                className="w-full accent-green-600 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{GOAL_MIN}</span>
                <span>{GOAL_MAX}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
