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
          className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      </div>
      {right}
    </div>
  );
}
