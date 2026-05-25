import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BackHeader } from "../components/BackHeader";
import type { Provider } from "../utils/settings";
import { loadSettings, saveSettings } from "../utils/settings";
import { TextGenKeySection } from "../components/onboarding/TextGenKeySection";

export function SettingsPage() {
  const navigate = useNavigate();
  const initial = useLiveQuery(() => loadSettings(), []);

  const [textGenKey, setTextGenKey] = useState<string | null>(null);
  const [sameTTS, setSameTTS] = useState<boolean | null>(null);
  const [ttsKey, setTtsKey] = useState<string | null>(null);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [ttsKeyTouched, setTtsKeyTouched] = useState(false);

  // Once loaded, hydrate the form state from the stored settings (track-and-reset pattern).
  const [hydratedFor, setHydratedFor] = useState<unknown>(null);
  if (initial && hydratedFor !== initial) {
    setHydratedFor(initial);
    setTextGenKey(initial.textGen?.key ?? ``);
    setSameTTS(!initial.tts || initial.tts.key === initial.textGen?.key);
    setTtsKey(initial.tts && initial.tts.key !== initial.textGen?.key ? initial.tts.key : ``);
  }

  function handleSave() {
    if (!initial || textGenKey === null || ttsKey === null || sameTTS === null) return;
    const provider: Provider = `openai`;
    const textGen = textGenKey ? { provider, key: textGenKey } : null;
    let tts = null;
    if (sameTTS && textGen) {
      tts = { provider, key: textGenKey };
    } else if (!sameTTS && ttsKey) {
      tts = { provider, key: ttsKey };
    }
    void (async () => {
      await saveSettings({ textGen, tts, backendUrl: initial.backendUrl });
      void navigate(`/`);
    })();
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader title="Settings" to="/" />

        {initial && textGenKey !== null && ttsKey !== null && sameTTS !== null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <TextGenKeySection value={textGenKey} onChange={setTextGenKey} />

            <hr className="border-gray-100" />

            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">{`Text-to-Speech`}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {`Configure a separate key for TTS, or reuse the text generation key.`}
              </p>
              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameTTS}
                  onChange={(e) => setSameTTS(e.target.checked)}
                  className="accent-green-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600">{`Use same key as text generation`}</span>
              </label>
              {!sameTTS && (
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
                      type={showTtsKey ? `text` : `password`}
                      value={ttsKey}
                      onChange={(e) => setTtsKey(e.target.value)}
                      onBlur={() => setTtsKeyTouched(true)}
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
                          checked={showTtsKey}
                          onChange={(e) => setShowTtsKey(e.target.checked)}
                          className="accent-green-500 cursor-pointer"
                        />
                        <span className="text-xs text-gray-500">{`Show key`}</span>
                      </label>
                      {ttsKey && (
                        <button
                          type="button"
                          onClick={() => {
                            setTtsKey(``);
                            setTtsKeyTouched(false);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                        >
                          {`Clear`}
                        </button>
                      )}
                    </div>
                    {ttsKeyTouched && ttsKey && !ttsKey.startsWith(`sk-`) && (
                      <p className="text-xs text-red-500 mt-1">{`Key should start with "sk-"`}</p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <button
              onClick={handleSave}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {`Save`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
