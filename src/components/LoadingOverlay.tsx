import { useTranslation } from "react-i18next";
import { useLoading } from "../contexts/LoadingContext";

export function LoadingOverlay() {
  const { t } = useTranslation();
  const { isLoading, messages } = useLoading();
  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={t(`Loading`)}
    >
      <style>{`
        @keyframes bigBounce {
          0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
          50% { transform: translateY(-40px); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
        }
      `}</style>
      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-4">
          <span
            className="w-6 h-6 bg-green-500 rounded-full shadow-lg"
            style={{ animation: `bigBounce 700ms infinite`, animationDelay: `0ms` }}
          />
          <span
            className="w-6 h-6 bg-green-500 rounded-full shadow-lg"
            style={{ animation: `bigBounce 700ms infinite`, animationDelay: `120ms` }}
          />
          <span
            className="w-6 h-6 bg-green-500 rounded-full shadow-lg"
            style={{ animation: `bigBounce 700ms infinite`, animationDelay: `240ms` }}
          />
        </div>
        {messages.length > 0 && (
          <div className="flex flex-col items-center gap-1 px-4 py-2 bg-white/80 rounded-lg shadow">
            {messages.map((m, i) => (
              <p key={i} className="text-sm text-gray-700">
                {m}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
