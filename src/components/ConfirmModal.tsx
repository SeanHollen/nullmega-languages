import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;
  const confirmClass = destructive
    ? `bg-red-600 hover:bg-red-700`
    : `bg-green-600 hover:bg-green-700`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-6 space-y-4"
      >
        <p className="text-lg font-semibold text-gray-800">{title}</p>
        {body && <p className="text-sm text-gray-600">{body}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            {cancelLabel ?? t(`Cancel`)}
          </Button>
          <Button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition cursor-pointer ${confirmClass}`}
          >
            {confirmLabel ?? t(`Confirm`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
