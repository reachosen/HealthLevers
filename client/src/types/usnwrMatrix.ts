// src/types/usnwrMatrix.ts
// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Signal = {
  id: string;
  label: string;
  group: string; // e.g., "Core", "Delay Drivers", "Documentation", "Ruleouts"
  definition?: string;
  tooltip?: string;
};

export type Module = {
  id: string; // e.g., "timeliness_sch"
  title: string; // UI title
  usnwrQuestion: string; // Plain text of the USNWR-aligned question
  whyReview: string; // Why abstractor review matters
  groups: string[]; // Ordered group names (render order)
  followups: string[]; // Anticipated follow-ups to seed LLM prompts
  signals: Signal[]; // Flat list; UI buckets by "group"
};

// -----------------------------------------------------------------------------
// MODULE 1: Timeliness – SCH (≤19h from ED arrival)
// -----------------------------------------------------------------------------
const timelinessSCH: Module = {
  id: "timeliness_sch",
  title: "Timeliness – SCH (≤19h)",
  usnwrQuestion:
    "Was surgery for supracondylar humerus fracture performed within 19 hours of ED arrival? If delayed, was the delay justified?",
  whyReview:
    "Timestamps alone miss clinical context (competing injuries, NPO violations, service admits). Abstractors validate true delays and ruleouts.",
  groups: ["Core", "Delay Drivers", "Documentation", "Ruleouts"],
  followups: [
    "Does the operative report confirm SCH?",
    "Any miscoding or DX/OP mismatch?",
    "Underlying conditions that delayed clearance?",
    "Higher-priority injuries (e.g., head trauma) that justified delay?",
    "Admitted to non-orthopedic service?",
    "Any pre-op rule violation (NPO)?",
    "Additional testing (CT/labs) before clearance?",
    "Multiple procedures in same session?",
    "Managed non-operatively or scheduled electively?",
    "Documented delay due to specialist/OR/patient stabilization?",
  ],
  signals: [
    // Core
    {
      id: "on_time_19h",
      label: "Incision within 19h of ED arrival",
      group: "Core",
      definition:
        "Delta between ED arrival and incision start ≤19 hours (time zone normalized).",
      tooltip: "Computed from ArrivalInstant → IncisionStartInstant.",
    },
    {
      id: "dx_confirmed_sch",
      label: "Operative note confirms SCH",
      group: "Core",
      definition:
        "Operative narrative explicitly confirms supracondylar humerus fracture.",
      tooltip: "Look for 'supracondylar', 'CRPP', 'humerus' in op note.",
    },

    // Delay Drivers
    {
      id: "competing_priority",
      label: "Higher-priority injury/CT delayed clearance",
      group: "Delay Drivers",
      definition:
        "Documented workup/treatment for higher-acuity condition (e.g., head trauma) prior to fixation.",
      tooltip: "e.g., 'CT head ordered for head trauma'.",
    },
    {
      id: "non_ortho_admit",
      label: "Admitted to non-orthopedic service",
      group: "Delay Drivers",
      definition:
        "Initial admit location/service not orthopedics and contributed to timing.",
      tooltip: "e.g., 'Admitted to Pediatrics service'.",
    },
    {
      id: "npo_violation",
      label: "Pre-op NPO violation",
      group: "Delay Drivers",
      definition:
        "Diet intake after NPO start (e.g., juice) causing anesthesia delay.",
      tooltip: "MAR/Orders indicate PO intake after NPO.",
    },
    {
      id: "extra_testing",
      label: "Additional testing caused delay",
      group: "Delay Drivers",
      definition:
        "Labs/imaging required before clearance that pushed incision past target.",
      tooltip: "CT/labs timestamps before clearance.",
    },
    {
      id: "resource_delay",
      label: "Resource/scheduling/staffing delay",
      group: "Delay Drivers",
      definition:
        "Documented delay due to specialist availability, OR scheduling, or patient stabilization needs.",
      tooltip: "e.g., 'awaiting vascular team', 'no room available'.",
    },

    // Documentation
    {
      id: "multi_procedure_same_session",
      label: "Multiple procedures in same session",
      group: "Documentation",
      definition: "Case includes >1 procedure in the index OR session.",
      tooltip: "Procedure list contains multiple codes/names.",
    },
    {
      id: "clearance_sequence_documented",
      label: "Clearance sequence documented",
      group: "Documentation",
      definition:
        "Pre-op clearance milestones and their timestamps are documented.",
      tooltip: "Anesthesia/medicine/consult timings present.",
    },

    // Ruleouts
    {
      id: "non_op_or_elective",
      label: "Managed non-operatively / elective plan",
      group: "Ruleouts",
      definition:
        "Explicit documentation of non-operative management or elective scheduling (not a delay).",
      tooltip: "Notes include 'non-operative trial' or 'elective scheduling'.",
    },
    {
      id: "miscode_possible",
      label: "Possible miscoding (DX/OP mismatch)",
      group: "Ruleouts",
      definition:
        "DX code or operative code/narrative conflict suggests miscoding; timeliness may not apply.",
      tooltip: "Narrative does not match coded SCH.",
    },
    {
      id: "planned_staged_return",
      label: "Planned/staged procedure",
      group: "Ruleouts",
      definition:
        "Staged plan documented (e.g., swelling reduction first), distinguishing from unplanned delay.",
      tooltip: "Look for 'staged plan' in notes.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 2: Timeliness – Other Urgent Orthopedics (open fx, septic hip, SCFE)
// -----------------------------------------------------------------------------
const timelinessOther: Module = {
  id: "timeliness_other",
  title: "Timeliness – Other Urgent Ortho",
  usnwrQuestion:
    "Was definitive care within condition-specific time targets (open fracture, septic hip, SCFE)?",
  whyReview:
    "True urgency varies; abstractors confirm condition, antibiotic timing, and valid exceptions.",
  groups: ["Core", "Delay Drivers", "Documentation", "Ruleouts"],
  followups: [
    "Was correct condition documented?",
    "Was injury open/contaminated?",
    "Were urgent antibiotics started per protocol?",
    "Any stabilization for other injuries?",
    "Did admission service differ from surgical service?",
    "Did imaging/lab turnaround affect timing?",
  ],
  signals: [
    // Core
    {
      id: "urgent_target_met",
      label: "Definitive care within pathway target",
      group: "Core",
      definition:
        "Timing meets internal protocol for the condition (e.g., septic hip, open fx).",
    },
    {
      id: "urgent_antibiotics",
      label: "Antibiotics timely for open fracture",
      group: "Core",
      definition:
        "First antibiotic dose within protocol window from ED arrival.",
    },

    // Delay Drivers
    {
      id: "open_contaminated",
      label: "Open or contaminated wound",
      group: "Delay Drivers",
      definition: "Open fracture or contamination documented.",
      tooltip: "e.g., 'Open tibia fracture; wound contaminated'.",
    },
    {
      id: "stabilization_other_injury",
      label: "Stabilization for other injury",
      group: "Delay Drivers",
      definition:
        "Deferral due to hemodynamic/neurological stabilization for other injuries.",
    },

    // Documentation
    {
      id: "correct_dx_confirmed",
      label: "Condition documented/confirmed",
      group: "Documentation",
      definition:
        "Narrative aligns with coded urgent condition (septic hip, SCFE, open fx).",
    },

    // Ruleouts
    {
      id: "not_urgent_by_protocol",
      label: "Not urgent per pathway",
      group: "Ruleouts",
      definition:
        "Clinical pathway allows later timing (e.g., low-grade, stable SCFE) – not a timeliness miss.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 3: Surgical Site Infection (SSI)
// -----------------------------------------------------------------------------
const ssi: Module = {
  id: "ssi",
  title: "Surgical Site Infection (SSI)",
  usnwrQuestion:
    "Did surgical site infection occur within index or CDC/NHSN window (30/90d) and meet criteria?",
  whyReview:
    "Antibiotics or culture orders alone can misclassify; abstractors match CDC/NHSN criteria to clinical signs.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Were CDC/NHSN criteria met?",
    "Symptoms documented (redness, swelling, drainage, fever)?",
    "Was there operative debridement?",
    "Is infection clearly related to the index site?",
  ],
  signals: [
    // Core
    {
      id: "clinical_signs_doc",
      label: "Clinical signs documented",
      group: "Core",
      definition:
        "Notes cite compatible signs (e.g., erythema, drainage, fever) near surgical site/timeline.",
    },
    {
      id: "operative_debridement",
      label: "Operative debridement performed",
      group: "Core",
      definition: "Return to OR for debridement related to index site.",
    },

    // Documentation
    {
      id: "index_site_linked",
      label: "Attribution to index site",
      group: "Documentation",
      definition:
        "Narrative explicitly links infection to the original surgical site.",
    },
    {
      id: "culture_supports_dx",
      label: "Culture/imaging supports diagnosis",
      group: "Documentation",
      definition:
        "Positive cultures or imaging consistent with SSI and not alternative source.",
    },

    // Ruleouts
    {
      id: "non_ssi_antibiotics",
      label: "Antibiotics for non-SSI reason",
      group: "Ruleouts",
      definition:
        "Antibiotics prescribed for a different diagnosis (e.g., URI); CDC/NHSN criteria not met.",
    },
    {
      id: "not_within_window",
      label: "Outside CDC/NHSN window",
      group: "Ruleouts",
      definition: "Symptoms/findings outside the defined 30/90-day window.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 4: Return to OR (Unplanned)
// -----------------------------------------------------------------------------
const rto: Module = {
  id: "return_to_or",
  title: "Return to OR (Unplanned)",
  usnwrQuestion:
    "Was the return to the operating room unplanned and related to the index procedure?",
  whyReview:
    "Planned vs unplanned often requires note review; attribution to index site not reliable from structured data.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Was a staged return documented pre-op?",
    "Indication — infection, fixation loss, new injury?",
    "Was hardware revised or removed?",
    "Was this related to index procedure?",
  ],
  signals: [
    // Core
    {
      id: "unplanned_related",
      label: "Unplanned return related to index",
      group: "Core",
      definition:
        "Documentation indicates the return was not planned and is related to the index procedure.",
    },

    // Documentation
    {
      id: "hardware_action",
      label: "Hardware revision/removal performed",
      group: "Documentation",
      definition:
        "Intra-op details mention hardware revision/removal at return to OR.",
    },
    {
      id: "indication_documented",
      label: "Return indication documented",
      group: "Documentation",
      definition:
        "Clear reason recorded (infection, loss of fixation, malunion, new trauma).",
    },

    // Ruleouts
    {
      id: "staged_planned_rto",
      label: "Staged/Planned return",
      group: "Ruleouts",
      definition:
        "Pre-op/initial op note documents planned return (e.g., staged pin removal).",
    },
    {
      id: "unrelated_procedure",
      label: "Unrelated non-index procedure",
      group: "Ruleouts",
      definition:
        "Return is for unrelated diagnosis or site; not attributable to the index procedure.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 5: Readmission / ED Revisit Attribution
// -----------------------------------------------------------------------------
const readmit: Module = {
  id: "readmit_ed",
  title: "Readmission / ED Revisit Attribution",
  usnwrQuestion:
    "Was the 7/30-day revisit related to the index surgery/condition?",
  whyReview:
    "Structured diagnosis often fails to show causality. Abstractors confirm relation using notes, imaging, and context.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Was revisit for pain, wound issue, cast problem, unrelated illness?",
    "Was there imaging of index site?",
    "Was it a scheduled follow-up mis-coded as ED?",
  ],
  signals: [
    // Core
    {
      id: "revisit_related",
      label: "Revisit/readmit related to index",
      group: "Core",
      definition:
        "Narrative/imaging indicates revisit is linked to index surgery/condition.",
    },

    // Documentation
    {
      id: "index_site_imaging",
      label: "Imaging of index site at revisit",
      group: "Documentation",
      definition: "Radiology performed targeting the index site/problem.",
    },
    {
      id: "cast_or_wound_issue",
      label: "Cast/wound issue documented",
      group: "Documentation",
      definition:
        "ED/clinic notes cite cast concerns, wound drainage, persistent pain.",
    },

    // Ruleouts
    {
      id: "scheduled_followup",
      label: "Scheduled follow-up (mis-coded)",
      group: "Ruleouts",
      definition:
        "Visit was scheduled follow-up but appears as ED/admit in claims/encounter coding.",
    },
    {
      id: "unrelated_diagnosis",
      label: "Unrelated diagnosis",
      group: "Ruleouts",
      definition:
        "Revisit for unrelated illness/injury; no linkage to index procedure/site.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 6: Neurovascular Injury
// -----------------------------------------------------------------------------
const nvi: Module = {
  id: "neurovascular",
  title: "Neurovascular Injury",
  usnwrQuestion:
    "Was there a new neurovascular deficit post-operatively relative to pre-operative baseline?",
  whyReview:
    "NV changes often only in free-text or PT/OT notes; requires manual synthesis.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Was NV exam normal pre-op?",
    "Was deficit transient or persistent?",
    "Was a vascular consult performed?",
  ],
  signals: [
    // Core
    {
      id: "new_postop_deficit",
      label: "New post-op deficit vs baseline",
      group: "Core",
      definition:
        "Explicit documentation of new sensory/motor/vascular deficit after index procedure.",
    },

    // Documentation
    {
      id: "preop_nv_doc",
      label: "Pre-op NV exam documented",
      group: "Documentation",
      definition: "Baseline NV exam recorded prior to procedure.",
    },
    {
      id: "consult_vascular",
      label: "Vascular/neurology consult",
      group: "Documentation",
      definition: "Specialty consult requested/evaluated for deficit.",
    },

    // Ruleouts
    {
      id: "preexisting_deficit",
      label: "Pre-existing deficit",
      group: "Ruleouts",
      definition: "Deficit present prior to index procedure (not new).",
    },
    {
      id: "transient_block_effect",
      label: "Transient anesthesia/nerve block effect",
      group: "Ruleouts",
      definition:
        "Temporary deficit expected from regional block, resolved within expected window.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 7: Functional Outcome
// -----------------------------------------------------------------------------
const functional: Module = {
  id: "functional_outcome",
  title: "Functional Outcome",
  usnwrQuestion:
    "Was there ROM loss, gait change, or functional limitation at follow-up?",
  whyReview:
    "Outcome requires synthesis of clinic/PT notes and imaging; structured fields insufficient.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "What is ROM compared to contralateral limb?",
    "Was patient cleared for sports/school?",
    "Are assistive devices still needed?",
  ],
  signals: [
    // Core
    {
      id: "rom_or_function_limited",
      label: "ROM/function limitation present",
      group: "Core",
      definition:
        "Documented limitation in ROM, strength, or function vs baseline/contralateral limb.",
    },

    // Documentation
    {
      id: "pt_ot_notes_referenced",
      label: "PT/OT documentation supports assessment",
      group: "Documentation",
      definition: "Therapy notes corroborate ROM/functional findings.",
    },

    // Ruleouts
    {
      id: "baseline_variation",
      label: "Baseline/contralateral limitation confounder",
      group: "Ruleouts",
      definition:
        "Pre-existing or contralateral limitation explains current measures.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 8: Implant / Hardware Complication
// -----------------------------------------------------------------------------
const hardware: Module = {
  id: "hardware_complication",
  title: "Implant / Hardware Complication",
  usnwrQuestion:
    "Was there implant failure, migration, infection, or a need for revision/removal?",
  whyReview:
    "Classification requires imaging + op note correlation; timing/causality often free-text only.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "What was the failure mode (breakage, migration, loosening)?",
    "Traumatic vs gradual failure?",
    "Was revision/removal performed?",
  ],
  signals: [
    // Core
    {
      id: "implant_failure_present",
      label: "Implant failure/migration/loosening",
      group: "Core",
      definition:
        "Imaging or intra-op findings consistent with hardware complication.",
    },

    // Documentation
    {
      id: "revision_or_removal",
      label: "Revision/removal performed",
      group: "Documentation",
      definition: "Operative report confirms revision/removal.",
    },

    // Ruleouts
    {
      id: "expected_removal_planned",
      label: "Expected/Planned removal",
      group: "Ruleouts",
      definition:
        "Elective or planned removal (e.g., planned pin removal) — not a complication.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 9: VTE & Prophylaxis
// -----------------------------------------------------------------------------
const vte: Module = {
  id: "vte",
  title: "VTE & Prophylaxis",
  usnwrQuestion:
    "Did a VTE occur and was prophylaxis appropriate for risk profile?",
  whyReview:
    "Requires matching imaging-confirmed events and medication orders to risk criteria; claims are insufficient.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Was DVT/PE confirmed by imaging?",
    "Was prophylaxis ordered/timed per protocol?",
    "Was patient high-risk?",
  ],
  signals: [
    // Core
    {
      id: "vte_confirmed",
      label: "VTE confirmed by imaging",
      group: "Core",
      definition: "DVT/PE confirmed with appropriate modality (US/CTPA).",
    },
    {
      id: "prophylaxis_appropriate",
      label: "Prophylaxis appropriate/timely",
      group: "Core",
      definition: "Medication/mechanical prophylaxis per protocol and risk.",
    },

    // Documentation
    {
      id: "risk_strat_documented",
      label: "Risk stratification documented",
      group: "Documentation",
      definition: "Risk factors recorded and linked to chosen prophylaxis.",
    },

    // Ruleouts
    {
      id: "not_vte_event",
      label: "Not a VTE event",
      group: "Ruleouts",
      definition: "Negative imaging or alternate diagnosis explains symptoms.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 10: Compartment Syndrome
// -----------------------------------------------------------------------------
const cs: Module = {
  id: "compartment_syndrome",
  title: "Compartment Syndrome",
  usnwrQuestion: "Did compartment syndrome occur and was fasciotomy performed?",
  whyReview:
    "Timing and symptom onset often require note review; structured fields under-represent findings.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "What clinical signs prompted diagnosis?",
    "Which compartments were released?",
    "Was onset linked to index injury/surgery?",
  ],
  signals: [
    // Core
    {
      id: "diagnosed_cs",
      label: "Compartment syndrome diagnosed",
      group: "Core",
      definition:
        "Clinical documentation consistent with compartment syndrome.",
    },
    {
      id: "fasciotomy_done",
      label: "Fasciotomy performed",
      group: "Core",
      definition: "Operative note confirms compartment release.",
    },

    // Documentation
    {
      id: "symptoms_documented",
      label: "Classic symptoms documented",
      group: "Documentation",
      definition:
        "Pain out of proportion, pain with passive stretch, paresthesia, pallor, pulselessness.",
    },

    // Ruleouts
    {
      id: "alternative_explains_findings",
      label: "Alternative diagnosis explains findings",
      group: "Ruleouts",
      definition:
        "Swelling/neuropathy from another cause; criteria for CS not met.",
    },
  ],
};

// -----------------------------------------------------------------------------
// MODULE 11: Mortality Attribution
// -----------------------------------------------------------------------------
const mortality: Module = {
  id: "mortality",
  title: "Mortality Attribution",
  usnwrQuestion:
    "Was death related to orthopedic condition/procedure or unrelated?",
  whyReview:
    "Attribution rarely lives in structured fields; requires careful synthesis across notes.",
  groups: ["Core", "Documentation", "Ruleouts"],
  followups: [
    "Peri-operative vs later?",
    "Was an orthopedic complication a cause or contributor?",
    "Was palliative intent documented?",
  ],
  signals: [
    // Core
    {
      id: "ortho_related_death",
      label: "Death related to orthopedic care",
      group: "Core",
      definition:
        "Provider attribution indicates ortho complication as cause/contributor.",
    },

    // Documentation
    {
      id: "clear_attribution_text",
      label: "Attribution explicitly documented",
      group: "Documentation",
      definition:
        "Death summary/notes clearly state cause and contributing factors.",
    },

    // Ruleouts
    {
      id: "unrelated_cause",
      label: "Unrelated cause",
      group: "Ruleouts",
      definition:
        "Death due to non-orthopedic cause (e.g., primary oncologic progression).",
    },
  ],
};

// -----------------------------------------------------------------------------
// Registry: All Modules
// (Order controls display order in UI module selector)
// -----------------------------------------------------------------------------
export const USNWR_MATRIX: Module[] = [
  timelinessSCH,
  timelinessOther,
  ssi,
  rto,
  readmit,
  nvi,
  functional,
  hardware,
  vte,
  cs,
  mortality,
];

// -----------------------------------------------------------------------------
// UI Helpers
// -----------------------------------------------------------------------------
export function listModules(matrix: Module[]): Module[] {
  return matrix;
}

export function listGroups(module: Module): string[] {
  return module.groups;
}

export function signalsByGroup(module: Module, group: string): Signal[] {
  return module.signals.filter((s) => s.group === group);
}
