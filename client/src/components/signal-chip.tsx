import { useState } from "react";

type Status = "pass" | "fail" | "caution" | "inactive";

const styles: Record<Status, {bg:string; border:string; text:string}> = {
  pass:    { bg:"#E6F6FB", border:"#0076A8", text:"#005A7D" },
  caution: { bg:"#FFF6E6", border:"#CC8A00", text:"#8A5E00" },
  fail:    { bg:"#FDECEC", border:"#B71C1C", text:"#8A1010" },
  inactive:{ bg:"#F1F5F9", border:"#C7D0DA", text:"#6C7A89" }
};

export function SignalChip({
  label,
  status = "inactive",
  tooltip
}: { label:string; status?:Status | string; tooltip?:string }) {
  const [hover, setHover] = useState(false);
  
  // Map different status values to our supported types
  const normalizedStatus: Status = 
    status === "pass" || status === "active" ? "pass" :
    status === "fail" || status === "failed" ? "fail" :
    status === "caution" || status === "warning" ? "caution" :
    "inactive";
    
  const s = styles[normalizedStatus];
  return (
    <span
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.text }}
      aria-label={`${label} — ${tooltip||""}`}
      data-testid={`signal-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span
        aria-hidden
        style={{
          display:"inline-block",
          width:8, height:8, borderRadius:9999,
          background: normalizedStatus==="pass" ? "#00A9E0" : normalizedStatus==="fail" ? "#C62828" : normalizedStatus==="caution" ? "#FFB000" : "#C7D0DA"
        }}
      />
      {label}
      {hover && tooltip && (
        <span
          role="tooltip"
          className="absolute z-50 text-xs shadow-lg rounded-md p-2"
          style={{
            top:"110%", left:"0",
            background:"#0B1F2A", color:"#FFFFFF", maxWidth:280, border:"1px solid #0076A8"
          }}
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}