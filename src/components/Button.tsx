import type { ButtonHTMLAttributes } from "react";

// Native <button> wrapper that fires on mousedown (instant — no waiting for mouseup),
// and still activates on Enter/Space for keyboard users. See CLAUDE.md "Prefer
// onMouseDown over onClick".
//
// The exposed prop is named `onClick` so eslint's react-hooks plugin recognizes the
// callback as an event handler (not something invoked during render). Internally we
// bind it to onMouseDown + onKeyDown.
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
}

export function Button({ onClick, ...rest }: Props) {
  return (
    <button
      onMouseDown={onClick}
      onKeyDown={(e) => {
        if (e.key === `Enter` || e.key === ` `) {
          e.preventDefault();
          onClick();
        }
      }}
      {...rest}
    />
  );
}
