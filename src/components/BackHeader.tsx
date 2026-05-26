import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface Props {
  title: string;
  to: string;
  // Optional content rendered on the right side of the row (e.g. a "3 left" counter).
  right?: React.ReactNode;
}

export function BackHeader({ title, to, right }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4 min-w-0">
        <Button
          onClick={() => void navigate(to)}
          aria-label={t(`Back`)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 transition cursor-pointer"
        >
          <FaArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-gray-800 truncate">{title}</h1>
      </div>
      {right}
    </div>
  );
}
