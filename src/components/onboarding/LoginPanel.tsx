import { useState } from "react";
import { useTranslation } from "react-i18next";
import { callAuthLogin } from "../../utils/api";
import { saveAuthInfo } from "../../utils/settings";
import { GoogleSignInButton } from "../GoogleSignInButton";

interface Props {
  onSuccess: () => void;
}

export function LoginPanel({ onSuccess }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  function handleCredential(idToken: string) {
    setSigningIn(true);
    setError(null);
    void (async () => {
      try {
        const info = await callAuthLogin(idToken);
        await saveAuthInfo(info);
        onSuccess();
      } catch (err) {
        setError(String(err));
      }
      setSigningIn(false);
    })();
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-gray-500">
        {t(`Sign in with Google to sync your progress and use the `)}
        <em>{t(`Nullmega Languages`)}</em>
        {t(` backend.`)}
      </p>
      <GoogleSignInButton onCredential={handleCredential} />
      {signingIn && <p className="text-xs text-gray-400">{t(`Signing in…`)}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
