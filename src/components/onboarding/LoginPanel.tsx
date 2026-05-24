import { useState } from "react";
import { callAuthLogin } from "../../utils/api";
import { saveAuthInfo } from "../../utils/settings";

interface Props {
  onSuccess: () => void;
}

export function LoginPanel({ onSuccess }: Props) {
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
        {`Sign in to sync your progress and use the `}
        <em>{`The Language Lab`}</em>
        {` backend.`}
      </p>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition"
      >
        {loading ? (
          `Signing in…`
        ) : (
          <>
            {`Login with `}
            <em>{`The Language Lab`}</em>
          </>
        )}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
