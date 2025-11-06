import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
};

export default function CollapsibleGroup({ title, defaultOpen=false, children, count }: Props){
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-slate-50"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        data-testid={`collapsible-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          {title}
        </span>
        {typeof count === "number" && (
          <span className="inline-flex items-center justify-center text-xs min-w-[1.5rem] h-5 px-2 rounded-full bg-slate-100 border border-slate-200">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}