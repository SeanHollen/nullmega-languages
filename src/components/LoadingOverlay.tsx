import { useLoading } from "../contexts/LoadingContext";

export function LoadingOverlay() {
  const { isLoading } = useLoading();
  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <style>{`
        @keyframes bigBounce {
          0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
          50% { transform: translateY(-40px); animation-timing-function: cubic-bezier(0, 0, 0.5, 1); }
        }
      `}</style>
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
    </div>
  );
}
