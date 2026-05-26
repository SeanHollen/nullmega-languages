import React from "react";

interface Props {
  text: string;
  cloze?: boolean;
}

export function BoldWord({ text, cloze }: Props): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    if (cloze) return <span key={i}>{`____`}</span>;
    return (
      <strong key={i} className="font-bold text-gray-900">
        {part}
      </strong>
    );
  });
}
