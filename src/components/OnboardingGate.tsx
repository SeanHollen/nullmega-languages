import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../utils/db";
import { isOnboardingComplete, markOnboardingComplete } from "../utils/onboarding";
import { loadSettings } from "../utils/settings";

interface Props {
  children: ReactNode;
}

// One-shot boot migration: if the user predates this feature and already has data, mark
// onboarding complete so they don't bounce to the wizard. Must run OUTSIDE useLiveQuery's
// callback because Dexie forbids writes inside a liveQuery context.
async function migrateIfNeeded(): Promise<void> {
  if (await isOnboardingComplete()) return;
  const [abilitiesCount, customCount, settings] = await Promise.all([
    db().abilities.count(),
    db().customLanguages.count(),
    loadSettings(),
  ]);
  const hasExistingData =
    abilitiesCount > 0 || customCount > 0 || !!settings.textGen || !!settings.backendUrl;
  if (hasExistingData) await markOnboardingComplete();
}

export function OnboardingGate({ children }: Props) {
  const location = useLocation();

  useEffect(() => {
    void migrateIfNeeded();
  }, []);

  const complete = useLiveQuery(() => isOnboardingComplete(), []);

  if (complete === undefined) return <>{children}</>;
  if (!complete && location.pathname !== `/onboarding`) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
