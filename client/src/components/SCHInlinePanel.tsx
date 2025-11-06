import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Maximize2, Settings } from "lucide-react";
import { USNWR_MATRIX, signalsByGroup, type Signal } from "@/types/usnwrMatrix";
import { usePlanningConfig } from "@/lib/planningConfig";

function deltaMinutes(aISO?: string, bISO?: string): number | null {
  if (!aISO || !bISO) return null;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

function fmtHours1dp(min: number): string {
  return `${Math.round((min / 60) * 10) / 10}h`;
}

export type CaseRow = {
  id: string;
  name: string;
  age: number;
  mrn: string;
};

export type CaseData = {
  id: string;
  patient?: { mrn: string; name: string; age: number };
  encounter?: { id: string; location: string; disposition: string };
  events?: {
    arrival?: string;
    consult?: { ortho?: string };
    imaging?: { first?: string };
    surgery?: { start?: string; end?: string };
  };
  consults?: { ortho?: { provider?: string } };
  imaging?: {
    ct?: { performed?: boolean; time?: string };
    xray?: { time?: string };
  };
  surgery?: { procedure?: string; room?: string; priority?: string; delay_reason_code?: string };
  anesthesia?: { start?: string; end?: string; npo_start?: string };
  clinical?: { neurovascular_compromise?: boolean; open_fracture?: boolean };
  derived?: {
    arrival_to_surgery_min?: number;
    target_19h_met?: boolean;
  };
  notes?: {
    delay_summary?: string;
    key_quotes?: string[];
  };
  // Legacy support for existing data structure
  times?: {
    ArrivalInstant?: string;
    IncisionStartInstant?: string;
    AbxFirstDose?: string;
  };
  labs?: Array<{ ts?: string; name: string; value: number }>;
  [key: string]: any;
};

export type SCHInlinePanelProps = {
  caseRow: CaseRow;
  caseData: CaseData;
  projectKey?: string;
  activeGroupIds?: string[]; // pass filtered groups from planning config
  onMaximize?: () => void;
  onConfigure?: () => void;
  defaultExpanded?: boolean;
};

type Status = "pass" | "fail" | "caution" | "inactive";

function getStatusColor(status: Status): string {
  switch (status) {
    case "pass": return "bg-green-100 text-green-800 border-green-200";
    case "fail": return "bg-red-100 text-red-800 border-red-200";
    case "caution": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "inactive": return "bg-gray-100 text-gray-600 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function mockSignalStatus(signal: Signal, caseData: CaseData): Status {
  // Trust server-computed signals first if available
  if (caseData.mergedSignals) {
    const serverSignal = caseData.mergedSignals.find((s: any) => s.id === signal.id);
    if (serverSignal) {
      return serverSignal.status as Status;
    }
  }
  
  // Enhanced logic using the new structured data format
  if (signal.id.includes("timing") || signal.id.includes("sch") || signal.id.includes("19h") || signal.id === "on_time_19h") {
    // Check derived metrics from server first
    if (caseData.derived?.target_19h_met !== undefined) {
      return caseData.derived.target_19h_met ? "pass" : "fail";
    }
    
    // Fallback to client-side calculation only if server data unavailable
    const arrivalTime = caseData.events?.arrival || caseData.times?.ArrivalInstant;
    const surgeryTime = caseData.events?.surgery?.start || caseData.times?.IncisionStartInstant;
    
    if (arrivalTime && surgeryTime) {
      const arrival = new Date(arrivalTime);
      const surgery = new Date(surgeryTime);
      const hoursDiff = (surgery.getTime() - arrival.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 19 ? "pass" : "fail";
    }
    
    return "inactive";
  }
  
  if (signal.id.includes("neuro") || signal.id.includes("vascular")) {
    return caseData.clinical?.neurovascular_compromise ? "fail" : "pass";
  }
  
  if (signal.id.includes("open") && signal.id.includes("fracture")) {
    return caseData.clinical?.open_fracture ? "fail" : "pass";
  }
  
  if (signal.id.includes("consult")) {
    return caseData.consults?.ortho ? "pass" : "inactive";
  }
  
  if (signal.id.includes("imaging")) {
    return caseData.imaging?.ct?.performed || caseData.imaging?.xray ? "pass" : "inactive";
  }
  
  if (signal.id.includes("ssi") || signal.id.includes("infection")) {
    return Math.random() > 0.7 ? "caution" : "pass";
  }
  
  return "pass";
}

export default function SCHInlinePanel({
  caseRow,
  caseData,
  projectKey = "USNWR_SCH",
  activeGroupIds,
  onMaximize,
  onConfigure,
  defaultExpanded = false
}: SCHInlinePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { cfg } = usePlanningConfig();
  
  // Get the SCH module from the matrix
  const schModule = USNWR_MATRIX.find((m: any) => m.id === "timeliness_sch");
  if (!schModule) return null;

  // Get planning config for SCH module
  const domainCfg = cfg.domains.find(d => d.domainId === "orthopedics");
  const questionCfg = domainCfg?.questions.find(q => q.questionId === "timeliness_sch");

  // Filter and order groups based on planning config
  const allGroups = schModule.groups || [];
  const visibleGroups = activeGroupIds 
    ? activeGroupIds
    : allGroups.filter((g: string) => questionCfg?.visibleGroups?.[g] !== false);

  // Apply group ordering from planning config
  const orderedGroups = questionCfg?.groupOrder 
    ? questionCfg.groupOrder.filter(g => visibleGroups.includes(g))
    : visibleGroups;

  return (
    <Card className="w-full border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-medium">
              {caseRow.name} (MRN: {caseRow.mrn})
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Age {caseRow.age}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            {onConfigure && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onConfigure}
                className="h-8 w-8 p-0"
                title="Configure visibility"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {onMaximize && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onMaximize}
                className="h-8 w-8 p-0"
                title="Maximize view"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {orderedGroups.map((groupName: string) => {
              // Get active signals from mergedSignals for this group
              const mergedSignals = caseData.mergedSignals || [];
              const activeSignalsInGroup = mergedSignals
                .filter((s: any) => s.group === groupName && s.status !== 'inactive');
              
              // Only show active signals by default - no fallback to static catalog
              const displaySignals = activeSignalsInGroup;
              
              // Apply field ordering if available
              const fieldOrder = questionCfg?.fieldOrder?.[groupName];
              const orderedSignals = fieldOrder
                ? (fieldOrder
                    .map(fieldId => displaySignals.find((s: any) => s.id === fieldId || s.label === fieldId))
                    .filter(Boolean) as any[])
                    .concat(displaySignals.filter((s: any) => !fieldOrder.includes(s.id) && !fieldOrder.includes(s.label)))
                : displaySignals;
              
              // Only render groups that have active signals
              if (activeSignalsInGroup.length === 0) return null;
              
              return (
                <div key={groupName} className="border rounded-lg p-3 bg-slate-50">
                  <div className="font-bold text-slate-800 text-base mb-1">
                    {groupName} 
                    <span className="font-normal text-slate-600">
                      · {activeSignalsInGroup.length} active signals
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Core fields get special treatment */}
                    {groupName === "Core" && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="font-medium">MRN:</span> {caseData.patient?.mrn || caseRow.mrn}</div>
                        <div><span className="font-medium">Age:</span> {caseData.patient?.age || caseRow.age}y</div>
                        <div><span className="font-medium">CSN:</span> {caseData.encounter?.id || caseData.id}</div>
                        <div><span className="font-medium">Location:</span> {caseData.encounter?.location || "ED"}</div>
                      </div>
                    )}
                    
                    {/* Signal badges - only active AI signals */}
                    <div className="flex flex-wrap gap-2">
                      {orderedSignals.map((signal: any) => {
                        if (!signal) return null;
                        const status = signal.status || mockSignalStatus(signal, caseData);
                        
                        return (
                          <Badge
                            key={signal.id}
                            variant="outline"
                            className={`text-xs border ${getStatusColor(status)}`}
                            title={signal.tooltip || signal.definition}
                          >
                            {signal.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Enhanced timing and clinical summary for SCH cases */}
            {(caseData.events || caseData.times) && (
              <div className="border rounded-lg p-3 bg-blue-50">
                <div className="text-xs font-semibold text-blue-700 mb-2">CASE SUMMARY</div>
                <div className="text-xs space-y-1">
                  {/* Timing information */}
                  {(caseData.events?.arrival || caseData.times?.ArrivalInstant) && (
                    <div>Arrival: {new Date(caseData.events?.arrival || caseData.times?.ArrivalInstant || '').toLocaleString()}</div>
                  )}
                  {caseData.events?.consult?.ortho && (
                    <div>Ortho Consult: {new Date(caseData.events.consult.ortho).toLocaleString()}</div>
                  )}
                  {(caseData.events?.surgery?.start || caseData.times?.IncisionStartInstant) && (
                    <div>Surgery: {new Date(caseData.events?.surgery?.start || caseData.times?.IncisionStartInstant || '').toLocaleString()}</div>
                  )}
                  
                  {/* Derived metrics - Time to Surgery with accurate calculation */}
                  {(() => {
                    const arrISO = caseData?.times?.ArrivalInstant || caseData?.events?.arrival;
                    const incISO = caseData?.times?.IncisionStartInstant || caseData?.events?.surgery?.start;

                    const dMin = deltaMinutes(arrISO, incISO);
                    const onTime = dMin != null ? dMin <= 19 * 60 : null;
                    const comparatorText =
                      dMin == null
                        ? "—"
                        : `${fmtHours1dp(dMin)} ${onTime ? "≤" : ">"} 19h ${onTime ? "✓" : "✗"}`;

                    return dMin != null ? (
                      <div className="font-medium">
                        Time to Surgery: {comparatorText}
                      </div>
                    ) : null;
                  })()}
                  
                  {/* Clinical flags */}
                  {caseData.clinical && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="font-medium">Clinical:</div>
                      <div>• Neurovascular: {caseData.clinical.neurovascular_compromise ? 'Compromise noted' : 'Intact'}</div>
                      <div>• Open fracture: {caseData.clinical.open_fracture ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                  
                  {/* Delay summary */}
                  {caseData.notes?.delay_summary && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="font-medium">Delay Factors:</div>
                      <div className="text-slate-700">{caseData.notes.delay_summary}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}