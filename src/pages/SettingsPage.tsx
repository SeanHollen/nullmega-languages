import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import type { Provider } from "../utils/settings";
import {
  loadSettings,
  saveSettings,
  loadAuthInfo,
  saveAuthInfo,
  clearAuthInfo,
} from "../utils/settings";
import { DEFAULT_TTS_MODEL, type TtsModel } from "../utils/models";
import { TextGenKeySection } from "../components/onboarding/TextGenKeySection";
import { BackendChoice } from "../components/onboarding/BackendChoice";
import type { BackendMode } from "../utils/onboarding";
import { loadBackendMode, saveBackendMode } from "../utils/onboarding";
import { callAuthLogin, callAuthLogout } from "../utils/api";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Button } from "../components/Button";

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const initial = useLiveQuery(() => loadSettings(), []);
  const backendMode = useLiveQuery(() => loadBackendMode(), []) ?? null;
  const authInfo = useLiveQuery(() => loadAuthInfo(), []) ?? null;

  const [textGenKey, setTextGenKey] = useState<string | null>(null);
  const [sameTTS, setSameTTS] = useState<boolean | null>(null);
  const [ttsKey, setTtsKey] = useState<string | null>(null);
  const [ttsModel, setTtsModel] = useState<TtsModel>(DEFAULT_TTS_MODEL);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [ttsKeyTouched, setTtsKeyTouched] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  function handleBackendModeSelect(mode: BackendMode) {
    void saveBackendMode(mode);
  }

  function handleCredential(idToken: string) {
    setLoginError(null);
    setLoggingIn(true);
    void (async () => {
      try {
        const info = await callAuthLogin(idToken);
        await saveAuthInfo(info);
      } catch (err) {
        setLoginError(String(err));
      }
      setLoggingIn(false);
    })();
  }

  function handleLogout() {
    void (async () => {
      await callAuthLogout();
      await clearAuthInfo();
    })();
  }

  // Once loaded, hydrate the form state from the stored settings (track-and-reset pattern).
  const [hydratedFor, setHydratedFor] = useState<unknown>(null);
  if (initial && hydratedFor !== initial) {
    setHydratedFor(initial);
    setTextGenKey(initial.textGen?.key ?? ``);
    setSameTTS(!initial.tts || initial.tts.key === initial.textGen?.key);
    setTtsKey(initial.tts && initial.tts.key !== initial.textGen?.key ? initial.tts.key : ``);
    setTtsModel(initial.ttsModel);
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
      await saveSettings({ textGen, tts, ttsModel, backendUrl: initial.backendUrl });
      void navigate(`/`);
    })();
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader title={t(`Settings`)} />

        {initial && textGenKey !== null && ttsKey !== null && sameTTS !== null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">{t(`Backend Mode`)}</h2>
              <BackendChoice selected={backendMode} onSelect={handleBackendModeSelect} />
              {backendMode === `standard` && !authInfo && (
                <div className="space-y-2">
                  <GoogleSignInButton onCredential={handleCredential} />
                  {loggingIn && <p className="text-xs text-gray-400">{t(`Signing in…`)}</p>}
                  {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                </div>
              )}
              {backendMode === `standard` && authInfo && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {authInfo.picture && (
                      <img
                        src={authInfo.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">
                        {authInfo.name ?? authInfo.email ?? authInfo.userId}
                      </p>
                      {authInfo.name && authInfo.email && (
                        <p className="text-xs text-gray-400 truncate">{authInfo.email}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleLogout}
                    className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2 transition cursor-pointer shrink-0"
                  >
                    {t(`Logout`)}
                  </Button>
                </div>
              )}
            </section>

            <hr className="border-gray-100" />

            <TextGenKeySection value={textGenKey} onChange={setTextGenKey} />

            <Button
              onClick={() => void navigate(`/settings/usage`)}
              className="text-sm text-green-700 hover:text-green-800 cursor-pointer"
            >
              {t(`View usage & cost stats →`)}
            </Button>

            <hr className="border-gray-100" />

            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">{t(`Text-to-Speech`)}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t(`Configure a separate key for TTS, or reuse the text generation key.`)}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">{t(`Model`)}</label>
                <select
                  value={ttsModel}
                  onChange={(e) => setTtsModel(e.target.value as TtsModel)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                >
                  <option value="gpt-4o-mini-tts">{t(`gpt-4o-mini-tts (language-aware)`)}</option>
                  <option value="tts-1">{t(`tts-1 / tts-1-hd (classic)`)}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {t(
                    `gpt-4o-mini-tts is told the target language explicitly, so short phrases stop sounding English. Classic infers from the text.`,
                  )}
                </p>
              </div>
              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameTTS}
                  onChange={(e) => setSameTTS(e.target.checked)}
                  className="accent-green-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600">
                  {t(`Use same key as text generation`)}
                </span>
              </label>
              {!sameTTS && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t(`Provider`)}
                    </label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
                      <option>{t(`OpenAI`)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {t(`API Key`)}
                    </label>
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
                        <span className="text-xs text-gray-500">{t(`Show key`)}</span>
                      </label>
                      {ttsKey && (
                        <Button
                          type="button"
                          onClick={() => {
                            setTtsKey(``);
                            setTtsKeyTouched(false);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                        >
                          {t(`Clear`)}
                        </Button>
                      )}
                    </div>
                    {ttsKeyTouched && ttsKey && !ttsKey.startsWith(`sk-`) && (
                      <p className="text-xs text-red-500 mt-1">
                        {t(`Key should start with "sk-"`)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <Button
              onClick={handleSave}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {t(`Save`)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
