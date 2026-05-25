import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

interface Props {
  title: string;
  to: string;
  // Optional content rendered on the right side of the row (e.g. a "3 left" counter).
  right?: React.ReactNode;
}

export function BackHeader({ title, to, right }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => navigate(to)}
          aria-label="Back"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 transition cursor-pointer"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl font-bold text-gray-800 truncate">{title}</h1>
      </div>
      {right}
    </div>
  );
}
