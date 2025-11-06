import { useState, useEffect, useCallback, useRef } from "react";

export interface PromptVersion {
  id: string;
  content: string;
  created: Date;
}

export interface Prompt {
  id: string;
  specialty: string;
  question: string;        // legacy key
  description?: string;
  currentVersionId: string;
  versions: PromptVersion[];
  type?: "abstraction_help" | "signal_processing" | "automapper"; // NEW
  moduleId?: string;                               // optional, for module scoping
}

// Initial prompts based on USNWR Abstraction PromptStore (Unified, Dynamic Prompts)
const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: "sch-timeliness-ortho",
    specialty: "Orthopedics",
    question: "SCH Timeliness",
    description: "SCH Timeliness abstraction for ≤19h target assessment",
    currentVersionId: "v1",
    type: "abstraction_help",
    moduleId: "timeliness_sch",
    versions: [
      {
        id: "v1",
        content: `You are an abstraction assistant for USNWR Pediatric Orthopedics.
Module: Supracondylar Humerus (SCH) Timeliness

Task:
- If no follow-up selected → determine if surgery was within ≤19h from ED arrival.
- If a follow-up is selected → answer that specific question (e.g., NPO violation, CT delay).

Output:
- Result/Finding: {Meets ≤19h target ✅ / Exceeds >19h ✗ / Not documented}
- Reason: {≤10 words, metric-focused}
- Evidence: [timestamps or note excerpts]

Rules:
- Be concise (≤3 lines).
- No speculation.
- Only documented events count.`,
        created: new Date(),
      },
    ],
  },
  {
    id: "sch-signal-processing-ortho",
    specialty: "Orthopedics",
    question: "SCH Signal Processing",
    description: "SCH Signal Processing for AI-driven signal analysis",
    currentVersionId: "v1",
    type: "signal_processing",
    moduleId: "timeliness_sch",
    versions: [
      {
        id: "v1",
        content: `System:
You are a clinical abstraction assistant. Task: compute and return SCH signal statuses.

Module: Timeliness – SCH (≤19h)
Signal IDs (use only these): on_time_19h, dx_confirmed_sch,
npo_violation, extra_testing, resource_delay, multi_procedure_same_session,
non_op_or_elective, miscode_possible.

Rules:
- Compute ArrivalInstant → IncisionStartInstant in minutes.
- Status policy: pass/caution/fail/inactive.
- on_time_19h: pass if ≤1140 min; fail if >1140; caution if incision missing.
- Set delay/documentation/ruleout signals ONLY if explicitly documented in notes.
- Evidence must include numeric comparator when applicable (e.g., "19.1h > 19h ✗").
- Cite minimally: ["times.ArrivalInstant"] or ["notes[1]"].

Inputs (JSON you will receive):
{ specialty, moduleId, moduleSignals[], patient:{ times, notes, ... } }

Output (strict JSON):
{
  "signals":[
    { "id":"on_time_19h","status":"pass|fail|caution|inactive","evidence":"...", "cites":["..."] }
  ],
  "category_counts": { "fail":n, "caution":n, "pass":n, "inactive":n }
}`,
        created: new Date(),
      },
    ],
  },
  {
    id: "sch-delay-ortho",
    specialty: "Orthopedics",
    question: "SCH Delay Summary",
    description: "SCH Delay Drivers analysis for surgery delays",
    currentVersionId: "v1",
    type: "abstraction_help",
    moduleId: "timeliness_sch",
    versions: [
      {
        id: "v1",
        content: `You are an abstraction assistant for USNWR Pediatric Orthopedics.
Module: SCH Delay Drivers

Task:
- If no follow-up selected → summarize major driver(s) of surgery delay.
- If a follow-up is selected → explain that factor (e.g., imaging, transfer, consent, system/OR availability, NPO violation).

Output:
- Result/Finding: {Driver identified / No driver / Not documented}
- Reason: {≤10 words, metric-focused}
- Evidence: [timestamps or note excerpts]

Rules:
- Mention only drivers supported by evidence.
- ≤3 lines total.`,
        created: new Date(),
      },
    ],
  },
  {
    id: "ssi-assessment-ortho",
    specialty: "Orthopedics",
    question: "SSI Assessment",
    description: "Surgical Site Infection assessment using NHSN criteria",
    currentVersionId: "v1",
    type: "abstraction_help",
    moduleId: "ssi_assessment",
    versions: [
      {
        id: "v1",
        content: `You are an abstraction assistant for USNWR Infection Prevention.
Module: Surgical Site Infection (SSI)

Task:
- If no follow-up selected → determine if SSI present and meets NHSN criteria (superficial/deep/organ-space).
- If a follow-up is selected → address that (e.g., deep vs superficial, rule-out, culture evidence).

Output:
- Result/Finding: {Yes / No / Rule-out / Not documented}
- Reason: {≤10 words, infection-related}
- Evidence: [note excerpts, operative findings, culture results]

Rules:
- Use NHSN definitions.
- Be concise, evidence-grounded.`,
        created: new Date(),
      },
    ],
  },
  {
    id: "return-to-or-ortho",
    specialty: "Orthopedics",
    question: "Return to OR",
    description: "Return to OR within 30 days assessment",
    currentVersionId: "v1",
    type: "abstraction_help",
    moduleId: "return_to_or",
    versions: [
      {
        id: "v1",
        content: `You are an abstraction assistant for USNWR Pediatric Orthopedics.
Module: Return to OR within 30 days

Task:
- If no follow-up selected → check if patient returned to OR in 30 days (exclude planned/staged).
- If a follow-up is selected → explain reason (infection, implant issue, loss of fixation, other).

Output:
- Result/Finding: {Yes / No / Not documented}
- Reason: {≤10 words, procedure-related}
- Evidence: [operative notes, scheduling events]

Rules:
- Only OR events count.
- Be concise and specific.`,
        created: new Date(),
      },
    ],
  },
  {
    id: "neurovascular-injury-ortho",
    specialty: "Orthopedics",
    question: "Neurovascular Injury",
    description: "Neurovascular injury assessment post-operatively",
    currentVersionId: "v1",
    type: "abstraction_help",
    moduleId: "neurovascular_injury",
    versions: [
      {
        id: "v1",
        content: `You are an abstraction assistant for USNWR Pediatric Orthopedics.
Module: Neurovascular Injury

Task:
- If no follow-up selected → determine if any neurovascular injury was documented (post-op vs baseline).
- If a follow-up is selected → specify type (nerve palsy, vascular compromise).

Output:
- Result/Finding: {Yes / No / Not documented}
- Reason: {≤10 words, neuro/vascular-specific}
- Evidence: [exam notes, imaging, consult notes]

Rules:
- Do not speculate.
- Report only what's documented.`,
        created: new Date(),
      },
    ],
  },
  {
    id: "automapper-ortho-sch",
    specialty: "Orthopedics",
    question: "AutoMapper for Timeliness – SCH (≤19h)",
    description: "Suggest signals, groups, 20/80 fields, tableLayouts, fieldToSignal, and followups from a sample payload.",
    currentVersionId: "v1",
    type: "automapper",
    moduleId: "timeliness_sch",
    versions: [
      {
        id: "v1",
        content: `System:
You output STRICT JSON only. Given module info, registry groups, and a flattened sample payload, propose: paths, fieldOrder.Core, tableLayouts, signals (with group, triggers, citesHint), fieldToSignal, followups, visibleGroups, groupOrder. Be conservative and align to USNWR logic. Prefer high-signal features.

User:
Specialty: Orthopedics
Module: timeliness_sch (Timeliness – SCH ≤19h)
USNWR Question: Was surgery ≤19h from ED arrival? If delayed, justified?
Groups: ["Core","Delay Drivers","Documentation","Ruleouts"]
Flattened paths: {{FLATTENED_PATHS_JSON}}
Return keys: paths, fieldOrder.Core, tableLayouts, signals, fieldToSignal, followups, visibleGroups, groupOrder`,
        created: new Date(),
      },
    ],
  },
];

const STORAGE_KEY = "usnwr-prompt-store";

function loadFromStorage(): Prompt[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("loadFromStorage: found", parsed.length, "prompts in storage");
      
      // Convert date strings back to Date objects and ensure backward compatibility
      const migrated = parsed.map((p: any) => ({
        ...p,
        type: p.type ?? "abstraction_help", // ensure all prompts have a type
        moduleId: p.moduleId ?? p.question?.toLowerCase().replace(/\s+/g, '_'), // derive moduleId if missing
        versions: p.versions.map((v: any) => ({
          ...v,
          created: new Date(v.created),
        })),
      }));
      
      return migrated;
    }
  } catch (error) {
    console.warn("Failed to load prompts from storage:", error);
  }
  console.log("loadFromStorage: no storage found, returning defaults");
  return DEFAULT_PROMPTS;
}

function saveToStorage(prompts: Prompt[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch (error) {
    console.warn("Failed to save prompts to storage:", error);
  }
}

export function usePromptStore() {
  const [prompts, setPrompts] = useState<Prompt[]>(() => {
    // Initialize with cached data immediately to avoid loading delay
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        console.log("Loading cached prompts:", cached.substring(0, 200) + "...");
        const parsed = JSON.parse(cached);
        console.log("Parsed prompts count:", parsed.length);
        
        // Migrate existing prompts and ensure essential defaults exist
        const migrated = parsed.map((p: any) => ({
          ...p,
          type: p.type ?? "abstraction_help", // default for backward compatibility
          moduleId: p.moduleId ?? 
            (p.question === "SCH Timeliness" ? "timeliness_sch" : 
             p.question?.toLowerCase().replace(/\s+/g, '_')), // specific mapping for SCH
          versions: p.versions.map((v: any) => ({
            ...v,
            created: new Date(v.created),
          })),
        }));
        
        // Ensure the Signal Processing prompt exists for SCH Timeliness
        const hasSignalProcessingSCH = migrated.some((p: Prompt) => 
          p.specialty === "Orthopedics" && 
          p.moduleId === "timeliness_sch" && 
          p.type === "signal_processing"
        );
        
        if (!hasSignalProcessingSCH) {
          console.log("Adding missing Signal Processing prompt for SCH");
          const signalPrompt = DEFAULT_PROMPTS.find(p => p.type === "signal_processing");
          if (signalPrompt) {
            migrated.push({...signalPrompt});
          }
        }
        
        console.log("Migrated prompts:", migrated.map((p: Prompt) => `${p.specialty}-${p.question} (${p.type})`));
        return migrated;
      }
    } catch (error) {
      console.warn("Failed to load cached prompts:", error);
    }
    
    console.log("No cached prompts, using defaults:", DEFAULT_PROMPTS.length);
    return DEFAULT_PROMPTS;
  });

  // Debounced save to storage to reduce localStorage writes
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (prompts.length > 0) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce saves to reduce localStorage operations
      saveTimeoutRef.current = setTimeout(() => {
        saveToStorage(prompts);
      }, 100);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [prompts]);

  const createPrompt = useCallback((
    specialty: string,
    question: string,
    description: string,
    content: string,
    type: "abstraction_help" | "signal_processing" = "abstraction_help",
    moduleId?: string
  ) => {
    const newPrompt: Prompt = {
      id: `${specialty}-${question}-${Date.now()}`.toLowerCase().replace(/\s+/g, '-'),
      specialty,
      question,
      description,
      currentVersionId: "v1",
      versions: [
        {
          id: "v1",
          content,
          created: new Date(),
        },
      ],
      type,
      moduleId,
    };
    setPrompts(prev => [...prev, newPrompt]);
    return newPrompt;
  }, []);

  const updatePrompt = useCallback((id: string, updates: Partial<Prompt>) => {
    setPrompts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const deletePrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  const addVersion = useCallback((promptId: string, content: string) => {
    setPrompts(prev =>
      prev.map(p => {
        if (p.id !== promptId) return p;
        const newVersionId = `v${p.versions.length + 1}`;
        const newVersion: PromptVersion = {
          id: newVersionId,
          content,
          created: new Date(),
        };
        return {
          ...p,
          versions: [...p.versions, newVersion],
          currentVersionId: newVersionId,
        };
      })
    );
  }, []);

  const setCurrentVersion = useCallback((promptId: string, versionId: string) => {
    setPrompts(prev =>
      prev.map(p =>
        p.id === promptId ? { ...p, currentVersionId: versionId } : p
      )
    );
  }, []);

  // Legacy function for backward compatibility
  const getPromptForQuestion = useCallback((specialty: string, question: string): Prompt | undefined => {
    return prompts.find(p => p.specialty === specialty && p.question === question);
  }, [prompts]);

  // New typed resolver
  const getPrompt = useCallback((params:
    | { specialty: string; question: string }                                  // legacy
    | { specialty: string; moduleId: string; type?: Prompt["type"] }           // new
  ): Prompt | undefined => {
    if ("question" in params) {
      return prompts.find(p => p.specialty === params.specialty && p.question === params.question);
    }
    
    const { specialty, moduleId, type } = params;
    const typed = prompts.find(p => p.specialty === specialty && p.moduleId === moduleId && (!type || p.type === type));
    if (typed) return typed;
    
    // fallback → any prompt for this moduleId, else legacy by question title
    return prompts.find(p => p.specialty === specialty && p.moduleId === moduleId) ??
           prompts.find(p => p.specialty === specialty && p.question === moduleId);
  }, [prompts]);

  const bulkUpdateVersions = useCallback((updates: Array<{ promptId: string; versionId: string; content: string }>) => {
    setPrompts(prev =>
      prev.map(p => {
        const update = updates.find(u => u.promptId === p.id);
        if (!update) return p;
        
        return {
          ...p,
          versions: p.versions.map(v =>
            v.id === update.versionId ? { ...v, content: update.content } : v
          ),
        };
      })
    );
  }, []);

  const reorderPrompts = useCallback((reorderedPrompts: Prompt[]) => {
    setPrompts(reorderedPrompts);
  }, []);

  return {
    prompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    addVersion,
    setCurrentVersion,
    getPromptForQuestion,
    getPrompt,
    bulkUpdateVersions,
    reorderPrompts,
  };
}