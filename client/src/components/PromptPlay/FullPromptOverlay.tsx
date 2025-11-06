import { useEffect } from "react";

interface FullPromptOverlayProps {
  open: boolean;
  text: string;
  title?: string;
  onClose: () => void;
  meta?: {
    promptId?: string;
    type?: string;
    version?: string;
  };
}

export function FullPromptOverlay({
  open,
  text,
  title = "Resolved Prompt",
  onClose,
  meta
}: FullPromptOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (open) {
      window.addEventListener("keydown", onKey);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (meta?.promptId || "prompt") + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInTab = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60">
      <div className="absolute inset-6 bg-white rounded-xl shadow-2xl p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{title}</span>
            {meta && (
              <span className="ml-2 text-slate-400">
                {meta.promptId} · {meta.type} · {meta.version}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCopy} 
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Copy
            </button>
            <button 
              onClick={handleDownload}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Download
            </button>
            <button 
              onClick={handleOpenInTab}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Open
            </button>
            <button 
              onClick={onClose} 
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Esc
            </button>
          </div>
        </div>

        {/* Content */}
        <pre className="flex-1 whitespace-pre-wrap break-words text-[12px] leading-5 font-mono overflow-visible bg-gray-50 p-4 rounded border">
{text}
        </pre>
      </div>
    </div>
  );
}