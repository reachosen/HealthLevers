import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  title?: string;           // tooltip (native)
  leftIcon?: ReactNode;     // optional icon
  active?: boolean;         // highlighted (relevant)
};

export default function ChipButton({ children, onClick, title, leftIcon, active }: Props){
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "chip-btn",
        active ? "chip-active" : "chip-neutral"
      ].join(" ")}
      data-testid={`chip-${title?.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`}
    >
      {leftIcon && <span className="flex-shrink-0 mt-0.5">{leftIcon}</span>}
      <span className="text-left leading-relaxed">{children}</span>
    </button>
  );
}