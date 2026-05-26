import { useState } from "react";
import { useTranslation } from "react-i18next";
import { callAuthLogin } from "../../utils/api";
import { saveAuthInfo } from "../../utils/settings";
import { Button } from "../Button";

interface Props {
  onSuccess: () => void;
}

export function LoginPanel({ onSuccess }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLogin() {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const info = await callAuthLogin();
        await saveAuthInfo(info);
        setLoading(false);
        onSuccess();
      } catch (err) {
        setError(String(err));
        setLoading(false);
      }
    })();
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-gray-500">
        {t(`Sign in to sync your progress and use the `)}
        <em>{t(`The Language Lab`)}</em>
        {t(` backend.`)}
      </p>
      <Button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition"
      >
        {loading ? (
          t(`Signing in…`)
        ) : (
          <>
            {t(`Login with `)}
            <em>{t(`The Language Lab`)}</em>
          </>
        )}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
