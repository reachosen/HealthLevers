// home.tsx
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  USNWR_MATRIX,
  listModules,
  listGroups,
  signalsByGroup,
  type Module,
  type Signal,
} from "@/types/usnwrMatrix";
import { usePlanningConfig, getPlanningConfig } from "@/lib/planningConfig";
import { PromptPlayProvider, PromptPlayDrawer, PromptPlayTrigger } from "@/components/PromptPlay";
import { usePromptStore } from "@/lib/promptStore";
import { buildDefaultPrompt } from "@/lib/promptTemplates";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  getModulesForSpecialty,
} from "@/data/specialtyMetadata";
import ModuleInlinePanel from "@/components/ModuleInlinePanel";
// Panel imports moved to App.tsx
import EvidenceAssist from "@/components/EvidenceAssist";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import CollapsibleGroup from "@/components/ui/CollapsibleGroup";
import ChipButton from "@/components/ui/ChipButton";
import { withLocalStore, withStaticConfig, withComputed, recordOnce, enableProvenance, isProvEnabled } from "@/lib/provenance";
import { ApiLoader, UrlParams, SpecialtyMemory, type CaseData } from "@/lib/apiLoader";
import { generateJoinReport } from "@/lib/signalCanonicalizer";
import { SourceTag } from "@/components/SourceTag";

import { HelpCircle, Info } from "lucide-react";
import sampleSCH from "@/data/sampleCase.USNWR_SCH.json";
import demoCases from "@/data/testCases.json";
import { ORTHO_SIGNALS, getSignalsForModule, getSignalGroups, getFollowupsForSignal, MODULE_NAME_MAPPING } from "@/data/orthoSignalMatrix";
import { mapIntakeToAbstractionModuleId, debugModuleMappings } from "@/data/moduleIdMapping";
import { migrateProcessedCase } from "@/lib/caseDataMigration";

// Defensive date utilities
function fmtISO(v?: string) {
  if (!v || typeof v !== 'string') return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { hour12: false });
}

function safeDeltaHours(a?: string, b?: string) {
  if (!a || !b) return null;
  const A = new Date(a), B = new Date(b);
  if ([A,B].some(x => Number.isNaN(x.getTime()))) return null;
  return (B.getTime() - A.getTime()) / 36e5;
}

// Signal followup mappings for auto-fill functionality
const SIGNAL_FOLLOWUPS: Record<string, string> = {
  "dx_confirmed": "Does the operative report confirm diagnosis?",
  "possible_miscoding": "Any miscoding of diagnosis/procedure?",
  "borderline_threshold": "Was incision within ≤19h cutoff?",
  "conflicting_timestamps": "Were ED vs OR times conflicting?",
  "comorbidity_delaying_surgery": "Did underlying conditions delay surgery?",
  "higher_priority_injury": "Did another injury take precedence?",
  "non_ortho_admit": "Was admission service non-ortho?",
  "pre_op_npo_violation": "Was there an NPO violation delaying case?",
  "extra_testing_needed_ct": "Did CT/imaging cause delay?",
  "non_ortho_consult_delay": "Did a consult outside ortho cause delay?",
  "multi_procedure_session": "Was this a multi-procedure session?",
  "non_operative_elective_plan": "Was case managed non-op or elective?",
  "or_specialist_unavailable": "Was OR/specialist availability a factor?",
  "open_contaminated_injury": "Was injury open/contaminated?",
  "antibiotics_started_timely": "Were antibiotics started urgently?",
  "stabilization_for_other_injuries": "Did other injuries require stabilization first?",
  "imaging_lab_delay": "Did imaging/labs delay care?",
  "cdc_nhsn_criteria_met": "Did SSI meet CDC/NHSN criteria?",
  "superficial_vs_deep_organ": "Was SSI superficial vs deep/organ?",
  "operative_debridement_done": "Was debridement performed?",
  "planned_staged_return": "Was return a planned staged procedure?",
  "unplanned_return": "Was return unplanned?",
  "fixation_loss": "Was fixation loss documented?",
  "hardware_revised_removed": "Was hardware revised or removed?",
  "pain_wound_cast_problem": "Was revisit for pain/wound/cast issue?",
  "imaging_of_index_site": "Was imaging for index site done?",
  "unrelated_illness": "Was revisit unrelated illness?",
  "scheduled_follow_up_mis_coded": "Was revisit mis-coded scheduled follow-up?",
  "normal_pre_op_exam": "Was pre-op NV exam normal?",
  "new_persistent_deficit": "Was NV deficit persistent?",
  "transient_deficit": "Was NV deficit transient?",
  "vascular_consult_done": "Was vascular consult performed?",
  "rom_loss": "Was there ROM loss?",
  "gait_change": "Was gait change documented?",
  "functional_limitation": "Was functional limitation noted?",
  "assistive_device_still_needed": "Was assistive device still required?",
  "failure_mode_breakage_migration_loosening": "What was implant failure mode?",
  "trauma_vs_gradual": "Was implant failure due to trauma vs gradual?",
  "revision_removal_done": "Was revision/removal performed?",
  "dvt_pe_confirmed": "Was VTE confirmed by imaging?",
  "prophylaxis_ordered": "Was prophylaxis ordered?",
  "prophylaxis_timing_appropriate": "Was prophylaxis timing appropriate?",
  "high_risk_patient_flag": "Was patient high-risk?",
  "clinical_signs_present": "What clinical signs prompted dx?",
  "fasciotomy_performed": "Was fasciotomy performed?",
  "linked_to_index_injury_surgery": "Was compartment syndrome linked to index case?",
  "death_peri_op": "Was death peri-op?",
  "later_death": "Was death later (post-discharge)?",
  "ortho_complication_cause": "Was death due to ortho complication?",
  "palliative_intent_documented": "Was palliative intent documented?",
};

// Helper function for time calculations
function deltaMinutes(aISO?: string, bISO?: string): number | null {
  if (!aISO || !bISO) return null;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

// Follow-up rules (per legacy signal.id). Score: higher = stronger highlight.
const FOLLOWUP_RULES: Record<string, Array<{ text: string; score: number }>> = {
  // SCH Timeliness (≤19h)
  on_time_19h: [
    { text: "Does the operative report confirm SCH?", score: 2 },
    { text: "Any pre-op rule violation (NPO)?", score: 2 },
    { text: "Admitted to non-orthopedic service?", score: 2 },
    { text: "Additional testing (CT/labs) before clearance?", score: 2 },
    { text: "Higher-priority injuries (e.g., head trauma) that justified delay?", score: 1 },
    { text: "Documented delay due to specialist/OR/patient stabilization?", score: 1 },
  ],
  dx_confirmed_sch: [
    { text: "Any miscoding or DX/OP mismatch?", score: 2 },
  ],
  npo_violation: [
    { text: "Any pre-op rule violation (NPO)?", score: 3 },
    { text: "Documented delay due to specialist/OR/patient stabilization?", score: 1 },
  ],
  non_ortho_admit: [
    { text: "Admitted to non-orthopedic service?", score: 3 },
    { text: "Underlying conditions that delayed clearance?", score: 1 },
  ],
  competing_priority: [
    { text: "Higher-priority injuries (e.g., head trauma) that justified delay?", score: 3 },
  ],
  // SSI examples
  clinical_signs_doc: [
    { text: "Which signs (erythema/drainage/fever) were documented and when?", score: 3 },
    { text: "Were cultures obtained? Results?", score: 2 },
  ],
  operative_debridement: [
    { text: "Was return to OR planned vs unplanned?", score: 2 },
  ],
};

// ---------- time helpers ----------

function fmtHours1dp(min: number): string {
  return `${Math.round((min / 60) * 10) / 10}h`;
}

function statusBadge(s?: string): { text: string; cls: string } {
  const x = (s || "").toLowerCase();
  if (x.includes("fail"))   return { text: "✗ FAIL",    cls: "bg-rose-100 text-rose-800 border-rose-200" };
  if (x.includes("pass"))   return { text: "✓ PASS",    cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (x.includes("caution"))return { text: "! CAUTION", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  if (x.includes("planned")||x.includes("ruled")) return { text: "○ CONTROL", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return { text: "—", cls: "bg-slate-100 text-slate-700 border-slate-200" };
}

// ---------- tiny ui bits ----------
function Pill({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-sm border transition",
        active
          ? "bg-lurie-blue text-white border-lurie-blue"
          : "bg-white text-slate-700 border-lurie-blue/30 hover:bg-lurie-blueLight",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// New specialized component for case pills with bucket-specific styling
function CasePill({
  active,
  onClick,
  title,
  children,
  bucketType,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  bucketType: 'needsReview' | 'alwaysReviewed' | 'readyForReview';
}) {
  const getBucketStyles = () => {
    switch (bucketType) {
      case 'needsReview':
        return active
          ? "border-red-500 bg-red-600 text-white"
          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100";
      case 'alwaysReviewed':
        return active
          ? "border-slate-500 bg-slate-600 text-white"
          : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100";
      case 'readyForReview':
        return active
          ? "border-green-500 bg-green-600 text-white"
          : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100";
      default:
        return "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100";
    }
  };

  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-sm font-medium border transition truncate max-w-[200px] ${getBucketStyles()}`}
    >
      {children}
    </button>
  );
}

type Status = "pass" | "fail" | "caution" | "inactive";

// Mock signal status function
function mockSignalStatus(signal: Signal, patientPayload: any): Status {
  // Enhanced logic using the new structured data format
  if (signal.id.includes("timing") || signal.id.includes("sch") || signal.id.includes("19h")) {
    const arrivalTime = patientPayload?.events?.arrival || patientPayload?.times?.ArrivalInstant;
    const surgeryTime = patientPayload?.events?.surgery?.start || patientPayload?.times?.IncisionStartInstant;
    
    if (arrivalTime && surgeryTime) {
      const arrival = new Date(arrivalTime);
      const surgery = new Date(surgeryTime);
      const hoursDiff = (surgery.getTime() - arrival.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 19 ? "pass" : "fail";
    }
    
    // Check derived metrics
    if (patientPayload?.derived?.target_19h_met !== undefined) {
      return patientPayload.derived.target_19h_met ? "pass" : "fail";
    }
    
    return "inactive";
  }
  
  if (signal.id.includes("neuro") || signal.id.includes("vascular")) {
    return patientPayload?.clinical?.neurovascular_compromise ? "fail" : "pass";
  }
  
  if (signal.id.includes("open") && signal.id.includes("fracture")) {
    return patientPayload?.clinical?.open_fracture ? "fail" : "pass";
  }
  
  if (signal.id.includes("consult")) {
    return patientPayload?.consults?.ortho ? "pass" : "inactive";
  }
  
  if (signal.id.includes("imaging")) {
    return patientPayload?.imaging?.ct?.performed || patientPayload?.imaging?.xray ? "pass" : "inactive";
  }
  
  if (signal.id.includes("ssi") || signal.id.includes("infection")) {
    return Math.random() > 0.7 ? "caution" : "pass";
  }
  
  return "pass";
}

// ---------- cases per module (buckets) ----------
type CaseDef = {
  id: string;
  label: string;
  bucket: "needs_review" | "always_reviewed";
};

type CaseStatus = "pass" | "fail" | "caution" | "planned_return" | "ruled_out" | string;

function bucketFromStatus(status?: string): "needs_review" | "always_reviewed" {
  const s = (status ?? "").toLowerCase();
  return (s.includes("planned") || s.includes("ruled") || s.includes("control") || s.includes("pass"))
    ? "always_reviewed"
    : "needs_review";
}

// 1) Build a fast lookup once (top of file, near CASE_STATUS):
const CASE_LOOKUP: Record<string, any> = Object.fromEntries(
  (demoCases as any[]).map(tc => [tc.id, tc])
);

const CASE_STATUS: Record<string, CaseStatus> = Object.fromEntries(
  (demoCases as any).map((tc: any) => [tc.id, (tc.status || "").toLowerCase()])
);

// Build MODULE_CASES dynamically from demoCases
const MODULE_CASES: Record<string, CaseDef[]> = (() => {
  const byModule: Record<string, CaseDef[]> = {};
  (demoCases as any[]).forEach((tc) => {
    const mod = (tc.module || "").trim();
    if (!mod) return;
    if (!byModule[mod]) byModule[mod] = [];
    byModule[mod].push({
      id: tc.id,
      label: tc.label || tc.id,
      bucket: tc.bucket || bucketFromStatus(tc.status),
    });
  });
  return byModule;
})();

// Compute fallback case status from payload
function computeCaseStatusFallback(
  modId?: string | null,
  payload?: any
): "pass" | "fail" | "caution" | "control" | "inactive" {
  if (!modId || !payload) return "inactive";

  if (modId === "timeliness_sch") {
    const m = deltaMinutes(payload?.times?.ArrivalInstant, payload?.times?.IncisionStartInstant);
    if (m == null) return "caution";
    return m <= 19 * 60 ? "pass" : "fail";
  }

  if (modId === "timeliness_other") {
    const dM = deltaMinutes(payload?.times?.ArrivalInstant, payload?.times?.DebridementStart);
    if (dM == null) return "caution";
    return dM <= 24 * 60 ? "pass" : "fail";
  }

  return "inactive";
}

// ---------- patient loader (module + case) ----------
type PatientPayload = Record<string, any>;

// 2) Replace mockPatient with a loader that returns the JSON's patientData
function loadPatientFromCases(moduleId: string, caseId: string): PatientPayload {
  const tc = CASE_LOOKUP[caseId];
  if (!tc) return { id: caseId, times: {}, notes: [] };
  
  // Normalize common shape the app expects
  const payload = { ...(tc.patientData || {}) };
  payload.id = caseId;
  
  // Ensure required fields for inline panel
  payload.patient = payload.patient || {
    mrn: `MRN${caseId.slice(-4)}`,
    name: tc.label?.split(' ')[0] || "Patient",
    age: Math.floor(Math.random() * 10) + 6 // 6-15 years old
  };
  
  payload.encounter = payload.encounter || {
    id: `CSN${Date.now().toString().slice(-6)}`,
    location: "ED",
    disposition: "Admitted"
  };
  
  payload.notes = payload.notes || [];
  payload.times = payload.times || {};
  
  // Add derived metrics for SCH cases if we have timing data
  if (moduleId === "timeliness_sch" && payload.times?.ArrivalInstant && payload.times?.IncisionStartInstant) {
    const arrivalToSurgery = deltaMinutes(payload.times.ArrivalInstant, payload.times.IncisionStartInstant);
    if (arrivalToSurgery !== null) {
      payload.derived = payload.derived || {};
      payload.derived.arrival_to_surgery_min = arrivalToSurgery;
      payload.derived.target_19h_met = arrivalToSurgery <= 19 * 60;
    }
  }
  
  return payload;
}

// EvidenceFollowups component
function EvidenceFollowups({
  allFollowups,
  relevantSet,
  selectedFollowup,
  onToggle
}: {
  allFollowups: string[];
  relevantSet: Set<string>; // labels considered relevant
  selectedFollowup: string | null;
  onToggle: (q: string) => void;
}) {
  const relevant = allFollowups.filter(q => relevantSet.has(q));
  const others = allFollowups.filter(q => !relevantSet.has(q));

  return (
    <div>
      <CollapsibleGroup
        title="Relevant follow‑ups"
        defaultOpen
        count={relevant.length}
      >
        {relevant.length === 0 ? (
          <div className="text-xs text-slate-500 px-1">No relevant questions detected for this signal.</div>
        ) : (
          <div className="followups-grid">
            {relevant.map((q) => {
              const isActive = selectedFollowup === q;
              return (
                <ChipButton
                  key={q}
                  title={q}
                  active={isActive}
                  leftIcon={<HelpCircle className="w-3.5 h-3.5" />}
                  onClick={() => onToggle(q)}
                >
                  {q}
                </ChipButton>
              );
            })}
          </div>
        )}
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Other questions"
        defaultOpen={false}
        count={others.length}
      >
        <div className="followups-grid">
          {others.map((q) => {
            const isActive = selectedFollowup === q;
            return (
              <ChipButton
                key={q}
                title={q}
                active={isActive}
                leftIcon={<Info className="w-3.5 h-3.5" />}
                onClick={() => onToggle(q)}
              >
                {q}
              </ChipButton>
            );
          })}
        </div>
      </CollapsibleGroup>
    </div>
  );
}

// 3) Update usePatient hook to use the loader above
function usePatient(moduleId: string | null, caseId: string | null) {
  const [data, setData] = useState<PatientPayload | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!moduleId || !caseId) { setData(null); setLoading(false); return; }
    setLoading(true);
    
    // Load from new JSON structure with async support
    const loadAsync = async () => {
      try {
        const testCasesData = await import('@/data/all_testcases_dropdown.json');
        const testCase = testCasesData.default.cases?.find((c: any) => c.id === caseId);
        if (testCase?.patient_payload) {
          setData(testCase.patient_payload);
          setLoading(false);
          return;
        }
      } catch {}
      
      // Fall back to legacy system
      const payload = loadPatientFromCases(moduleId, caseId);
      setData(payload);
      setLoading(false);
    };
    
    const t = setTimeout(loadAsync, 120);
    return () => clearTimeout(t);
  }, [moduleId, caseId]);
  return { data, isLoading: loading };
}

// ---------- toy signal engine ----------
function inferStatuses(
  mod: Module,
  patient: PatientPayload | null,
): Record<string, Status> {
  const map: Record<string, Status> = {};
  for (const s of mod.signals) map[s.id] = "inactive";
  if (!patient) return map;

  if (mod.id === "timeliness_sch") {
    const m = deltaMinutes(patient?.times?.ArrivalInstant, patient?.times?.IncisionStartInstant);
    
    // Use the correct signal IDs from the orthopedics matrix
    if (m != null) {
      // Borderline threshold signal - activate if timing is close to 19h cutoff or fails
      const isNear19h = Math.abs(m - 19 * 60) < 60; // within 1 hour of cutoff
      if (isNear19h || m > 19 * 60) {
        map["borderline_threshold"] = m <= 19 * 60 ? "pass" : "fail";
      }
      
      // If timing exceeds 19h, activate delay-related signals
      if (m > 19 * 60) {
        map["comorbidity_delay"] = "caution"; // Potentially delayed for medical reasons
        map["non_ortho_admit"] = "caution"; // Possibly admitted to wrong service
      }
    }
    
    for (const n of patient?.notes ?? []) {
      const t = (n.text as string).toLowerCase();
      if (t.includes("supracondylar")) map["dx_confirmed_sch"] = "pass";
      if (t.includes("juice") || t.includes("npo")) map["npo_violation"] = "fail";
      if (t.includes("ct head") || t.includes("trauma")) map["higher_priority_injury"] = "caution";
      if (t.includes("admitted to pediatrics")) map["non_ortho_admit"] = "caution";
      if (t.includes("staged plan") || t.includes("non-operative")) map["non_operative_plan"] = "pass";
    }
  }

  if (mod.id === "timeliness_other") {
    const dM = deltaMinutes(patient?.times?.ArrivalInstant, patient?.times?.DebridementStart);
    if (dM != null) map["debridement_24h"] = dM <= 24 * 60 ? "pass" : "fail";
    const abxM = deltaMinutes(patient?.times?.ArrivalInstant, patient?.times?.AbxFirstDose);
    if (abxM != null) map["urgent_antibiotics"] = abxM <= 90 ? "pass" : "fail";
    for (const n of patient?.notes ?? []) {
      const t = n.text.toLowerCase();
      if (t.includes("open tibia fracture")) map["open_contaminated"] = "pass";
      if (t.includes("septic arthritis")) map["correct_dx_confirmed"] = "pass";
    }
  }

  if (mod.id === "ssi") {
    const idx = patient?.times?.IndexIncisionStart;
    const culture = patient?.times?.CultureInstant;
    const retOR = patient?.times?.ReturnORInstant;
    if (!idx) {
      map["clinical_signs_doc"] = map["positive_culture"] = map["operative_debridement"] = "caution";
    } else {
      for (const n of patient?.notes ?? []) {
        const t = n.text.toLowerCase();
        if (t.includes("drainage") || t.includes("erythema") || t.includes("purulence")) {
          map["clinical_signs_doc"] = "pass";
        }
      }
      if (culture) map["positive_culture"] = "pass";
      if (retOR) map["operative_debridement"] = "pass";
    }
  }

  if (mod.id === "rto") {
    const d = deltaMinutes(patient?.times?.DischargeInstant, patient?.times?.ReturnORIncision);
    map["return_within_30d"] = d == null ? "caution" : (d <= 30 * 24 * 60 ? "pass" : "fail");
    const planned = (patient?.notes ?? []).some((n: any) => /planned|staged/i.test(n.text));
    map["planned_staged"] = planned ? "pass" : "fail";
    map["unplanned_related"] = planned ? "fail" : "pass";
  }

  if (mod.id === "readmit") {
    const d = deltaMinutes(patient?.times?.DischargeInstant, patient?.times?.ReadmitAdmitInstant);
    map["readmit_7d_30d"] = d == null ? "caution" : (d <= 30 * 24 * 60 ? "pass" : "fail");
    const scheduled = (patient?.notes ?? []).some((n: any) => /scheduled follow-up|suture removal/i.test(n.text));
    map["scheduled_followup"] = scheduled ? "pass" : "fail";
    const related = (patient?.notes ?? []).some((n: any) => /fever|pain|wound/i.test(n.text));
    map["related_cue"] = related ? "pass" : "fail";
  }

  if (mod.id === "neurovascular") {
    const hasPreNormal = (patient?.notes ?? []).some((n: any) => /pre-?op/i.test(n.source) && /normal/i.test(n.text));
    const hasPostAbn = (patient?.notes ?? []).some((n: any) => /post-?op/i.test(n.source) && /(decreased|paresthesia|weak)/i.test(n.text));
    map["pre_normal"] = hasPreNormal ? "pass" : "caution";
    map["post_abnormal"] = hasPostAbn ? "pass" : "caution";
  }

  if (mod.id === "function") {
    const rom = (patient?.flowsheets ?? []).find((f: any) => /elbow rom/i.test(f.name));
    map["numeric_rom"] = rom ? (rom.numeric >= 120 ? "pass" : "fail") : "caution";
    map["cleared_for_sports"] = (patient?.notes ?? []).some((n: any) => /cleared for sports/i.test(n.text)) ? "pass" : "fail";
    map["mal_nonunion_imaging"] = (patient?.notes ?? []).some((n: any) => /malunion|nonunion/i.test(n.text)) ? "pass" : "caution";
  }

  if (mod.id === "vte") {
    const dx = (patient?.notes ?? []).some((n: any) => /dvt|pulmonary embol/i.test(n.text));
    const hasProph = (patient?.mar ?? []).some((m: any) => /(heparin|enoxaparin|apixaban)/i.test(m.name || ""));
    map["vte_dx_imaging"] = dx ? "pass" : "caution";
    map["vte_prophylaxis_given"] = hasProph ? "pass" : "fail";
  }

  if (mod.id === "compartment") {
    const dx = (patient?.notes ?? []).some((n: any) => /compartment syndrome/i.test(n.text));
    const hasCpt = (patient?.cpt ?? []).some((c: any) => /25020|25025|25028|27600|27602|27603/.test(c.code || ""));
    map["dx_text_codes"] = dx ? "pass" : "caution";
    map["fasciotomy_cpt"] = hasCpt ? "pass" : "fail";
  }

  if (mod.id === "mortality") {
    const d = deltaMinutes(patient?.times?.DischargeInstant, patient?.times?.DeathInstant);
    map["expired_30d"] = d == null ? "caution" : (d <= 30 * 24 * 60 ? "pass" : "fail");
    const linked = (patient?.notes ?? []).some((n: any) => /pe after surgery|orthopedic complication/i.test(n.text));
    map["ortho_linked_text"] = linked ? "pass" : "fail";
  }

  return map;
}

// ---------- main ----------
interface HomePageProps {
  selectedSpecialty: string;
  onSpecialtyChange: (specialty: string) => void;
  availableSpecialties?: string[];
}

export default function Home({ 
  selectedSpecialty: propSelectedSpecialty, 
  onSpecialtyChange: propOnSpecialtyChange,
  availableSpecialties = []
}: HomePageProps) {
  // Local state for panels - managed by event listeners
  // Panel state moved to App.tsx for global access
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500); // Wait for 0.5 second before redirecting
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#007DC3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will be redirected to login
  }

  // Check for stored signals from intake flow
  const storedCase = useMemo(() => {
    try {
      // Try abstraction.cases first (where canonicalized signals are saved), fallback to currentCase
      let stored = withLocalStore.get('abstraction.cases');
      let source = 'abstraction.cases';
      
      if (!stored) {
        stored = withLocalStore.get('currentCase');
        source = 'currentCase';
      }
      
      console.log(`Raw localStorage ${source}:`, stored);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed) {
        console.log(`✓ Found stored case from ${source}:`, parsed);
        console.log('Case details:', {
          specialty: parsed.selectedSpecialty,
          module: parsed.selectedModule,
          moduleId: parsed.selectedModuleId, 
          caseId: parsed.selectedCaseId,
          signalsCount: parsed.mergedSignals?.length,
          canonicalizedIds: parsed.mergedSignals?.map((s: any) => s.id) || []
        });
        
        
        // Auto-enable provenance for debugging when case is loaded
        if (!isProvEnabled()) {
          console.log('🔍 Auto-enabling provenance tracking for stored case debugging');
          enableProvenance();
        }
      } else {
        console.log('❌ No stored case found in localStorage');
        console.log('Checking all localStorage keys:', Object.keys(localStorage));
      }
      return migrateProcessedCase(parsed);
    } catch (err) {
      console.error('Error parsing stored case:', err);
      return null;
    }
  }, []);

  // Reviewed cases from intake workflow using consistent storage key
  const reviewedCases = useMemo(() => {
    try {
      const stored = withLocalStore.get('abstraction.cases');
      const parsed = stored ? JSON.parse(stored) : null;
      
      // Migrate case data for compatibility
      const migrated = migrateProcessedCase(parsed);
      
      // Handle both array (old format) and single case (new format)
      if (Array.isArray(migrated)) {
        return migrated.map(migrateProcessedCase);
      } else if (migrated && migrated.readyForReview) {
        return [migrated]; // Convert single case to array format
      }
      
      return [];
    } catch {
      return [];
    }
  }, []);

  // Redirect to intake if no signals are available and no reviewed cases exist
  useEffect(() => {
    // Check for both legacy 'signals' and new 'mergedSignals' properties from AI Signal Intake
    const hasSignals = storedCase && (
      (storedCase.signals && storedCase.signals.length > 0) ||
      (storedCase.mergedSignals && storedCase.mergedSignals.length > 0)
    );
    
    if (!hasSignals && reviewedCases.length === 0) {
      setLocation('/intake');
      return;
    }
  }, [storedCase, setLocation, reviewedCases]);
  const { cfg, version } = usePlanningConfig();
  const { getPromptForQuestion } = usePromptStore();

  // 0) Specialty - dynamic specialty selection from props (managed by App.tsx)
  const [selectedSpecialty, setSelectedSpecialty] = useState(propSelectedSpecialty);
  
  // Sync with parent component
  useEffect(() => {
    setSelectedSpecialty(propSelectedSpecialty);
  }, [propSelectedSpecialty]);
  const domains = [{ id: "orthopedics", name: "Orthopedics (Pediatric)" }];
  const [selectedDomain, setSelectedDomain] = useState("orthopedics");

  // 1) Module (after specialty) — start with null to force explicit selection
  const availableModules = useMemo(() => {
    const modules = getModulesForSpecialty(selectedSpecialty);
    console.log('📊 Available modules for', selectedSpecialty, ':', modules.length, 'modules');
    console.log('📋 Module list:', modules.map(m => m.name));
    return modules;
  }, [selectedSpecialty]);
  // Bootstrap with handoff-first priority
  const bootstrapData = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSpec = urlParams.get("specialty");
    const urlModule = urlParams.get("moduleId");
    const urlCase = urlParams.get("caseId");

    // Priority 1: Handoff from Intake
    const handoff = JSON.parse(withLocalStore.get("intake.handoff") || "{}");
    if (handoff?.specialty && handoff?.moduleId) {
      return { specialty: handoff.specialty, moduleId: handoff.moduleId, caseId: handoff.caseId || null, source: "handoff" };
    }
    
    // Priority 2: URL params
    if (urlSpec && urlModule) {
      return { specialty: urlSpec, moduleId: urlModule, caseId: urlCase || null, source: "url" };
    }
    
    // Priority 3: Memory
    const fallbackSpec = urlSpec || "Orthopedics";
    const memory = SpecialtyMemory.getLastCase(fallbackSpec);
    if (memory?.moduleId) {
      return { specialty: fallbackSpec, moduleId: memory.moduleId, caseId: memory.caseId || null, source: "memory" };
    }
    
    // Priority 4: Default fallback
    return { specialty: fallbackSpec, moduleId: null, caseId: null, source: "default" };
  };

  const boot = bootstrapData();
  const [selectedModuleSimpleId, setSelectedModuleSimpleId] = useState<string | null>(boot.moduleId);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(boot.caseId);

  // Check URL parameters for default panel expansion
  const [defaultPanelExpanded, setDefaultPanelExpanded] = useState(true);
  
  // API-first case state
  const [apiCase, setApiCase] = useState<CaseData | null>(null);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);

  // Hydrate before paint (useLayoutEffect), then build compound only for display
  useLayoutEffect(() => {
    setSelectedSpecialty(boot.specialty);
    
    // Hydrate module and case from bootstrap (intake.handoff priority)
    if (boot.moduleId) {
      setSelectedModuleSimpleId(boot.moduleId);
    }
    if (boot.caseId) {
      setSelectedCaseId(boot.caseId);
    }
    
    console.log('🚀 Bootstrap result:', boot);
    
    // Load case from API if URL has full params
    if (boot.source === 'url' && boot.caseId) {
      loadCaseFromApi(boot.caseId);
    }
    
    // Update URL to reflect current selection
    UrlParams.updateParams({
      specialty: boot.specialty,
      moduleId: boot.moduleId || undefined,
      caseId: boot.caseId || undefined
    });
    
    // Save to specialty memory
    if (boot.moduleId) {
      SpecialtyMemory.setLastCase(boot.specialty, boot.moduleId, boot.caseId || undefined);
    }
    
    // optional: open inline panel by default
    localStorage.setItem("abstraction.inline.expanded.default", "true");
  }, [boot.specialty, boot.moduleId, boot.caseId]);

  // API case loader function
  const loadCaseFromApi = async (caseId: string) => {
    if (!ApiLoader.isServerCasesEnabled()) {
      console.log('Server cases disabled, skipping API load');
      return;
    }

    setIsLoadingCase(true);
    setCaseError(null);
    
    try {
      const caseData = await ApiLoader.getCase(caseId);
      setApiCase(caseData);
      console.log('✅ Loaded case from API:', caseId, caseData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load case';
      setCaseError(message);
      console.error('❌ Failed to load case from API:', error);
    } finally {
      setIsLoadingCase(false);
    }
  };

  // Legacy fallback for stored case (separate effect) - with handoff timestamp check
  useEffect(() => {
    const handoff = JSON.parse(withLocalStore.get("intake.handoff") || "{}");
    const ts = handoff?.timestamp || "none";

    if (didInitFromStore.current === ts) return;
    
    // Fallback to stored case if URL params not available and no API case loaded
    if (storedCase && !apiCase && availableModules.length > 0) {
      console.log('Auto-selecting from stored case:', storedCase);
      
      // Auto-select case ID if not set
      if (!selectedCaseId && storedCase.selectedCaseId) {
        console.log('Auto-selecting case ID:', storedCase.selectedCaseId);
        setSelectedCaseId(storedCase.selectedCaseId);
      }
      
      // Auto-select specialty if it exists and differs from current
      if (storedCase.selectedSpecialty && storedCase.selectedSpecialty !== selectedSpecialty) {
        console.log('Auto-selecting specialty:', storedCase.selectedSpecialty);
        setSelectedSpecialty(storedCase.selectedSpecialty);
        propOnSpecialtyChange(storedCase.selectedSpecialty);
        return; // Return early to let the specialty change trigger module reload
      }
      
      // Try to match by selectedModuleId first (from intake)
      if (storedCase.selectedModuleId) {
        console.log('Trying to match selectedModuleId:', storedCase.selectedModuleId);
        console.log('Available modules:', availableModules.map(m => ({ name: m.name, value: m.value })));
        
        // Use the mapping matrix for exact translation
        const mappedModuleId = mapIntakeToAbstractionModuleId(storedCase.selectedModuleId);
        console.log('Mapped intake ID:', storedCase.selectedModuleId, '→', mappedModuleId);
        
        const exactMatch = availableModules.find(m => m.value === mappedModuleId);
        if (exactMatch) {
          console.log('Found EXACT moduleId match via mapping:', exactMatch.value);
          console.trace('🔍 TRACE: setSelectedModuleSimpleId(EXACT)');
          setSelectedModuleSimpleId(exactMatch.value);
          return;
        }
        
        // Fallback: contains match
        const containsMatch = availableModules.find(m => m.value.includes(storedCase.selectedModuleId));
        if (containsMatch) {
          console.log('Found contains moduleId match:', containsMatch.value);
          console.trace('🔍 TRACE: setSelectedModuleSimpleId(CONTAINS)');
          setSelectedModuleSimpleId(containsMatch.value);
          return;
        }
      }
      
      // Try to match by selectedModule title
      if (storedCase.selectedModule) {
        console.log('Trying to match selectedModule:', storedCase.selectedModule);
        const titleMatch = availableModules.find(m => 
          m.name.toLowerCase().includes(storedCase.selectedModule.toLowerCase()) ||
          storedCase.selectedModule.toLowerCase().includes(m.name.toLowerCase())
        );
        if (titleMatch) {
          console.log('Found title match:', titleMatch.value);
          console.trace('🔍 TRACE: setSelectedModuleSimpleId(TITLE)');
          setSelectedModuleSimpleId(titleMatch.value);
          return;
        }
      }
      
      // Default to first module if nothing matches but we have stored case
      if (availableModules.length > 0) {
        console.log('No matches found, using first available module:', availableModules[0].value);
        console.trace('🔍 TRACE: setSelectedModuleSimpleId(FIRST)');
        setSelectedModuleSimpleId(availableModules[0].value);
      }
      
      didInitFromStore.current = ts;           // fire once per handoff
    }
  }, [availableModules, selectedSpecialty, propOnSpecialtyChange]);

  // Debug when selectedModuleSimpleId changes
  useEffect(() => {
    console.log('[SELECTED CHANGED]', selectedModuleSimpleId);
  }, [selectedModuleSimpleId]);

  // For compatibility with existing USNWR_MATRIX system, we'll still use it for signal data
  // but filter modules based on specialty metadata
  const legacyModules = useMemo(() => listModules(USNWR_MATRIX), []);
  const selectedModule: Module | null = useMemo(() => {
    if (!selectedModuleSimpleId) return null;
    
    // Find legacy module by simple ID mapping
    const specialtyModule = availableModules.find(m => m.value === selectedModuleSimpleId);
    if (!specialtyModule) return null;
    
    // Map to legacy module ID
    let legacyId: string | null = null;
    if (specialtyModule.name === "Timeliness – SCH") {
      legacyId = "timeliness_sch";
    } else if (specialtyModule.name === "SSI Assessment") {
      legacyId = "ssi";
    } else if (specialtyModule.name === "Return to OR") {
      legacyId = "rto";
    } else if (specialtyModule.name === "Neurovascular Injury") {
      legacyId = "neurovascular";
    } else {
      legacyId = specialtyModule.value;
    }
    
    return legacyModules.find((m) => m.id === legacyId) ?? null;
  }, [selectedModuleSimpleId, legacyModules, availableModules]);

  // Resolve the module display name used in PromptStore (e.g., "SCH Timeliness")  
  const moduleDisplayName = selectedModule?.title ?? "";

  // 2) Case (after module) - load from JSON data
  const [allCaseOptions, setAllCaseOptions] = useState<any[]>([]);

  // Debug: Log when selections change
  useEffect(() => {
    console.log('Selection state changed:', {
      selectedSpecialty,
      selectedModuleSimpleId,
      selectedCaseId,
      hasStoredCase: !!storedCase
    });
  }, [selectedSpecialty, selectedModuleSimpleId, selectedCaseId, storedCase]);

  // Auto-select case from stored data if available - wait for module selection
  useEffect(() => {
    if (storedCase && !selectedCaseId && selectedModuleSimpleId) {
      const caseId = storedCase.selectedCaseId || storedCase.caseId || storedCase.id;
      if (caseId) {
        console.log('Auto-selecting case ID:', caseId, 'from stored case');
        setSelectedCaseId(caseId);
      } else {
        console.warn('No case ID found in stored case:', storedCase);
      }
    }
  }, [storedCase, selectedCaseId, selectedModuleSimpleId]);
  
  useEffect(() => {
    import('@/data/cases_dropdown_options.json')
      .then(data => setAllCaseOptions(data.default || []))
      .catch(() => setAllCaseOptions([]));
  }, []);
  
  const moduleCases = useMemo(() => {
    // For the selected module, build { "needs review", "normal", "ready for review" } buckets
    if (!selectedModule) return { needsReview: [], normal: [], readyForReview: [] };
    
    // Find cases for the selected module
    const allCases = allCaseOptions.filter(c => c.module === selectedModule.id);
    
    // Split by bucket type
    const needsReview = allCases.filter(c => c.bucket === "needs_review");
    const normal = allCases.filter(c => c.bucket === "always_reviewed");
    
    // Add cases from intake workflow that are ready for review
    const readyForReview = reviewedCases
      .filter((rc: any) => 
        rc.readyForReview === true && 
        (rc.selectedModule === selectedModule.id || rc.selectedModule === selectedModule.title || rc.selectedModuleId === selectedModule.id)
      )
      .map((rc: any) => ({
        id: rc.selectedCaseId,
        label: `${rc.selectedCaseId} (Intake)`,
        module: selectedModule.id,
        bucket: "ready_for_review",
        reviewedAt: rc.reviewTimestamp,
        reviewedBy: rc.reviewedBy
      }));

    // Also add the current stored case if it exists and isn't already in the lists
    if (storedCase && storedCase.selectedCaseId) {
      const caseId = storedCase.selectedCaseId;
      const isAlreadyInLists = [
        ...needsReview, 
        ...normal, 
        ...readyForReview
      ].some(c => c.id === caseId);
      
      if (!isAlreadyInLists) {
        const intakeCase = {
          id: caseId,
          label: `${caseId} (Current Intake)`,
          module: selectedModule.id,
          bucket: "ready_for_review",
          reviewedAt: storedCase.loadedAt,
          reviewedBy: storedCase.loadedBy || "intake"
        };
        readyForReview.unshift(intakeCase); // Add to the beginning
        console.log('Added intake case to dropdown:', intakeCase);
      }
    }
    
    return { needsReview, normal, readyForReview };
  }, [selectedModule, allCaseOptions, reviewedCases, storedCase]);

  // Patient loads automatically when a case is selected - use stored data only for intake cases
  // Support both new format (patient_payload) and legacy format
  const storedPatientPayload = storedCase?.patient_payload || storedCase?.patientPayload;
  const { data: fallbackPatientPayload, isLoading: patientLoading } = usePatient(
    selectedModule?.id ?? null,
    selectedCaseId,
  );
  
  // Use stored data only if the selected case matches the stored case ID
  const shouldUseStoredData = storedCase && selectedCaseId && (
    storedCase.selectedCaseId === selectedCaseId || 
    storedCase.caseId === selectedCaseId || 
    storedCase.id === selectedCaseId
  );
  
  const patientPayload = shouldUseStoredData ? storedPatientPayload : fallbackPatientPayload;
  
  console.log('📋 Patient Data Selection:', {
    selectedCaseId,
    storedCaseId: storedCase?.selectedCaseId || storedCase?.caseId || storedCase?.id,
    shouldUseStoredData,
    hasStoredData: !!storedPatientPayload,
    hasFallbackData: !!fallbackPatientPayload,
    usingStored: shouldUseStoredData && !!storedPatientPayload
  });

  // 3) Signals & groups - apply planning config filtering
  // For orthopedics modules, use the new ORTHO_SIGNALS matrix
  const allGroups = useMemo(() => {
    if (!selectedModule) return [];
    
    // Use USNWR matrix groups for consistent signal definitions with AI Signal Intake
    return listGroups(selectedModule);
  }, [selectedModule]);

  // Get planning config for current domain and module - with proper reactivity
  const domainCfg = useMemo(
    () => cfg.domains.find((d) => d.domainId === selectedDomain),
    [cfg, selectedDomain],
  );

  const questionCfg = useMemo(() => {
    // Try helper first, fallback to direct lookup
    const byHelper = getPlanningConfig(cfg, selectedDomain, selectedModule?.id);
    if (byHelper) return byHelper;
    return domainCfg?.questions.find(q => q.questionId === selectedModule?.id) ?? null;
  }, [cfg, selectedDomain, selectedModule?.id]);

  // Enhanced groups with virtual "Other" support
  const groups = useMemo(() => {
    if (!questionCfg?.visibleGroups) return allGroups; // default: all ON
    const cfgGroups = allGroups.filter((g) => questionCfg.visibleGroups[g] !== false);
    
    // Add virtual "Other" group for unknown signal groups
    if (patientPayload?.mergedSignals && patientPayload.mergedSignals.length > 0) {
      const signalGroups = new Set((patientPayload.mergedSignals).map((s: any) => s.group).filter(Boolean));
      const unknown = Array.from(signalGroups).filter(g => !allGroups.includes(g));
      return unknown.length ? [...cfgGroups, "Other"] : cfgGroups;
    }
    
    return cfgGroups;
  }, [allGroups, questionCfg, patientPayload?.mergedSignals]);
  
  // Helper to map signal group to display group (handles "Other" mapping)
  const displayGroupOf = (signalGroup?: string) => {
    if (!signalGroup) return "Other";
    return allGroups.includes(signalGroup) ? signalGroup : "Other";
  };

  const [activeGroup, setActiveGroup] = useState<string>("");
  useEffect(() => {
    if (!selectedModule) return setActiveGroup("");
    setActiveGroup(groups[0] ?? "");
  }, [selectedModuleSimpleId, groups]);

  // Use API case first, then stored signals from intake, or fallback to inference
  const statusById = useMemo(() => {
    // Priority 1: API-loaded case data
    if (apiCase && selectedModule) {
      console.log('🔄 Using API case data for status calculation:', apiCase);
      const signalsToUse = apiCase.mergedSignals || [];
      
      if (signalsToUse.length > 0) {
        const statusMap: Record<string, any> = {};
        
        for (const signal of signalsToUse) {
          if (signal.id) {
            statusMap[signal.id] = signal.status;
          }
        }
        
        console.log('🔍 API STATUS MAP:', {
          totalStatuses: Object.keys(statusMap).length,
          statusBreakdown: Object.values(statusMap).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sampleStatuses: Object.entries(statusMap).slice(0, 5).map(([id, status]) => `${id}:${status}`)
        });
        
        return statusMap;
      }
    }

    // Priority 2: localStorage stored case
    if (storedCase && selectedModule) {
      // Support both legacy 'signals' and new 'mergedSignals' from AI Signal Intake
      const signalsToUse = storedCase.mergedSignals || storedCase.signals;
      
      if (signalsToUse && signalsToUse.length > 0) {
        // Generate join diagnostic report for provenance
        const joinReport = generateJoinReport(signalsToUse, selectedModule.signals || []);
        withComputed('status.join.report', () => ({
          missing: joinReport.missing,
          extra: joinReport.extra,
          matched: joinReport.matched,
          totalMerged: signalsToUse.length,
          totalModule: selectedModule.signals?.length || 0,
          uiAnchor: '#prov-tabs',
          page: window.location.pathname
        }), [joinReport]);
        
        // Convert stored signals to status map for compatibility
        const statusMap: Record<string, any> = {};
        
        for (const signal of signalsToUse) {
          // Handle both old format (signal.check) and new format (signal.id, signal.label)
          if (signal.id) {
            // New format from AI Signal Intake - direct mapping
            statusMap[signal.id] = signal.status;
          } else if (signal.check) {
            // Legacy format - find by label match
            const moduleSignal = selectedModule.signals?.find(s => s.label === signal.check);
            if (moduleSignal) {
              statusMap[moduleSignal.id] = signal.status;
            }
          }
        }
        
        // CRITICAL: Verify statusMap contains AI-enriched values, not just defaults
        console.log('🔍 STATUS MAP VERIFICATION - Final statusById:', {
          totalStatuses: Object.keys(statusMap).length,
          statusBreakdown: Object.values(statusMap).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sampleStatuses: Object.entries(statusMap).slice(0, 5).map(([id, status]) => `${id}:${status}`),
          hasAiEnrichedStatuses: Object.values(statusMap).some(s => s !== 'inactive')
        });
        
        return statusMap;
      }
    }
    // Fallback to inference if no stored signals
    return selectedModule ? inferStatuses(selectedModule, patientPayload) : {};
  }, [apiCase, selectedModule, patientPayload, storedCase]);

  // Unified signal sourcing (table + counts) - moved here to be available for countsByGroup
  const signalsForView = useMemo<Signal[]>(() => {
    if (!selectedModule || !activeGroup) return [];
    
    // Use USNWR matrix definitions for consistent IDs with AI Signal Intake
    const signals = signalsByGroup(selectedModule, activeGroup);
    return signals;
  }, [selectedModule, activeGroup]);

  // Calculate counts per group with status breakdown  
  const countsByGroup = useMemo(() => {
    const counts: Record<string, { fail: number; caution: number; pass: number; total: number }> = {};
    if (!selectedModule) return counts;
    
    // Group count computation (provenance tracked in effect)
    
    // Initialize counts for all groups
    groups.forEach(g => counts[g] = { fail: 0, caution: 0, pass: 0, total: 0 });
    
    // Count signals across ALL groups, not just the active one
    for (const group of groups) {
      // Use USNWR matrix definitions for consistent IDs with AI Signal Intake
      const groupSignals = signalsByGroup(selectedModule, group);
      
      for (const s of groupSignals) {
        const st = (statusById as any)[s.id] as Status;
        if (!st || st === "inactive") continue;
        
        // Count by status type
        if (st === "fail") counts[s.group].fail++;
        else if (st === "caution") counts[s.group].caution++;
        else if (st === "pass") counts[s.group].pass++;
        
        counts[s.group].total++;
      }
    }
    
    // Enhanced provenance for group counts debugging
    withComputed('computed:group.counts', () => ({
      counts,
      activeGroups: Object.keys(counts).filter(g => counts[g].total > 0),
      totalActiveSignals: Object.values(counts).reduce((sum, c) => sum + c.total, 0),
      uiAnchor: '#group-tabs'
    }), [counts]);
    
    return counts;
  }, [groups, selectedModule, selectedSpecialty, statusById]);

  // Focused signal + prompt + LLM
  const [focusedSignal, setFocusedSignal] = useState<Signal | null>(null);
  // Inline evidence state (PR3)
  const [inlineEvidence, setInlineEvidence] = useState(true); // Feature flag ON
  const [evidenceMode, setEvidenceMode] = useState<'scoped' | 'full'>('scoped');
  // Follow-up chips state (PR4)
  const [followupChips, setFollowupChips] = useState(true); // Feature flag ON

  // Pick follow-ups for focused signal; weight by FAIL>CAUTION>PASS.
  const weightedFollowups = useMemo(() => {
    if (!focusedSignal) return [];
    const items = FOLLOWUP_RULES[focusedSignal.id] ?? [];
    const st = (statusById as any)[focusedSignal.id] as "pass"|"fail"|"caution"|"inactive"|undefined;
    const weight = st === "fail" ? 2 : st === "caution" ? 1 : 0;
    return items
      .map(it => ({ ...it, score: it.score + weight }))
      .sort((a,b) => b.score - a.score);
  }, [focusedSignal, statusById]);

  // All defaults for the current module → normalize to {text}
  // For orthopedics modules, use ORTHO_SIGNALS matrix follow-ups
  const defaultFollowups = useMemo(() => {
    if (!selectedModule) return [];
    
    // Check if this is an orthopedics module that should use the new matrix
    // Use USNWR matrix followups for consistency
    const arr = (selectedModule?.followups ?? []) as any[];
    return arr.map((f) => (typeof f === "string" ? { text: f } : f));
  }, [selectedModule, selectedSpecialty, focusedSignal]);

  // Relevant (already scored) vs Others (dedup by text)
  const { relevant, others } = useMemo(() => {
    const rel = (weightedFollowups ?? []);
    const relSet = new Set(rel.map((x:any) => (x.text || "").trim().toLowerCase()));
    const oth = defaultFollowups
      .filter((x:any) => !relSet.has((x.text || "").trim().toLowerCase()))
      .map((x:any) => ({ text: x.text, score: 0 }));
    return { relevant: rel, others: oth };
  }, [weightedFollowups, defaultFollowups]);

  const [showAllFollowups, setShowAllFollowups] = useState(false);
  const [qaPrompt, setQaPrompt] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  // PR5: LLM Workbench - Per-signal threads
  type ChatMessage = {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
    signalId?: string;
    contextSummary?: string;
  };
  
  // Thread storage: {specialty}:{moduleId}:{caseId}:{signalId} -> ChatMessage[]
  const [threadStorage, setThreadStorage] = useState<Record<string, ChatMessage[]>>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [evidenceSignal, setEvidenceSignal] = useState<any | null>(null);
  const [evidenceDrawer, setEvidenceDrawer] = useState<{
    title: string;
    items: Array<{ path: string; item: any }>;
    showAll?: boolean;
  } | null>(null);
  
  // NEW: single-select state for followup (null = none)
  const [selectedFollowup, setSelectedFollowup] = useState<string | null>(null);
  
  // Robust prompt resolution with fallback templates (after selectedFollowup is declared)
  const promptText = useMemo(() => {
    if (!selectedModule) return "";
    
    // For SCH modules, try to find the right module name from metadata
    let moduleNameForPromptStore = moduleDisplayName;
    // Use module display name directly since we have the correct mapping
    moduleNameForPromptStore = moduleDisplayName;
    
    console.log("Prompt resolution:", {
      selectedSpecialty,
      moduleDisplayName,
      moduleNameForPromptStore,
      selectedFollowup
    });
    
    const stored = getPromptForQuestion(selectedSpecialty, moduleNameForPromptStore);
    const storedContent = stored?.versions.find(v => v.id === stored.currentVersionId)?.content?.trim();
    
    console.log("PromptStore result:", {
      stored: !!stored,
      storedContent: storedContent?.slice(0, 100) + "...",
      usingFallback: !storedContent || storedContent.length === 0
    });
    
    return storedContent && storedContent.length > 0
      ? storedContent
      : buildDefaultPrompt(selectedSpecialty, moduleNameForPromptStore, selectedFollowup);
  }, [getPromptForQuestion, selectedSpecialty, moduleDisplayName, selectedFollowup, selectedModule]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Ref to prevent duplicate provenance emissions during StrictMode double-mounting
  const emittedProvenanceRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!focusedSignal || !selectedModule) return;

    // Generate a default user-friendly question for the input field
    const defaultQuestion = `Explain "${focusedSignal.label}" for this case. What evidence supports this signal?`;
    
    // Clear chat and populate the input with a helpful question
    setChatHistory([]);
    setQaPrompt(defaultQuestion); // Pre-populate with a question about the signal
    setQaError(null);
    setTimeout(
      () =>
        evidenceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      40,
    );
  }, [focusedSignal, selectedModule]);

  // Provenance tracking effects with StrictMode deduplication
  useEffect(() => {
    if (!patientPayload) return;
    
    const caseKey = `patient-${selectedCaseId}-${patientPayload.patient?.name}-${patientPayload.patient?.age}`;
    if (emittedProvenanceRef.current.has(caseKey)) return;
    emittedProvenanceRef.current.add(caseKey);
    
    // Track patient data with rich details
    const patientName = patientPayload.patient?.name ?? "—";
    const displayName = patientName.split(' ').length > 1 ? `${patientName.split(' ')[0]} ${patientName.split(' ')[1][0] || ''}` : patientName;
    
    withComputed('currentCase.patient.name', () => ({
      name: displayName,
      caseId: selectedCaseId,
      uiAnchor: '#prov-case-summary',
      page: window.location.pathname
    }), [displayName, selectedCaseId]);
    
    withComputed('currentCase.patient.demographics', () => ({
      age: patientPayload.patient?.age ?? "—",
      mrn: patientPayload.patient?.mrn ? `***${patientPayload.patient.mrn.slice(-3)}` : "—",
      uiAnchor: '#prov-case-summary',
      page: window.location.pathname
    }), [patientPayload.patient?.age, patientPayload.patient?.mrn]);
    
    // Track timing data with formatted display
    console.log('DATES_IN_UI', { 
      arrival: patientPayload?.times?.ArrivalInstant, 
      incision: patientPayload?.times?.IncisionStartInstant, 
      arrivalStr: String(patientPayload?.times?.ArrivalInstant), 
      arrivalParsed: new Date(patientPayload?.times?.ArrivalInstant).toString(), 
      incisionParsed: new Date(patientPayload?.times?.IncisionStartInstant).toString() 
    });
    
    if (patientPayload.times?.ArrivalInstant) {
      const arrivalTime = fmtISO(patientPayload.times.ArrivalInstant);
      withComputed('currentCase.times.ArrivalInstant', () => ({
        iso: patientPayload.times.ArrivalInstant,
        display: arrivalTime,
        uiAnchor: '#prov-case-summary',
        page: window.location.pathname
      }), [patientPayload.times.ArrivalInstant, arrivalTime]);
    }
    if (patientPayload.times?.IncisionStartInstant) {
      const incisionTime = fmtISO(patientPayload.times.IncisionStartInstant);
      withComputed('currentCase.times.IncisionStartInstant', () => ({
        iso: patientPayload.times.IncisionStartInstant,
        display: incisionTime,
        uiAnchor: '#prov-case-summary',
        page: window.location.pathname
      }), [patientPayload.times.IncisionStartInstant, incisionTime]);
    }
  }, [selectedCaseId, patientPayload?.patient?.name, patientPayload?.patient?.age, patientPayload?.patient?.mrn, patientPayload?.times?.ArrivalInstant, patientPayload?.times?.IncisionStartInstant]);

  // Meta builder functions for Case View Setup integration
  type MetaRow = { label: string; value: string | number | null | undefined };

  // Enhanced field resolver with proper dot-path handling and fallback
  function readField(fieldKey: string, payload: any, questionCfg?: any): any {
    const configPath = questionCfg?.paths?.[fieldKey];
    const builtIn: Record<string, string> = {
      PatientMRN: "patient.mrn",
      PatientName: "patient.name", 
      AgeYears: "patient.age",
      CSN: "encounter.id",
      ED_Arrival: "times.ArrivalInstant",
      SurgStart: "times.IncisionStartInstant",
      SurgEnd: "times.ProcedureEndInstant",
      TargetHours: "targets.surgeryHours",
      HoursToSurgery: "derived.hoursToSurgery",
      TimelyFlag: "derived.timelyFlag",
    };
    const p = configPath ?? builtIn[fieldKey] ?? fieldKey;
    return getByPath(payload, p) ?? "—";
  }
  
  // Evidence citation resolver (getByPath already exists further down)
  function resolveCitesToItems(payload: any, cites: string[]) {
    return (cites ?? []).map(p => ({ path: p, item: getByPath(payload, p) }))
                        .filter(x => x.item != null);
  }

  function buildCaseMeta(fieldOrder: Record<string, string[]>, payload: any, questionCfg?: any) {
    const groups = Object.keys(fieldOrder ?? {});
    return groups.map(g => ({
      group: g,
      rows: (fieldOrder[g] ?? []).map((fk): MetaRow => ({
        label: fk,
        value: readField(fk, payload, questionCfg) ?? "—"
      }))
    }));
  }

  // CaseMetaPanel Component
  function CaseMetaPanel({ meta }: { meta: {group: string; rows: MetaRow[]}[] }) {
    return (
      <div className="space-y-4">
        {meta.map(sec => (
          <div key={sec.group}>
            <div className="text-sm font-semibold text-slate-700 mb-1">{sec.group}</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {sec.rows.map(r => (
                <div key={sec.group + r.label} className="text-sm">
                  <span className="text-slate-500">{r.label}:</span>{" "}
                  <span className="text-slate-900">{String(r.value ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Compute case meta when module/case changes
  const caseMeta = useMemo(() => {
    if (!questionCfg?.fieldOrder || !patientPayload) return [];
    return buildCaseMeta(questionCfg.fieldOrder, patientPayload, questionCfg);
  }, [questionCfg?.fieldOrder, patientPayload, selectedModule?.id, selectedCaseId, questionCfg]);

  useEffect(() => {
    if (!selectedModule || !selectedCaseId || !patientPayload) return;
    
    const panelKey = `panel-${selectedModule.id}-${selectedCaseId}`;
    if (emittedProvenanceRef.current.has(panelKey)) return;
    emittedProvenanceRef.current.add(panelKey);
    
    // Track inline panel rendering with enhanced provenance
    const mergedSignals = patientPayload?.mergedSignals || [];
    const totalsByGroup = allGroups.reduce((acc: any, group: string) => {
      const groupSignals = signalsByGroup(selectedModule, group);
      const activeSignals = mergedSignals.filter((s: any) => s.group === group && s.status !== 'inactive');
      acc[group] = { total: groupSignals.length, active: activeSignals.length };
      return acc;
    }, {});
    
    withComputed('inline.panel.render', () => ({
      moduleId: selectedModule.id,
      caseId: selectedCaseId,
      hasPatientData: !!patientPayload,
      totals: totalsByGroup,
      activeSignalCount: mergedSignals.filter((s: any) => s.status !== 'inactive').length,
      uiAnchor: '#prov-case-summary'
    }), [selectedModule.id, selectedCaseId, !!patientPayload, totalsByGroup]);
  }, [selectedModule?.id, selectedCaseId, !!patientPayload]);

  useEffect(() => {
    if (!signalsForView.length || !activeGroup) return;
    
    const signalKey = `signals-${activeGroup}-${signalsForView.length}`;
    if (emittedProvenanceRef.current.has(signalKey)) return;
    emittedProvenanceRef.current.add(signalKey);
    
    // Track signal grouping with rich details
    withComputed('signalsForView.groups', () => ({
      groups: groups, // Available groups
      activeGroup: activeGroup,
      signalCount: signalsForView.length,
      uiAnchor: '#prov-tabs',
      page: window.location.pathname
    }), [activeGroup, signalsForView.length, groups]);
  }, [signalsForView.length, activeGroup, groups]);

  useEffect(() => {
    if (!selectedModule?.id || !patientPayload?.times) return;
    
    const thresholdKey = `threshold-${selectedModule.id}-${patientPayload.times.ArrivalInstant}-${patientPayload.times.IncisionStartInstant}`;
    if (emittedProvenanceRef.current.has(thresholdKey)) return;
    emittedProvenanceRef.current.add(thresholdKey);
    
    // Track threshold comparisons with rich details
    if (selectedModule.id === "timeliness_sch") {
      const m = deltaMinutes(patientPayload.times.ArrivalInstant, patientPayload.times.IncisionStartInstant);
      if (m !== null) {
        const hours = m / 60;
        const result = m <= 19*60 ? "PASS" : "FAIL";
        withComputed('threshold.compare', () => ({
          value: `${hours.toFixed(1)}h`,
          limit: '19h',
          status: result,
          actualMinutes: m,
          uiAnchor: '#prov-status',
          page: window.location.pathname
        }), [m, result, hours]);
      }
    }
  }, [selectedModule?.id, patientPayload?.times?.ArrivalInstant, patientPayload?.times?.IncisionStartInstant]);

  useEffect(() => {
    if (!countsByGroup || !Object.keys(countsByGroup).length) return;
    
    const countKey = `counts-${Object.keys(countsByGroup).length}`;
    if (emittedProvenanceRef.current.has(countKey)) return;
    emittedProvenanceRef.current.add(countKey);
    
    // Track group count computation with rich details
    withComputed('group.counts', () => ({
      counts: Object.fromEntries(Object.entries(countsByGroup).map(([k, v]) => [k, v.total])),
      uiAnchor: '#prov-tabs',
      page: window.location.pathname
    }), [countsByGroup]);
  }, [countsByGroup]);

  // Clear provenance emission tracking when case/module changes completely
  useEffect(() => {
    const currentKeys = Array.from(emittedProvenanceRef.current);
    const relevantKeys = currentKeys.filter(key => 
      key.includes(selectedCaseId || 'none') || 
      key.includes(selectedModule?.id || 'none')
    );
    
    // Keep only current case/module keys, clear others
    emittedProvenanceRef.current.clear();
    relevantKeys.forEach(key => emittedProvenanceRef.current.add(key));
  }, [selectedCaseId, selectedModule?.id]);

  // Helper function to resolve cite paths into payload data (robust version)
  function getByPath(obj: any, path: string) {
    try {
      // notes[0].text -> notes.0.text  (works for any array segment)
      const norm = path.replace(/\[(\d+)\]/g, ".$1");
      return norm.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    } catch {
      return undefined;
    }
  }

  // Normalize evidence items before rendering  
  const toDisplay = (item: any) => {
    if (item && typeof item === "object" && "text" in item) {
      // Prefer the note's text; keep ts/source if you show meta
      return { kind: "note", text: item.text, ts: item.ts, source: item.source };
    }
    return { kind: "value", value: String(item) };
  };

  // Scoped evidence viewing function
  function openEvidenceForSignal(signal: any, payload: any) {
    // Track evidence access with rich details
    withComputed('evidence.open', () => ({
      signalId: signal.id,
      signalLabel: signal.label || signal.id,
      citesCount: signal.cites?.length || 0,
      mode: signal.cites?.length ? 'scoped' : 'full',
      uiAnchor: `#signal-${signal.id}`,
      page: window.location.pathname
    }), [signal]);
    
    const items = (signal.cites ?? [])
      .map((p: string) => ({ path: p, item: toDisplay(getByPath(payload, p)) }))
      .filter((x: any) => x.item != null);

    setEvidenceDrawer({
      title: `${signal.label} — Evidence`,
      items: items.length ? items
            : (payload.notes ?? []).map((n: any, i: number) => ({ path: `notes[${i}]`, item: toDisplay(n) })),
      showAll: false
    });
  }

  // Toggle show all evidence function
  function toggleShowAllEvidence() {
    if (!evidenceDrawer) return;
    
    if (evidenceDrawer.showAll) {
      // Switch back to scoped view
      setEvidenceDrawer(prev => prev ? { ...prev, showAll: false } : null);
    } else {
      // Show all patient payload
      const allItems = [
        ...(patientPayload?.notes ?? []).map((note: any, i: number) => ({ 
          path: `patient_payload.notes[${i}]`, 
          item: note 
        })),
        ...(patientPayload?.times ? Object.entries(patientPayload.times).map(([key, value]) => ({ 
          path: `patient_payload.times.${key}`, 
          item: value 
        })) : []),
        ...(patientPayload?.demographics ? Object.entries(patientPayload.demographics).map(([key, value]) => ({ 
          path: `patient_payload.demographics.${key}`, 
          item: value 
        })) : [])
      ];
      
      setEvidenceDrawer(prev => prev ? { 
        ...prev, 
        items: allItems,
        showAll: true 
      } : null);
    }
  }

  // Auto-fill followup when signal is focused
  useEffect(() => {
    if (!focusedSignal) {
      setSelectedFollowup(null);
      return;
    }
    
    // Look up followup for the focused signal
    const signalFollowup = SIGNAL_FOLLOWUPS[focusedSignal.id];
    if (signalFollowup) {
      setSelectedFollowup(signalFollowup);
    } else {
      setSelectedFollowup(null);
    }
  }, [focusedSignal]);

  // Populate input when follow-up is selected
  useEffect(() => {
    if (!selectedFollowup || !focusedSignal) return;
    
    // Update the input field with the selected follow-up question
    setQaPrompt(selectedFollowup);
  }, [selectedFollowup, focusedSignal]);

  // Thread management helpers
  const getThreadKey = () => {
    if (!selectedSpecialty || !selectedModule || !selectedCaseId || !focusedSignal) return null;
    return `${selectedSpecialty}:${selectedModule.id}:${selectedCaseId}:${focusedSignal.id}`;
  };
  
  const saveCurrentThread = () => {
    const threadKey = getThreadKey();
    if (threadKey && chatHistory.length > 0) {
      setThreadStorage(prev => ({
        ...prev,
        [threadKey]: [...chatHistory]
      }));
    }
  };
  
  const loadThread = (threadKey: string) => {
    const thread = threadStorage[threadKey] || [];
    setChatHistory(thread);
  };
  
  // Chat input ref for focus hotkey
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Keyboard shortcuts
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (focusedSignal && qaPrompt.trim()) {
        askLLM();
      }
    }
  };
  
  // Global hotkey listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only if not in an input/textarea already
        const target = e.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) {
          e.preventDefault();
          chatInputRef.current?.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  
  // Auto-switch threads when signal focus changes
  useEffect(() => {
    if (focusedSignal) {
      // Save current thread before switching
      saveCurrentThread();
      
      // Load new thread
      const newThreadKey = getThreadKey();
      if (newThreadKey) {
        loadThread(newThreadKey);
      }
    } else {
      saveCurrentThread();
      setChatHistory([]);
    }
  }, [focusedSignal?.id, selectedCaseId, selectedModule?.id]);
  
  // Reset state when module changes and clear followup  
  useEffect(() => {
    saveCurrentThread(); // Save before clearing
    setFocusedSignal(null);
    setQaPrompt("");
    setChatHistory([]);
    setQaError(null);
    setSelectedFollowup(null);
  }, [selectedModuleSimpleId]);

  // Reset module selection when specialty changes
  useEffect(() => {
    if (prevSpecialtyRef.current === null) {      // first mount → don't clear
      prevSpecialtyRef.current = selectedSpecialty;
      return;
    }
    if (prevSpecialtyRef.current !== selectedSpecialty) {
      console.trace('🔍 TRACE: setSelectedModuleSimpleId(NULL - SPECIALTY_RESET) - STACK TRACE');
      console.log('🔍 SPECIALTY_RESET: prev =', prevSpecialtyRef.current, 'current =', selectedSpecialty);
      setSelectedModuleSimpleId(null);         // real change only
      setSelectedCaseId(null);
      setFocusedSignal(null);
      setQaPrompt("");
      setChatHistory([]);
      setQaError(null);
      prevSpecialtyRef.current = selectedSpecialty;
    }
  }, [selectedSpecialty]);

  // New structured QA request following the wiring guide
  type QARequest = {
    prompt_text: string;           // from PromptStore
    specialty: string;             // e.g., "Orthopedics"
    module_id: string;             // e.g., "timeliness_sch" (legacy) or display name
    module_title?: string;         // e.g., "SCH Timeliness" (display name)
    followup_question?: string;    // optional; when user clicks a follow-up
    patient_payload: any;          // full case payload (times, notes, labs, etc.)
    signal_ids?: string[];         // optional: for filtering relevant evidence
  };

  async function askLLM_v2(req: QARequest) {
    console.log('🔍 /api/qa REQUEST:', JSON.stringify(req, null, 2));
    const res = await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('🚨 /api/qa ERROR:', res.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error('🚨 /api/qa ERROR JSON:', errorJson);
      } catch (e) {
        console.error('🚨 /api/qa ERROR (plain text):', errorText);
      }
      
      if (res.status === 401) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      throw new Error(errorText || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function askLLM() {
    if (
      !focusedSignal ||
      !selectedModule ||
      !selectedCaseId ||
      !qaPrompt.trim()
    )
      return;

    // Auto-attach scoped evidence context
    const scopedEvidence = ((focusedSignal as any).cites ?? [])
      .map((p: string) => ({ path: p, item: toDisplay(getByPath(patientPayload, p)) }))
      .filter((x: any) => x.item != null);
    
    const contextSummary = `${focusedSignal.label} • ${scopedEvidence.length} cites`;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: qaPrompt.trim(),
      timestamp: new Date(),
      signalId: focusedSignal.id,
      contextSummary
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setQaLoading(true);
    setQaError(null);

    try {
      // Precompute timing fields as requested
      const arr = patientPayload?.times?.ArrivalInstant ?? null;
      const inc = patientPayload?.times?.IncisionStartInstant ?? null;
      let deltaHours: number | null = null;
      if (arr && inc) {
        const dmin = (new Date(inc).getTime() - new Date(arr).getTime()) / 60000;
        deltaHours = Math.round((dmin / 60) * 100) / 100; // H.hh
      }

      // Build request using the new structured format with PromptStore integration
      const SYSTEM_ENFORCER = `You must answer in exactly 3 fields:
Result/Finding: <short>
Reason: <≤10 words>
Evidence: [timestamps or note excerpts]
No extra lines or commentary.`;

      const finalPrompt = `${SYSTEM_ENFORCER}\n\n${promptText}`;

      // Use the new /api/qa format with precomputed fields
      const qaRequest = {
        prompt_text: finalPrompt,
        question_text: selectedModule.title.includes("SCH") ? 
          "Decide if incision occurred ≤19h from ED arrival for SCH using the inputs." :
          `Answer the module question for ${selectedModule.title}.`,
        patient_payload: patientPayload,
        inputs: {
          arrival: arr,
          incision: inc,
          delta_hours_precomputed: deltaHours
        }
      };

      // Try new structured endpoint first, fallback to old endpoint
      let data;
      try {
        const response = await fetch("/api/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(qaRequest),
        });

        if (!response.ok) {
          throw new Error(`QA endpoint failed: ${response.status}`);
        }
        data = await response.json();
      } catch (qaError) {
        console.warn("Structured /api/qa failed, falling back to /api/llm/chat:", qaError);
        // Fallback to old endpoint
        const res = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: qaPrompt,
            patient_id: selectedCaseId,
            question_id: selectedModule.id,
            patient_data: patientPayload,
          }),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          if (res.status === 401) {
            toast({
              title: "Unauthorized",
              description: "You are logged out. Logging in again...",
              variant: "destructive",
            });
            setTimeout(() => {
              window.location.href = "/api/login";
            }, 500);
            return;
          }
          throw new Error(errorText || `HTTP ${res.status}`);
        }
        data = await res.json();
      }

      let assistantContent = data?.response ?? "No answer returned.";

      // Apply response normalization
      const normalizeToThreeLines = (s: string) => {
        const lines = s.replace(/\r/g, '').trim().split('\n').map(l => l.trim()).filter(Boolean);
        // Simple guard
        if (lines.length !== 3 || 
            !/^Result\/Finding:/i.test(lines[0]) || 
            !/^Reason:/i.test(lines[1]) || 
            !/^Evidence:/i.test(lines[2])) {
          return null; // triggers reformat call
        }
        return lines.slice(0, 3).join('\n');
      };

      const normalized = normalizeToThreeLines(assistantContent);
      if (!normalized) {
        // Send reformat request
        try {
          const reformatResponse = await fetch("/api/llm/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `Reformat ONLY. Output exactly 3 lines in this schema:
Result/Finding: <PASS|FAIL|CAUTION>
Reason: <≤10 words>
Evidence: [Arrival: YYYY-MM-DD HH:MM, Incision: YYYY-MM-DD HH:MM, Delta: H.hh]
Do not add any other text.

Original response to reformat:
${assistantContent}`
            }),
          });

          if (reformatResponse.ok) {
            const reformatResult = await reformatResponse.json();
            assistantContent = reformatResult.response || assistantContent;
          }
        } catch (reformatError) {
          console.warn("Reformat request failed:", reformatError);
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        signalId: focusedSignal.id,
        contextSummary: `${focusedSignal.label} • ${((focusedSignal as any).cites ?? []).length} cites`
      };

      setChatHistory((prev) => [...prev, assistantMessage]);
      setQaPrompt(""); // Clear input after sending

      // Scroll to bottom of chat
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (e: any) {
      setQaError(e?.message ?? "LLM request failed.");
    } finally {
      setQaLoading(false);
    }
  }

  // UI toggles - default to showing only AI-active signals
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  // showPlanningConfig and showPromptStore now come from props
  
  // Panel state moved to App.tsx for global access
  
  // Legacy panel flag - set false to remove old Evidence & Assistant sidebar
  const showLegacyEvidencePanel = false;
  
  // UX: Send on chip click toggle (persistent)
  const [sendOnChipClick, setSendOnChipClick] = useState(() => {
    try {
      return localStorage.getItem('ux.sendOnChipClick') !== 'false';
    } catch {
      return true; // Default to true
    }
  });
  
  // Update localStorage when toggle changes
  useEffect(() => {
    try {
      localStorage.setItem('ux.sendOnChipClick', sendOnChipClick.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [sendOnChipClick]);
  
  // Chip toolbar state
  const [showMoreChips, setShowMoreChips] = useState(false);
  
  // Patient-first UX feature flags
  const [collapseLeftRail, setCollapseLeftRail] = useState(() => {
    try {
      return localStorage.getItem('ux.collapseLeftRail') !== 'false';
    } catch {
      return true; // Default to true
    }
  });
  
  const [patientWider, setPatientWider] = useState(() => {
    try {
      return localStorage.getItem('ux.patientWider') !== 'false';
    } catch {
      return true; // Default to true
    }
  });
  
  // Update localStorage when toggles change
  useEffect(() => {
    try {
      localStorage.setItem('ux.collapseLeftRail', collapseLeftRail.toString());
      localStorage.setItem('ux.patientWider', patientWider.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [collapseLeftRail, patientWider]);
  
  // Left rail drawer removed - using unified header dropdown
  
  // Panel ref for debug logging
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Refs to prevent unnecessary resets during initialization  
  const prevSpecialtyRef = useRef<string | null>(null);
  const didInitFromStore = useRef<string | null>(null);
  
  const visibleSignals = useMemo(() => {
    return showActiveOnly
      ? signalsForView.filter((s) => ((statusById as any)[s.id] as Status) !== "inactive")
      : signalsForView;
  }, [signalsForView, showActiveOnly, statusById]);
  
  // Auto-focus first actionable signal
  useEffect(() => {
    if (visibleSignals.length > 0 && selectedCaseId && !focusedSignal) {
      // Find first FAIL or CAUTION signal
      const firstActionable = visibleSignals.find(s => {
        const status = (statusById as any)[s.id] as Status;
        return status === 'fail' || status === 'caution';
      });
      
      if (firstActionable) {
        setFocusedSignal(firstActionable);
      }
    }
  }, [visibleSignals, selectedCaseId, focusedSignal, statusById]);

  // ---------- layout ----------
  return (
    <PromptPlayProvider redactPHI={true} defaultOpen={false}>
    <div className="min-h-screen bg-gradient-to-b from-[#F7FBFE] to-[#FFFFFF]">
      {/* Header - auto-shrink after selection */}
      <div className={`bg-white border-b border-slate-200 transition-all duration-300 ${
        selectedModule && selectedCaseId ? 'py-2' : 'py-3'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Always show specialty dropdown, with optional breadcrumb when collapsed */}
          <div className="flex items-center justify-between">
            {/* Left side: Specialty dropdown + optional breadcrumb */}
            <div className="flex items-center gap-4">
              {/* Specialty dropdown - always visible */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Specialty:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => {
                      const newSpecialty = e.target.value;
                      console.log('🔄 Specialty change:', selectedSpecialty, '→', newSpecialty);
                      
                      // Clear all dependent state immediately
                      console.trace('🔍 TRACE: setSelectedModuleSimpleId(NULL - SPECIALTY_CHANGE)');
                      setSelectedModuleSimpleId(null);
                      setSelectedCaseId(null);
                      setFocusedSignal(null);
                      setQaPrompt("");
                      setChatHistory([]);
                      setQaError(null);
                      setSelectedFollowup(null);
                      
                      // Update specialty
                      setSelectedSpecialty(newSpecialty);
                      propOnSpecialtyChange(newSpecialty);
                    }}
                    className="px-3 py-1 text-sm border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {withStaticConfig('availableSpecialties', availableSpecialties).map((specialty: string) => (
                      <option key={specialty} value={specialty}>
                        {specialty}
                      </option>
                    ))}
                  </select>
                  <SourceTag src="static" />
                </div>
              </div>
              
              {/* Breadcrumb when collapsed and case selected */}
              {collapseLeftRail && selectedModule && selectedCaseId && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">▸</span>
                  <span className="text-slate-900 font-medium">{selectedModule.title}</span>
                  <span className="text-slate-400">▸</span>
                  <span className="text-blue-700 font-medium">
                    {readField("PatientName", patientPayload, questionCfg) ?? "—"}, 
                    Age {readField("AgeYears", patientPayload, questionCfg) ?? "—"}, 
                    CSN {readField("CSN", patientPayload, questionCfg) ?? selectedCaseId}
                  </span>
                  <button
                    onClick={() => {
                      console.log('🔄 Change button clicked - clearing selections');
                      setSelectedModuleSimpleId(null);
                      setSelectedCaseId(null);
                      setFocusedSignal(null);
                      setQaPrompt("");
                      setChatHistory([]);
                      setQaError(null);
                      setSelectedFollowup(null);
                    }}
                    className="ml-3 px-3 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
            
            {/* Right side: UX toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPatientWider(!patientWider)}
                className={`px-2 py-1 text-xs rounded border ${
                  patientWider
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Toggle patient area width (80/20 vs 66/33)"
              >
                {patientWider ? '📊 Wide' : '📋 Standard'}
              </button>
              <button
                onClick={() => setCollapseLeftRail(!collapseLeftRail)}
                className={`px-2 py-1 text-xs rounded border ${
                  collapseLeftRail
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Toggle left rail collapse"
              >
                {collapseLeftRail ? '📱 Compact' : '🖥️ Full'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Panels moved to App.tsx for global access */}

        {/* Dynamic grid based on patient-wider flag */}
        <div className={`grid grid-cols-1 gap-6 ${
          patientWider
            ? 'lg:grid-cols-[4fr_1fr] xl:grid-cols-[4fr_1fr]' // 80/20
            : 'lg:grid-cols-[2fr_1fr]' // 66/33
        }`}>
          {/* LEFT: selection chain + signals table + inline evidence */}
          <div className="flex flex-col space-y-4 min-w-0">
            {/* Module & Case Selection - collapsible */}
            {!collapseLeftRail || !selectedModule || !selectedCaseId ? (
              <>
                {/* Step 1: Module list (after specialty) */}
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    1) Select Module
                  </div>
                  <div className="flex flex-wrap gap-2">
                {availableModules.length > 0 ? (
                  availableModules.map((module) => {
                    // Map metadata modules to legacy module IDs for case and signal compatibility
                    let legacyModuleId: string | null = null;

                    // Special mapping for known modules
                    if (module.name === "Timeliness – SCH") {
                      legacyModuleId = "timeliness_sch";
                    } else if (module.name === "SCH Delay Summary") {
                      legacyModuleId = "timeliness_sch"; // Same legacy module for SCH-related
                    } else if (module.name === "SSI Assessment") {
                      legacyModuleId = "ssi";
                    } else if (module.name === "Return to OR") {
                      legacyModuleId = "rto";
                    } else if (module.name === "Neurovascular Injury") {
                      legacyModuleId = "neurovascular";
                    } else if (module.name === "Compartment Syndrome") {
                      legacyModuleId = "compartment";
                    } else if (module.name === "Cast Complications") {
                      legacyModuleId = "cast";
                    } else if (module.name === "Infection Control") {
                      legacyModuleId = "infection";
                    } else if (module.name === "Follow-up/Readmission") {
                      legacyModuleId = "readmit";
                    } else {
                      // Try to find corresponding legacy module for other cases
                      const legacyModule = legacyModules.find(
                        (m) =>
                          m.title
                            .toLowerCase()
                            .includes(module.name.toLowerCase()) ||
                          module.name
                            .toLowerCase()
                            .includes(m.title.toLowerCase()),
                      );
                      legacyModuleId = legacyModule?.id || null;
                    }

                    // Use compound only for display/tooltips
                    const compoundForDisplay = `${module.name}|${legacyModuleId || 'fallback'}`;
                    const active = selectedModuleSimpleId === module.value; // <-- SIMPLE compare
                    
                    return (
                      <Pill
                        key={module.name}
                        active={active}
                        title={compoundForDisplay}
                        onClick={() => {
                          // Only allow one module selection at a time
                          console.trace('🔍 TRACE: setSelectedModuleSimpleId(USER_CLICK)');
                          setSelectedModuleSimpleId(module.value);
                          setSelectedCaseId(null);
                          setFocusedSignal(null);
                          setQaPrompt("");
                          setChatHistory([]);
                          setQaError(null);
                          setSelectedFollowup(null); // Clear followup on module change
                        }}
                      >
                        {module.name}
                      </Pill>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500">
                    No modules available for {selectedSpecialty}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Cases for selected module (RENDER ONLY WHEN A MODULE IS SELECTED) */}
            {selectedModuleSimpleId && selectedModule ? (
              <div className="rounded-xl border bg-white p-3">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  2) Select Case
                </div>
                {(moduleCases.needsReview?.length === 0 && moduleCases.readyForReview?.length === 0) ? (
                  <div className="text-sm text-slate-500">
                    No sample cases for this module.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Needs Review */}
                    <div className="border rounded-lg p-3">
                      <div className="text-xs font-semibold text-amber-700 mb-2">
                        Needs Review ({moduleCases.needsReview?.length || 0})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {moduleCases.needsReview?.map((c) => (
                            <CasePill
                              key={c.id}
                              active={selectedCaseId === c.id}
                              bucketType="needsReview"
                              onClick={() => {
                                setSelectedCaseId(c.id);
                                setFocusedSignal(null);
                                setQaPrompt("");
                                setChatHistory([]);
                                setQaError(null);
                              }}
                              title={c.label}
                            >
                              <span className="truncate">{c.label}</span>
                              {(() => {
                                const jsonStatus = CASE_STATUS[c.id];
                                const fallback = computeCaseStatusFallback(selectedModule?.id, selectedCaseId === c.id ? patientPayload : undefined);
                                const effectiveStatus = jsonStatus || fallback;
                                const b = statusBadge(effectiveStatus);
                                return (
                                  <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] ${b.cls}`}>
                                    {b.text}
                                  </span>
                                );
                              })()}
                            </CasePill>
                          ))}
                        {(!moduleCases.needsReview || moduleCases.needsReview.length === 0) && (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </div>

                    {/* Ready for Review (from Intake) */}
                    <div className="border rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-700 mb-2">
                        Ready for Review ({moduleCases.readyForReview?.length || 0})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {moduleCases.readyForReview?.map((c: any) => (
                            <CasePill
                              key={c.id}
                              active={selectedCaseId === c.id}
                              bucketType="readyForReview"
                              onClick={() => {
                                setSelectedCaseId(c.id);
                                setFocusedSignal(null);
                                setQaPrompt("");
                                setChatHistory([]);
                                setQaError(null);
                              }}
                              title={`${c.label} - Reviewed ${c.reviewedAt ? new Date(c.reviewedAt).toLocaleDateString() : ''}`}
                            >
                              <span className="truncate">{c.label}</span>
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] bg-green-100 text-green-800 border-green-200">
                                ✓ READY
                              </span>
                            </CasePill>
                          ))}
                        {(!moduleCases.readyForReview || moduleCases.readyForReview.length === 0) && (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Patient Details Panel - Module Agnostic */}
                {(() => {
                  // Debug logging as requested
                  console.log('PANEL_GUARD', {
                    moduleId: selectedModule?.id,
                    hasCase: !!selectedCaseId,
                    hasPayload: !!patientPayload,
                    schGuard: selectedModule?.id === 'timeliness_sch',
                    cssHidden: panelRef?.current ? getComputedStyle(panelRef.current).display : 'NA'
                  });
                  
                  return selectedCaseId &&
                    patientPayload && (
                    <div ref={panelRef} className="inline-panel-container mt-4 pt-4 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">
                        Patient Details & Case Summary:
                      </div>
                      {!selectedModule ? (
                        <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                          <div className="animate-pulse">Loading module...</div>
                        </div>
                      ) : (() => {
                        const fallbackRow = { id: selectedCaseId!, name: "—", age: "—" as any, mrn: "—" };
                        const rowFromPayload = {
                          id: patientPayload?.id ?? selectedCaseId!,
                          name: patientPayload?.patient?.name ?? "—",
                          age: patientPayload?.patient?.age ?? "—",
                          mrn: patientPayload?.patient?.mrn ?? "—",
                        };
                        console.log('🔄 ModuleInlinePanel Render:', {
                          moduleId: selectedModule.id,
                          version,
                          selectedCaseId,
                          hasPatientPayload: !!patientPayload,
                          caseRowData: rowFromPayload,
                          provenanceEnabled: isProvEnabled()
                        });
                        
                        return (
                          <div id="prov-case-summary">
                            <ModuleInlinePanel
                              moduleId={selectedModule?.id || storedCase?.selectedModuleId || 'unknown'}
                              key={`${selectedModule?.id || storedCase?.selectedModuleId}:${version}:${selectedCaseId}:${patientPayload?.id || 'no-payload'}`}
                            caseRow={rowFromPayload ?? fallbackRow}
                            caseData={patientPayload as any}
                            projectKey="USNWR_SCH"
                            activeGroupIds={groups}
                            onConfigure={() => window.open("/planning", "_blank")}
                            defaultExpanded={defaultPanelExpanded}
                          />
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            ) : (
              // If no module selected, show a minimal hint instead of cases
              <div className="rounded-xl border bg-white p-3">
                <div className="text-sm text-slate-500">
                  Choose a module to see its cases.
                </div>
              </div>
            )}

            {/* Step 3: Signals for selected case */}
            <div className="content-section rounded-xl border bg-white p-4">
              {!selectedModule || !selectedCaseId ? (
                <div className="text-center py-8">
                  <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">
                    Select a module and case above to view signals.
                  </p>
                  {/* Debug info when stored case exists */}
                  {storedCase && (
                    <div className="mt-4 p-3 bg-gray-50 rounded text-left text-xs">
                      <div className="font-medium mb-2 flex items-center gap-2">
                        AI Signal Intake Data Detected:
                        <SourceTag src="local" />
                      </div>
                      <div>Selected Module ID: {storedCase.selectedModuleId || 'N/A'}</div>
                      <div>Selected Module: {storedCase.selectedModule || 'N/A'}</div>
                      <div>Selected Case ID: {storedCase.selectedCaseId || 'N/A'}</div>
                      <div>Signals: {storedCase.mergedSignals?.length || storedCase.signals?.length || 0} found</div>
                      <div>Patient Data: {storedCase.patient_payload ? 'Available' : 'Missing'}</div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Module header */}
                  <div className="mb-3">
                    <div className="text-base font-semibold text-slate-900">
                      {selectedModule.title}
                    </div>
                    <div className="text-sm text-slate-600">
                      {selectedModule.usnwrQuestion}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {selectedModule.whyReview}
                    </div>
                  </div>

                  {/* Case Meta Panel - rendered when config and patient data available */}
                  {questionCfg?.fieldOrder && patientPayload && caseMeta.length > 0 && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                      <div className="text-sm font-medium text-slate-700 mb-2">Case Details</div>
                      <CaseMetaPanel meta={caseMeta} />
                    </div>
                  )}

                  {/* Group chips + active-only (filtered by planning config) */}
                  <div id="prov-tabs" className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex flex-wrap gap-2">
                      {groups.map((g) => (
                        <Pill
                          key={g}
                          active={g === activeGroup}
                          onClick={() => setActiveGroup(g)}
                          title={`${g} · ${countsByGroup[g]?.fail ?? 0} fail, ${countsByGroup[g]?.caution ?? 0} caution, ${countsByGroup[g]?.pass ?? 0} pass`}
                        >
                          <span className="mr-2">{g}</span>
                          <span className="text-xs text-gray-500">
                            · {countsByGroup[g]?.fail ?? 0} fail, {countsByGroup[g]?.caution ?? 0} caution, {countsByGroup[g]?.pass ?? 0} pass
                          </span>
                        </Pill>
                      ))}
                    </div>
                    <div className="w-px h-6 bg-slate-300" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={showActiveOnly}
                        onChange={(e) => setShowActiveOnly(e.target.checked)}
                      />
                      <span className="text-sm text-slate-700">
                        Hide inactive signals
                      </span>
                    </label>
                    <div className="w-px h-6 bg-slate-300" />
                    <button
                      onClick={() => {
                        localStorage.removeItem('abstraction.cases');
                        window.location.reload();
                      }}
                      className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                      title="Clear cached data and reload"
                    >
                      Clear Cache
                    </button>
                  </div>

                  {/* Case Outcome Banner */}
                  {selectedModule && selectedCaseId && (
                    <div id="prov-status" className="mb-3 flex items-center gap-2">
                      {(() => {
                        const jsonStatus = CASE_STATUS[selectedCaseId] || "";
                        const fallback = computeCaseStatusFallback(selectedModule?.id, patientPayload);
                        const effectiveStatus = jsonStatus || fallback;
                        const b = statusBadge(effectiveStatus);
                        let comparator = "—";

                        // Timeliness comparators
                        if (selectedModule.id === "timeliness_sch" && patientPayload?.times) {
                          const m = deltaMinutes(patientPayload.times.ArrivalInstant, patientPayload.times.IncisionStartInstant);
                          
                          // Threshold comparison (provenance tracked in effect)
                          
                          comparator = m == null ? "Missing time" : `${fmtHours1dp(m)} ${(m ?? 0) <= 19*60 ? "≤" : ">"} 19h ${(m ?? 0) <= 19*60 ? "✓" : "✗"}`;
                        }
                        if (selectedModule.id === "timeliness_other" && patientPayload?.times?.DebridementStart) {
                          const m = deltaMinutes(patientPayload.times.ArrivalInstant, patientPayload.times.DebridementStart);
                          comparator = m == null ? "—" : `${fmtHours1dp(m)} ${(m ?? 0) <= 24*60 ? "≤" : ">"} 24h ${(m ?? 0) <= 24*60 ? "✓" : "✗"}`;
                        }

                        return (
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${b.cls}`}>
                            <span className="font-semibold text-sm">{b.text}</span>
                            <span className="text-xs opacity-80">• {comparator}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Case Meta Panel - renders when we have config and patient data */}
                  {questionCfg?.fieldOrder && patientPayload && caseMeta.length > 0 && (
                    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-sm font-semibold text-slate-700 mb-3">Case Information</div>
                      <CaseMetaPanel meta={caseMeta} />
                    </div>
                  )}

                  {/* Signals table */}
                  <div className="overflow-auto min-h-0">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="text-left text-slate-600 border-b">
                          <th className="py-2 pr-3 w-36">Status</th>
                          <th className="py-2 pr-3">Signal</th>
                          <th className="py-2 pr-3">Definition</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const visibleSignals = signalsForView
                            .filter(sig => !showActiveOnly || (statusById as any)[sig.id] !== "inactive");
                          
                          // Enhanced provenance for table filtering
                          withComputed('computed:table.filter', () => ({
                            showInactive: !showActiveOnly,
                            totalSignals: signalsForView.length,
                            visibleSignals: visibleSignals.length,
                            filteredOut: signalsForView.length - visibleSignals.length,
                            uiAnchor: '#signals-table'
                          }), [showActiveOnly, signalsForView.length, visibleSignals.length]);
                          
                          return visibleSignals.map((sig) => {
                            const st =
                              ((statusById as any)[sig.id] as Status) ??
                              "inactive";
                            const badge =
                              st === "pass"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : st === "fail"
                                  ? "bg-rose-100 text-rose-800 border-rose-200"
                                  : st === "caution"
                                    ? "bg-amber-100 text-amber-800 border-amber-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200";
                            const isFocused = focusedSignal?.id === sig.id;
                            const rowClass = isFocused
                              ? "bg-cyan-50/70 border-l-4 border-l-cyan-500"
                              : "";
                            return (
                              <tr
                                key={sig.id}
                                className={`border-b last:border-0 cursor-pointer ${rowClass}`}
                                onClick={() => {
                                  setFocusedSignal(sig);
                                  // Emit provenance for inline evidence opening
                                  withComputed('evidence.open:inline', () => ({
                                    signalId: sig.id,
                                    signalLabel: sig.label || sig.id,
                                    citesCount: (sig as any).cites?.length || 0,
                                    mode: 'scoped',
                                    uiAnchor: `#signal-${sig.id}`,
                                    page: window.location.pathname
                                  }), [sig]);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    setFocusedSignal(sig);
                                    // Emit provenance for inline evidence opening (keyboard)
                                    withComputed('evidence.open:inline', () => ({
                                      signalId: sig.id,
                                      signalLabel: sig.label || sig.id,
                                      citesCount: (sig as any).cites?.length || 0,
                                      mode: 'scoped',
                                      uiAnchor: `#signal-${sig.id}`,
                                      page: window.location.pathname,
                                      trigger: 'keyboard'
                                    }), [sig]);
                                  }
                                }}
                                tabIndex={0}
                                aria-label={`Signal ${sig.label}`}
                                title={sig.tooltip}
                              >
                                <td className="py-2 pr-3 align-top">
                                  <span
                                    className={[
                                      "inline-flex items-center px-2 py-0.5 rounded-full border text-xs",
                                      badge,
                                    ].join(" ")}
                                  >
                                    {st.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 align-top">
                                  <div className="font-medium text-slate-900">
                                    {sig.label}
                                  </div>
                                  {sig.tooltip && (
                                    <div className="text-xs text-slate-500">
                                      {sig.tooltip}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 pr-3 align-top text-slate-700">
                                  {sig.definition ?? "—"}
                                </td>
                                <td className="py-2 align-top">
                                  <button
                                    className="px-2 py-1 rounded-md border text-xs hover:bg-slate-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Use inline evidence display instead of popup
                                      setFocusedSignal(sig);
                                      // Emit provenance for inline evidence opening
                                      withComputed('evidence.open:inline', () => ({
                                        signalId: sig.id,
                                        signalLabel: sig.label || sig.id,
                                        citesCount: (sig as any).cites?.length || 0,
                                        mode: 'inline',
                                        uiAnchor: `#signal-${sig.id}`,
                                        page: window.location.pathname,
                                        trigger: 'button'
                                      }), [sig]);
                                    }}
                                  >
                                    View evidence
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        {/* Show empty state message */}
                        {(() => {
                          const visibleSignals = signalsForView.filter(
                            (sig) =>
                              !showActiveOnly ||
                              (statusById as any)[sig.id] !== "inactive",
                          );
                          
                          return visibleSignals.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="py-6 text-center text-slate-500"
                              >
                                {showActiveOnly
                                  ? "No active signals in this group."
                                  : "No signals in this group."}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* PR3: Inline Evidence (Scoped by Default) */}
            {inlineEvidence && focusedSignal && (
              <div className="mt-4 border-t border-amber-200 bg-amber-50/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">
                      📋 Evidence for {focusedSignal.label}
                    </h3>
                    <div className="text-xs text-amber-700 mt-1">
                      {evidenceMode === 'scoped' ? 'Showing cited evidence' : 'Showing full payload'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newMode = evidenceMode === 'scoped' ? 'full' : 'scoped';
                        setEvidenceMode(newMode);
                        // Emit provenance
                        withComputed('payload.mode', () => ({
                          mode: newMode,
                          signalId: focusedSignal.id,
                          toggle: 'inline',
                          uiAnchor: `#inline-evidence-${focusedSignal.id}`
                        }), [newMode, focusedSignal.id]);
                      }}
                      className="px-2 py-1 text-xs bg-white border border-amber-300 rounded hover:bg-amber-50 transition-colors"
                    >
                      {evidenceMode === 'scoped' ? 'Scoped ▸ Full' : 'Full ▸ Scoped'}
                    </button>
                    <button
                      onClick={() => setFocusedSignal(null)}
                      className="p-1 text-amber-700 hover:bg-amber-100 rounded"
                      title="Close inline evidence"
                    >
                      ×
                    </button>
                  </div>
                </div>
                
                <div className="overflow-auto max-h-96" id={`inline-evidence-${focusedSignal.id}`}>
                  {(() => {
                    if (evidenceMode === 'scoped') {
                      // Show scoped evidence from cites
                      const scopedItems = ((focusedSignal as any).cites ?? [])
                        .map((p: string) => ({ path: p, item: getByPath(patientPayload, p) }))
                        .filter((x: any) => x.item != null);
                      
                      if (scopedItems.length === 0) {
                        return (
                          <div className="text-sm text-amber-800 p-3 bg-amber-100/50 rounded border border-amber-200">
                            <div className="font-medium mb-1">No cited evidence found</div>
                            <div className="text-xs text-amber-700 mb-2">
                              This signal doesn't have specific cite paths or the paths don't resolve to data.
                            </div>
                            <button
                              onClick={() => setEvidenceMode('full')}
                              className="text-xs underline text-amber-800 hover:text-amber-900"
                            >
                              Show full payload →
                            </button>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          {scopedItems.map((item: any, idx: number) => (
                            <div key={idx} className="bg-white border border-amber-200 rounded p-3">
                              <div className="text-xs font-mono text-amber-700 mb-2 bg-amber-100 px-2 py-1 rounded">
                                {item.path}
                              </div>
                              <div className="text-sm text-gray-900">
                                {(() => {
                                  const displayItem = toDisplay(item.item);
                                  if (displayItem.kind === 'note') {
                                    return (
                                      <div>
                                        <div className="text-sm">{displayItem.text}</div>
                                        {(displayItem.ts || displayItem.source) && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            {displayItem.source && `${displayItem.source}`}
                                            {displayItem.ts && ` • ${new Date(displayItem.ts).toLocaleString()}`}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    return <div>{displayItem.value}</div>;
                                  }
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      // Show full payload
                      return (
                        <div className="bg-white border border-amber-200 rounded p-3">
                          <div className="text-xs font-mono text-amber-700 mb-2 bg-amber-100 px-2 py-1 rounded">
                            patient_payload (full)
                          </div>
                          <pre className="whitespace-pre-wrap text-xs text-gray-900 overflow-auto max-h-80">
                            {JSON.stringify(patientPayload, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Follow-up chips now integrated into chat panel above */}
              </> 
            ) : null}
          </div>

          {/* RIGHT: LLM Workbench Only */}
          <div className="flex flex-col min-w-0 min-h-0" style={{ minWidth: patientWider ? '20%' : '33%' }}>
            {/* Legacy Evidence & Assistant Panel - REMOVED */}
            {showLegacyEvidencePanel && (
              <div className="bg-white p-4 border rounded-lg mb-4">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  Legacy Evidence & Assistant (Disabled)
                </div>
                <div className="text-xs text-slate-500">
                  This panel has been removed. Evidence is now inline and chat is below.
                </div>
              </div>
            )}
            
            {/* Always-Visible Chat Panel */}
            <div className="bg-white border rounded-lg p-4 flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-900">
                  💬 LLM Chat {focusedSignal ? `• ${focusedSignal.label}` : ''}
                </div>
                <div className="flex items-center gap-2">
                  {focusedSignal && (
                    <div className="text-xs text-slate-400">
                      Thread: {getThreadKey()}
                    </div>
                  )}
                  <button
                    onClick={() => setSendOnChipClick(!sendOnChipClick)}
                    className={`px-2 py-1 text-xs rounded border ${
                      sendOnChipClick
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="Toggle: chip click sends immediately vs inserts only"
                  >
                    {sendOnChipClick ? '⚡ Send' : '📝 Insert'}
                  </button>
                </div>
              </div>
              
              {/* Guided Questions Toolbar */}
              {focusedSignal && (() => {
                // Get followups from FOLLOWUP_RULES with scores
                const ruleFollowups = FOLLOWUP_RULES[focusedSignal.id] || [];
                
                // Get single followup from SIGNAL_FOLLOWUPS as default
                const defaultQuestion = SIGNAL_FOLLOWUPS[focusedSignal.id];
                
                // Combine and deduplicate, prioritize by score
                const allFollowups = [...ruleFollowups];
                
                // Add default question if it exists and isn't already included
                if (defaultQuestion && !allFollowups.some(f => f.text === defaultQuestion)) {
                  allFollowups.push({ text: defaultQuestion, score: 1 });
                }
                
                // Sort by score (higher first) and separate top 3 from rest
                const sortedFollowups = allFollowups.sort((a, b) => (b.score || 0) - (a.score || 0));
                const topThree = sortedFollowups.slice(0, 3);
                const remaining = sortedFollowups.slice(3);
                
                if (allFollowups.length === 0) return null;
                
                const handleChipClick = (followupText: string, idx: number, event: React.MouseEvent) => {
                  const isShiftClick = event.shiftKey;
                  const shouldSend = sendOnChipClick && !isShiftClick;
                  
                  // Set the prompt
                  setQaPrompt(followupText);
                  
                  // Focus and scroll to composer
                  setTimeout(() => {
                    chatInputRef.current?.focus();
                    chatInputRef.current?.scrollIntoView({ block: 'nearest' });
                  }, 10);
                  
                  // Emit provenance
                  withComputed('followup.clicked', () => ({
                    signalId: focusedSignal.id,
                    followupId: `${focusedSignal.id}_${idx}`,
                    followupText: followupText,
                    score: allFollowups[idx]?.score || 1,
                    sendImmediately: shouldSend,
                    modifierKey: isShiftClick ? 'shift' : null
                  }), [focusedSignal.id, idx, followupText, shouldSend]);
                  
                  // Send immediately if configured
                  if (shouldSend) {
                    setTimeout(() => askLLM(), 50);
                  }
                };
                
                return (
                  <div className="mb-3 p-2 bg-blue-50/50 border border-blue-200 rounded-lg">
                    <div className="flex flex-wrap gap-2 items-center">
                      {topThree.map((followup, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => handleChipClick(followup.text, idx, e)}
                          className="px-3 py-1.5 text-xs bg-white border border-blue-300 rounded-full hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center gap-1"
                          title={`${sendOnChipClick ? 'Click to send' : 'Click to insert'} • Shift+click to ${sendOnChipClick ? 'insert only' : 'send'}`}
                        >
                          {followup.text}
                          {followup.score && followup.score > 1 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full">
                              {followup.score}
                            </span>
                          )}
                        </button>
                      ))}
                      
                      {remaining.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowMoreChips(!showMoreChips)}
                            className="px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-full hover:bg-slate-200 transition-colors"
                          >
                            More… ({remaining.length})
                          </button>
                          
                          {showMoreChips && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg p-2 min-w-48 z-10">
                              <div className="space-y-1">
                                {remaining.map((followup, idx) => (
                                  <button
                                    key={idx + 3}
                                    onClick={(e) => {
                                      handleChipClick(followup.text, idx + 3, e);
                                      setShowMoreChips(false);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded flex items-center gap-2"
                                    title={`${sendOnChipClick ? 'Click to send' : 'Click to insert'} • Shift+click to ${sendOnChipClick ? 'insert only' : 'send'}`}
                                  >
                                    <span className="flex-1 truncate">{followup.text}</span>
                                    {followup.score && followup.score > 1 && (
                                      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full flex-shrink-0">
                                        {followup.score}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="border-t mt-2 pt-2 text-xs text-slate-500">
                                {sendOnChipClick ? 'Click sends • Shift+click inserts' : 'Click inserts • Shift+click sends'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-blue-700 ml-auto">
                        {allFollowups.length} questions • {sendOnChipClick ? 'Click = send' : 'Click = insert'}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Chat History */}
              <div className="flex-1 mb-3 border rounded-lg overflow-hidden flex flex-col" style={{ minHeight: '300px' }}>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
                  {chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm mt-8">
                      {focusedSignal ? (
                        <div>
                          <div className="mb-2">💭 Start a conversation about <strong>{focusedSignal.label}</strong></div>
                          <div className="text-xs">Evidence auto-attached • Press <kbd className="px-1 py-0.5 bg-white border rounded text-xs">C</kbd> to focus</div>
                        </div>
                      ) : (
                        "Select a signal to start chatting"
                      )}
                    </div>
                  ) : (
                    chatHistory.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${message.type === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-white border text-slate-900 shadow-sm"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">
                            {message.content}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div
                              className={`text-xs opacity-70 ${
                                message.type === "user"
                                  ? "text-primary-foreground"
                                  : "text-slate-500"
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                            {message.contextSummary && (
                              <div className="text-xs opacity-60 italic">
                                {message.contextSummary}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Enhanced Composer */}
              <textarea
                ref={chatInputRef}
                className="w-full h-20 border rounded-md p-2 text-sm resize-none"
                placeholder={focusedSignal
                  ? `Ask about ${focusedSignal.label}... (Ctrl+Enter to send)`
                  : "Select a signal to start chatting..."
                }
                value={qaPrompt}
                onChange={(e) => setQaPrompt(e.target.value)}
                disabled={!focusedSignal}
                onKeyDown={handleChatKeyDown}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md text-sm border bg-primary text-primary-foreground border-primary hover:bg-primary/90 disabled:opacity-60"
                    onClick={askLLM}
                    disabled={!focusedSignal || !qaPrompt.trim() || qaLoading}
                    title={!focusedSignal ? "Select a signal first" : "Send to LLM (Ctrl+Enter)"}
                  >
                    {qaLoading ? "Asking…" : "Send"}
                  </button>
                  <PromptPlayTrigger 
                    contextRef="#qa-panel" 
                    size="sm"
                  />
                  <button
                    className="px-3 py-1.5 rounded-md text-sm border hover:bg-slate-50"
                    onClick={() => setQaPrompt("")}
                  >
                    Clear
                  </button>
                </div>
                <div className="text-xs text-slate-400">
                  <kbd className="px-1 py-0.5 bg-slate-100 border rounded">Ctrl+Enter</kbd> send • <kbd className="px-1 py-0.5 bg-slate-100 border rounded">C</kbd> focus
                </div>
              </div>
              
              {qaError && (
                <div className="mt-3 border rounded-lg p-3 bg-rose-50 text-sm text-rose-700">
                  {qaError}
                </div>
              )}
            </div>
          </div>

        </div>
        
        {/* Left Rail Drawer removed - using unified header dropdown */}
      </div>

      {/* Evidence display is now inline - no popup modal needed */}

      {/* Inline Panels - removed duplicate rendering since they're already shown above */}
    </div>
    </PromptPlayProvider>
  );
}
