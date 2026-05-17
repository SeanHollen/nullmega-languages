import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";

export type SortDir = "asc" | "desc";

interface Props {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}

export function SortableHeader({ label, active, dir, onClick }: Props) {
  return (
    <th className="px-4 py-3">
      <button
        onClick={onClick}
        className="flex items-center gap-0.5 uppercase tracking-wide hover:text-gray-700 cursor-pointer"
      >
        {label}
        {!active && <FaSort className="ml-1 text-xs text-gray-300" />}
        {active && dir === "asc" && <FaSortUp className="ml-1 text-xs" />}
        {active && dir === "desc" && <FaSortDown className="ml-1 text-xs" />}
      </button>
    </th>
  );
}
