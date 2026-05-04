interface Props {
  message?: string;
  subMessage?: string;
}

export function LoadingView({
  message = `Generating passage…`,
  subMessage = `This may take a moment`,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-12 flex flex-col items-center gap-6">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-green-500"
            style={{
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="text-center space-y-1">
        <p className="text-gray-700 font-medium">{message}</p>
        <p className="text-gray-400 text-sm">{subMessage}</p>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
