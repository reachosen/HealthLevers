import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Maximize2, Settings } from "lucide-react";
import { USNWR_MATRIX, signalsByGroup, type Signal } from "@/types/usnwrMatrix";
import { usePlanningConfig } from "@/lib/planningConfig";
import { calculateTimeStatus, formatTimeDelta, getTargetDisplay, getTimeRule } from "@/lib/timeRules";

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

export type ModuleInlinePanelProps = {
  moduleId: string;  // "timeliness_sch", "ssi_assessment", etc.
  caseRow: CaseRow;
  caseData: CaseData;
  projectKey?: string;
  activeGroupIds?: string[]; // pass filtered groups from planning config
  onMaximize?: () => void;
  onConfigure?: () => void;
  defaultExpanded?: boolean;
};

type Status = "pass" | "fail" | "caution" | "inactive";

// Time rules now imported from centralized configuration

function getChipStyle(status: Status): string {
  switch (status) {
    case "pass": return "bg-green-100 text-green-800 border-green-200";
    case "fail": return "bg-red-100 text-red-800 border-red-200";
    case "caution": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "inactive": return "bg-gray-100 text-gray-600 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function ModuleInlinePanel({
  moduleId,
  caseRow,
  caseData,
  projectKey = "default",
  activeGroupIds,
  onMaximize,
  onConfigure,
  defaultExpanded = true
}: ModuleInlinePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { cfg } = usePlanningConfig();
  
  // Get the module from the matrix
  const moduleConfig = USNWR_MATRIX.find((m: any) => m.id === moduleId);
  if (!moduleConfig) return null;

  // Get planning config for this module
  const domainCfg = cfg.domains.find(d => d.domainId === "orthopedics");
  const questionCfg = domainCfg?.questions.find(q => q.questionId === moduleId);

  // Filter and order groups based on planning config
  const allGroups = moduleConfig.groups || [];
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
          <div className="space-y-4">
            {/* Time calculation section - using centralized rules */}
            {getTimeRule(moduleId) && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs font-medium text-slate-700 mb-2">
                  {moduleConfig.title || moduleConfig.name} - {getTimeRule(moduleId)?.description}
                </div>
                {(() => {
                  const timeResult = calculateTimeStatus(moduleId, caseData);
                  
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge 
                        variant={
                          timeResult.status === "pass" ? "default" :
                          timeResult.status === "warning" ? "secondary" : "destructive"
                        } 
                        className="text-xs"
                      >
                        {formatTimeDelta(timeResult.deltaMin)}
                      </Badge>
                      <span className="text-slate-600">
                        (Target: {getTargetDisplay(moduleId)})
                      </span>
                      {timeResult.deltaMin !== null && (
                        <span className={`text-xs ${
                          timeResult.status === "pass" ? 'text-green-600' :
                          timeResult.status === "warning" ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {timeResult.targetMet ? '✓ Met' : '✗ Exceeded'}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Signal groups */}
            {orderedGroups.map((groupName: string) => {
              const groupSignals = signalsByGroup(moduleConfig)[groupName] || [];
              if (!groupSignals.length) return null;

              return (
                <div key={groupName} className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 border-b border-slate-200 pb-1">
                    {groupName}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {groupSignals.map((signal: Signal) => {
                      // Default to inactive status - would be overridden by actual signal processing
                      const status: Status = "inactive";
                      
                      return (
                        <div 
                          key={signal.id}
                          className={`px-2 py-1 rounded text-xs border ${getChipStyle(status)}`}
                        >
                          {signal.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Module-specific notes section */}
            {caseData.notes?.delay_summary && moduleId === "timeliness_sch" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-800 mb-1">
                  Delay Analysis
                </div>
                <div className="text-sm text-amber-700">
                  <div className="font-medium">Delay Factors:</div>
                  <div className="text-slate-700">{caseData.notes.delay_summary}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Legacy export for backward compatibility
export const SCHInlinePanel = (props: Omit<ModuleInlinePanelProps, 'moduleId'>) => (
  <ModuleInlinePanel moduleId="timeliness_sch" {...props} />
);

export default ModuleInlinePanel;