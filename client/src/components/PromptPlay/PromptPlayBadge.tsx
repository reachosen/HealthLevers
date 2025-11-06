import { useEffect } from "react";
import { usePromptPlay } from "./PromptPlayProvider";

interface PromptPlayBadgeProps {
  hotkey?: string;
}

export function PromptPlayBadge({ hotkey = "P" }: PromptPlayBadgeProps) {
  const pp = usePromptPlay();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === hotkey.toLowerCase() && 
        !e.metaKey && 
        !e.ctrlKey && 
        !e.altKey &&
        !e.target ||
        (e.target as HTMLElement).tagName !== "INPUT" &&
        (e.target as HTMLElement).tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        pp.openFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pp, hotkey]);

  return (
    <button
      aria-label="Full Prompt"
      title={`Full Prompt (press ${hotkey})`}
      onClick={() => pp.openFull()}
      className="fixed right-3 top-14 z-[101] px-2 py-1 text-xs border rounded bg-white shadow hover:bg-gray-50 transition-colors"
      data-testid="prompt-play-badge"
    >
      ✨ Full Prompt
    </button>
  );
}