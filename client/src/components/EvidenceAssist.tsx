import { useEffect, useRef, useState } from "react";

interface EvidenceAssistProps {
  moduleTitle?: string;
  followup?: string | null;
  promptText?: string | null;
  children?: React.ReactNode;
}

export default function EvidenceAssist({
  moduleTitle,
  followup,
  promptText,
  children,
}: EvidenceAssistProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1),
      { root: null, threshold: [1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Robust fallback for prompt text
  const resolvedPrompt = (promptText && promptText.trim()) 
    ? promptText 
    : "— (no prompt found for this specialty/module; using default)";

  return (
    <div className="evidenceSticky">
      <div ref={cardRef} className={`evidenceCard ${stuck ? "is-stuck" : ""}`}>
        {/* Inline Full Prompt Display */}
        {moduleTitle && (
          <div className="prose text-sm bg-slate-50 p-3 rounded-md mb-4">
            <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
              {resolvedPrompt}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}