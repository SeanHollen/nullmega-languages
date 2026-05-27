interface Props {
  title: string;
  items: { left: string; right: string }[];
  variant?: "passage" | "results";
  className?: string;
}

const COLORS = {
  passage: { label: `text-gray-300`, item: `text-gray-400`, left: `text-gray-600` },
  results: { label: `text-gray-400`, item: `text-gray-500`, left: `text-gray-700` },
};

export function TermList({ title, items, variant = `results`, className = `` }: Props) {
  if (items.length === 0) return null;
  const c = COLORS[variant];
  return (
    <div className={`border-t border-green-100 pt-4 ${className}`}>
      <p className={`text-xs ${c.label} uppercase tracking-wide mb-2`}>{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((it, i) => (
          <span key={i} className={`text-sm ${c.item}`}>
            <span className={c.left}>{it.left}</span>
            {` — `}
            {it.right}
          </span>
        ))}
      </div>
    </div>
  );
}
