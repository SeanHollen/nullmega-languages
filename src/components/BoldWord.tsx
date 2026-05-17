import React from "react";

interface Props {
  text: string;
}

export function BoldWord({ text }: Props): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-gray-900">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
