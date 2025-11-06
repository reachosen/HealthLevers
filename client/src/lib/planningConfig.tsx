import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Visibility = Record<string, boolean>; // groupId -> visible
export type QuestionConfig = {
  questionId: string;
  questionLabel: string;
  visibleGroups: Visibility;
  groupOrder?: string[];
  fieldOrder?: Record<string, string[]>;
  paths?: Record<string, string>; // fieldKey -> dotPath mapping for XML/JSON payloads
  followups?: string[]; // anticipated follow-up questions for LLM seeding
  signals?: SignalConfig[]; // signal definitions with triggers and evidence hints
  tableLayouts?: TableLayout[]; // table configuration for UI rendering
  fieldToSignal?: FieldSignalMapping[]; // mapping between fields and their related signals
};

// New types for AutoMapper functionality
export type SignalConfig = {
  id: string;
  label: string;
  group: string;
  triggers?: TriggerConfig[];
  citesHint?: string[]; // suggested evidence paths
};

export type TriggerConfig = {
  type: 'deltaLTE' | 'deltaBetween' | 'textContains' | 'notMatches' | 'pathExists' | 'countInWindow';
  start?: string; // for delta triggers
  end?: string; // for delta triggers  
  minutes?: number; // for deltaLTE
  min?: number; // for deltaBetween
  max?: number; // for deltaBetween
  path?: string; // for text/path triggers
  any?: string[]; // for textContains
  regex?: string; // for notMatches
  hours?: number; // for countInWindow
  gt?: number; // for countInWindow
};

export type TableLayout = {
  id: string;
  title: string;
  fields: string[];
  group?: string;
};

export type FieldSignalMapping = {
  field: string;
  signals: string[];
  group: string;
};
export type DomainConfig = {
  domainId: string;
  domainLabel: string;
  questions: QuestionConfig[];
};
export type PlanningConfig = { version: 1; domains: DomainConfig[] };

const STORAGE_KEY = "planning_config_v1";

function loadConfig(): PlanningConfig | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveConfig(cfg: PlanningConfig) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }

const Ctx = createContext<{ cfg: PlanningConfig; setCfg: (c: PlanningConfig) => void; version: number } | null>(null);

const defaultSeedConfig: PlanningConfig = {
  version: 1,
  domains: [
    {
      domainId: "orthopedics",
      domainLabel: "Orthopedics (Pediatric)",
      questions: [
        {
          questionId: "timeliness_sch",
          questionLabel: "Timeliness – SCH (≤19h)",
          visibleGroups: {
            "Core": true,
            "Delay Drivers": true,
            "Documentation": true,
            "Ruleouts": true
          },
          groupOrder: ["Core", "Delay Drivers", "Documentation", "Ruleouts"],
          fieldOrder: {
            "Core": [
              "PatientMRN", "PatientName", "AgeYears", "CSN",
              "ED_Arrival", "SurgStart", "SurgEnd",
              "TargetHours", "HoursToSurgery", "TimelyFlag"
            ]
          },
          paths: {
            "PatientMRN": "patient.mrn",
            "PatientName": "patient.name",
            "AgeYears": "patient.age",
            "CSN": "encounter.id",
            "ED_Arrival": "times.ArrivalInstant",
            "SurgStart": "times.IncisionStartInstant",
            "SurgEnd": "times.ProcedureEndInstant"
          },
          followups: [
            "Does the operative report confirm SCH?",
            "Any miscoding or DX/OP mismatch?",
            "Higher-priority injuries that justified delay?"
          ],
          signals: [
            {
              id: "on_time_19h",
              label: "Incision ≤19h of ED arrival",
              group: "Core",
              triggers: [{
                type: "deltaLTE",
                start: "times.ArrivalInstant",
                end: "times.IncisionStartInstant",
                minutes: 1140
              }],
              citesHint: ["times.ArrivalInstant", "times.IncisionStartInstant"]
            }
          ],
          tableLayouts: [
            {
              id: "core_summary",
              title: "Core Summary",
              fields: ["PatientMRN", "PatientName", "AgeYears", "CSN", "ED_Arrival", "SurgStart", "SurgEnd", "TargetHours", "HoursToSurgery", "TimelyFlag"],
              group: "Core"
            }
          ]
        }
      ]
    }
  ]
};

export function PlanningProvider({ children, seed }: { children: React.ReactNode; seed?: PlanningConfig }) {
  const [cfg, setCfg] = useState<PlanningConfig>(() => loadConfig() ?? seed ?? defaultSeedConfig);
  const [version, setVersion] = useState(0);
  
  const wrappedSetCfg = (newCfg: PlanningConfig) => {
    setCfg(newCfg);
    setVersion(v => v + 1);
  };
  
  useEffect(() => { saveConfig(cfg); }, [cfg]);
  const value = useMemo(() => ({ cfg, setCfg: wrappedSetCfg, version }), [cfg, version]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanningConfig() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlanningConfig must be used within PlanningProvider");
  return ctx;
}

export function upsertDomain(cfg: PlanningConfig, d: DomainConfig): PlanningConfig {
  const others = cfg.domains.filter(x => x.domainId !== d.domainId);
  return { ...cfg, domains: [...others, d].sort((a,b)=>a.domainLabel.localeCompare(b.domainLabel)) };
}
export function upsertQuestion(d: DomainConfig, q: QuestionConfig): DomainConfig {
  const others = d.questions.filter(x => x.questionId !== q.questionId);
  return { ...d, questions: [...others, q].sort((a,b)=>a.questionLabel.localeCompare(b.questionLabel)) };
}

// Helper for array reordering
export function moveArrayItem<T>(arr: T[], fromIndex: number, delta: number): T[] {
  const toIndex = fromIndex + delta;
  if (toIndex < 0 || toIndex >= arr.length) return arr;
  const newArr = [...arr];
  const [item] = newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, item);
  return newArr;
}

// Helper to get planning config for a specific domain and module
export function getPlanningConfig(cfg: PlanningConfig, domainId: string, moduleId?: string): QuestionConfig | null {
  if (!moduleId) return null;
  const domain = cfg.domains.find(d => d.domainId === domainId);
  return domain?.questions.find(q => q.questionId === moduleId) ?? null;
}