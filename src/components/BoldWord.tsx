import React from "react";

interface Props {
  text: string;
  target: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}

export function BoldWord({ text, target }: Props): React.ReactNode {
  const trimmed = target.trim();
  if (!trimmed) return text;
  const clean = text.replace(/\*\*(.*?)\*\*/g, `$1`);
  const re = new RegExp(`(${escapeRegex(trimmed)})`, `giu`);
  const parts = clean.split(re);
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
