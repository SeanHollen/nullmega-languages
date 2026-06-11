import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../contexts/LanguageContext";
import {
  addCustomLanguage,
  getStoredLanguage,
  LANGUAGES,
  setStoredLanguage,
} from "../utils/language";
import {
  loadBackendMode,
  loadOnboardingStage,
  markOnboardingComplete,
  saveBackendMode,
  saveOnboardingStage,
  savePerModeDefaults,
  type BackendMode,
} from "../utils/onboarding";
import { loadSettings, saveSettings } from "../utils/settings";
import type { ComplexityExamples } from "../hooks/useGenerateComplexityExample";
import { generateComplexityExamples } from "../hooks/useGenerateComplexityExample";
import { LanguageGrid } from "../components/onboarding/LanguageGrid";
import { ComplexitySlider } from "../components/onboarding/ComplexitySlider";
import { BackendChoice } from "../components/onboarding/BackendChoice";
import { TextGenKeySection } from "../components/onboarding/TextGenKeySection";
import { LoginPanel } from "../components/onboarding/LoginPanel";
import { Button } from "../components/Button";

type Stage = "language" | "complexity" | "backend" | "auth";

const STAGE_TITLES: Record<Stage, string> = {
  language: `Pick a language`,
  complexity: `Pick the level you can understand`,
  backend: `How do you want to run it?`,
  auth: `One more step`,
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>(`language`);
  const [language, setLocalLanguage] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<number>(50);
  const [backendMode, setBackendMode] = useState<BackendMode | null>(null);
  const initialSettings = useLiveQuery(() => loadSettings(), []);
  const persistedStage = useLiveQuery(() => loadOnboardingStage(), []);
  const persistedBackendMode = useLiveQuery(() => loadBackendMode(), []);
  const persistedLanguage = useLiveQuery(() => getStoredLanguage(), []);
  const [hydrated, setHydrated] = useState(false);
  const [byokKey, setByokKey] = useState<string | null>(null);
  if (initialSettings && byokKey === null) {
    setByokKey(initialSettings.textGen?.key ?? ``);
  }
  // Restore the wizard cursor + dependent state from Dexie on first render after
  // useLiveQuery resolves. Without this, anything that reloads the page mid-flow
  // (e.g. a mobile Google OAuth redirect) sends the user back to stage 1.
  if (
    !hydrated &&
    persistedStage !== undefined &&
    persistedBackendMode !== undefined &&
    persistedLanguage !== undefined
  ) {
    setHydrated(true);
    if (persistedStage) setStage(persistedStage);
    if (persistedBackendMode) setBackendMode(persistedBackendMode);
    if (persistedLanguage) setLocalLanguage(persistedLanguage);
  }
  const [examples, setExamples] = useState<ComplexityExamples | null>(null);
  const [examplesError, setExamplesError] = useState<string | null>(null);

  function setStageAndPersist(next: Stage): void {
    setStage(next);
    void saveOnboardingStage(next);
  }

  function selectLanguage(lang: string): void {
    setLocalLanguage(lang);
    if (!LANGUAGES.includes(lang)) {
      void addCustomLanguage(lang);
    }
  }

  function startExamplesFetch(lang: string): void {
    setExamples(null);
    setExamplesError(null);
    void (async () => {
      try {
        const result = await generateComplexityExamples(lang);
        setExamples(result);
      } catch (err) {
        setExamplesError(String(err));
      }
    })();
  }

  async function commitStageAndAdvance(): Promise<void> {
    if (stage === `language` && language) {
      await setStoredLanguage(language);
      setLanguage(language);
      startExamplesFetch(language);
      setStageAndPersist(`complexity`);
      return;
    }
    if (stage === `complexity` && language) {
      await savePerModeDefaults(language, complexity);
      setStageAndPersist(`backend`);
      return;
    }
    if (stage === `backend` && backendMode) {
      await saveBackendMode(backendMode);
      setStageAndPersist(`auth`);
      return;
    }
  }

  async function finishByok(): Promise<void> {
    if (!byokKey) return;
    const settings = await loadSettings();
    await saveSettings({
      ...settings,
      textGen: { provider: `openai`, key: byokKey },
    });
    await markOnboardingComplete();
    void navigate(`/`);
  }

  async function finishStandard(): Promise<void> {
    await markOnboardingComplete();
    void navigate(`/`);
  }

  const canAdvance =
    (stage === `language` && !!language) ||
    stage === `complexity` ||
    (stage === `backend` && !!backendMode);

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t(STAGE_TITLES[stage])}</h1>
          <StageDots stage={stage} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {stage === `language` && <LanguageGrid selected={language} onSelect={selectLanguage} />}
          {stage === `complexity` && (
            <ComplexitySlider
              value={complexity}
              onChange={setComplexity}
              examples={examples}
              error={examplesError}
            />
          )}
          {stage === `backend` && (
            <BackendChoice selected={backendMode} onSelect={setBackendMode} />
          )}
          {stage === `auth` && backendMode === `byok` && byokKey !== null && (
            <div className="space-y-6">
              <TextGenKeySection value={byokKey} onChange={setByokKey} />
            </div>
          )}
          {stage === `auth` && backendMode === `standard` && (
            <LoginPanel onSuccess={() => void finishStandard()} />
          )}

          <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
            {stage !== `language` ? (
              <Button
                onClick={() => {
                  if (stage === `complexity`) setStageAndPersist(`language`);
                  else if (stage === `backend`) setStageAndPersist(`complexity`);
                  else if (stage === `auth`) setStageAndPersist(`backend`);
                }}
                className="text-sm text-gray-500 px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 cursor-pointer transition"
              >
                {t(`Back`)}
              </Button>
            ) : (
              <span />
            )}
            {stage === `auth` && backendMode === `byok` && (
              <Button
                onClick={() => void finishByok()}
                disabled={!byokKey?.startsWith(`sk-`)}
                className="text-sm bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                {t(`Finish`)}
              </Button>
            )}
            {stage !== `auth` && (
              <Button
                onClick={() => void commitStageAndAdvance()}
                disabled={!canAdvance}
                className="text-sm bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                {t(`Next`)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageDots({ stage }: { stage: Stage }) {
  const stages: Stage[] = [`language`, `complexity`, `backend`, `auth`];
  const currentIdx = stages.indexOf(stage);
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {stages.map((s, i) => (
        <span
          key={s}
          className={`w-2 h-2 rounded-full ${i <= currentIdx ? `bg-green-600` : `bg-gray-300`}`}
        />
      ))}
    </div>
  );
}
