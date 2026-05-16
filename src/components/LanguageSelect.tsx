import type { ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { FaCheck, FaChevronDown, FaPen } from "react-icons/fa";

interface Props {
  value: string;
  languages: string[];
  onChange: (value: string) => void;
}

function Item({
  value,
  label,
  muted,
  icon,
}: {
  value: string;
  label: string;
  muted?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Select.Item
      value={value}
      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none outline-none data-[highlighted]:bg-green-50 data-[highlighted]:text-green-800 data-[state=checked]:font-semibold ${muted ? `text-gray-400` : `text-gray-700`}`}
    >
      <span className="w-3.5 flex items-center justify-center shrink-0">
        <Select.ItemIndicator>
          <FaCheck className="text-green-600 text-xs" />
        </Select.ItemIndicator>
      </span>
      <Select.ItemText>{label}</Select.ItemText>
      {icon}
    </Select.Item>
  );
}

export function LanguageSelect({ value, languages, onChange }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm font-medium border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer hover:bg-white/30 transition">
        <Select.Value />
        <Select.Icon>
          <FaChevronDown className="text-white/70 text-xs" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[160px] max-h-72 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 py-1"
        >
          <Select.Viewport>
            <Item
              value="__other__"
              label="Write it"
              icon={<FaPen className="text-xs text-gray-400" />}
            />
            <Select.Separator className="my-1 h-px bg-gray-300" />
            {languages.map((lang) => (
              <Item key={lang} value={lang} label={lang} />
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
