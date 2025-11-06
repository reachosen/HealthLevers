// Orthopedics Signal Matrix (USNWR-Aligned)
// Based on the comprehensive abstraction matrix

export interface SignalDefinition {
  id: string;
  label: string;
  definition: string;
  group: string;
  module: string;
  followups: string[];
}

// Signal definitions aligned with the new orthopedics matrix
export const ORTHO_SIGNALS: SignalDefinition[] = [
  // Timeliness – SCH signals
  {
    id: "dx_confirmed_sch",
    label: "Dx Confirmed",
    definition: "SCH fracture diagnosis confirmed in operative report",
    group: "Core",
    module: "Timeliness – SCH",
    followups: ["Does the operative report confirm diagnosis?"]
  },
  {
    id: "possible_miscoding",
    label: "Possible Miscoding",
    definition: "Potential miscoding of diagnosis or procedure",
    group: "Ruleouts",
    module: "Timeliness – SCH",
    followups: ["Any miscoding of diagnosis/procedure?"]
  },
  {
    id: "borderline_threshold",
    label: "Borderline Threshold",
    definition: "Surgery timing near the 19-hour cutoff",
    group: "Core",
    module: "Timeliness – SCH",
    followups: ["Was incision within ≤19h cutoff?"]
  },
  {
    id: "conflicting_timestamps",
    label: "Conflicting Timestamps",
    definition: "Discrepancies between ED and OR documented times",
    group: "Documentation",
    module: "Timeliness – SCH",
    followups: ["Were ED vs OR times conflicting?"]
  },
  {
    id: "comorbidity_delay",
    label: "Comorbidity delaying surgery",
    definition: "Underlying medical conditions causing surgical delay",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Did underlying conditions delay surgery?"]
  },
  {
    id: "higher_priority_injury",
    label: "Higher-priority injury",
    definition: "Another injury requiring precedence over SCH",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Did another injury take precedence?"]
  },
  {
    id: "non_ortho_admit",
    label: "Non-Ortho Admit",
    definition: "Patient admitted to non-orthopedic service",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Was admission service non-ortho?"]
  },
  {
    id: "npo_violation",
    label: "Pre-op NPO violation",
    definition: "NPO status violation requiring delay",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Was there an NPO violation delaying case?"]
  },
  {
    id: "extra_testing_ct",
    label: "Extra Testing Needed (e.g., CT)",
    definition: "Additional imaging or testing causing delay",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Did CT/imaging cause delay?"]
  },
  {
    id: "non_ortho_consult_delay",
    label: "Non-Ortho Consult Delay",
    definition: "Consultation outside orthopedics causing delay",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Did a consult outside ortho cause delay?"]
  },
  {
    id: "multi_procedure_session",
    label: "Multi-Procedure Session",
    definition: "Multiple procedures performed in same session",
    group: "Ruleouts",
    module: "Timeliness – SCH",
    followups: ["Was this a multi-procedure session?"]
  },
  {
    id: "non_operative_plan",
    label: "Non-Operative/Elective Plan",
    definition: "Case managed non-operatively or as elective",
    group: "Ruleouts",
    module: "Timeliness – SCH",
    followups: ["Was case managed non-op or elective?"]
  },
  {
    id: "or_specialist_unavailable",
    label: "OR/Specialist Unavailable",
    definition: "Operating room or specialist availability factor",
    group: "Delay Drivers",
    module: "Timeliness – SCH",
    followups: ["Was OR/specialist availability a factor?"]
  },

  // Timeliness – Other Urgent Ortho signals  
  {
    id: "dx_confirmed_other",
    label: "Correct Dx Confirmed",
    definition: "Correct diagnosis confirmed for urgent condition",
    group: "Core",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Was correct diagnosis documented?"]
  },
  {
    id: "open_contaminated_injury",
    label: "Open/Contaminated Injury",
    definition: "Open or contaminated fracture present",
    group: "Core",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Was injury open/contaminated?"]
  },
  {
    id: "antibiotics_timely",
    label: "Antibiotics Started Timely",
    definition: "Antibiotics initiated within appropriate timeframe",
    group: "Core",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Were antibiotics given on time?"]
  },
  {
    id: "stabilization_other_injuries",
    label: "Stabilization for Other Injuries",
    definition: "Other injuries requiring stabilization first",
    group: "Delay Drivers",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Did other injuries require stabilization first?"]
  },
  {
    id: "non_surgical_admit_other",
    label: "Non-Surgical Admit",
    definition: "Patient admitted to non-surgical service",
    group: "Delay Drivers",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Was admission to non-surgical service?"]
  },
  {
    id: "imaging_lab_delay",
    label: "Imaging/Lab Delay",
    definition: "Imaging or laboratory studies causing delay",
    group: "Delay Drivers",
    module: "Timeliness – Other Urgent Ortho",
    followups: ["Did imaging/labs delay care?"]
  },

  // SSI signals
  {
    id: "cdc_nhsn_criteria",
    label: "CDC/NHSN Criteria Met",
    definition: "SSI meets CDC/NHSN surveillance criteria",
    group: "Core",
    module: "Surgical Site Infection (SSI)",
    followups: ["Were CDC/NHSN criteria met?"]
  },
  {
    id: "clinical_signs_documented",
    label: "Clinical Signs Documented",
    definition: "Clinical signs of infection documented",
    group: "Core",
    module: "Surgical Site Infection (SSI)",
    followups: ["Were clinical signs (redness, swelling, drainage, fever) documented?"]
  },
  {
    id: "superficial_vs_deep",
    label: "Superficial vs Deep/Organ",
    definition: "Classification of infection depth",
    group: "Documentation",
    module: "Surgical Site Infection (SSI)",
    followups: ["Was infection superficial vs deep/organ space?"]
  },
  {
    id: "operative_debridement",
    label: "Operative Debridement Done",
    definition: "Operative debridement performed for infection",
    group: "Core",
    module: "Surgical Site Infection (SSI)",
    followups: ["Was operative debridement performed?"]
  },
  {
    id: "infection_site_related",
    label: "Infection Site Related to Index",
    definition: "Infection location related to index procedure",
    group: "Attribution",
    module: "Surgical Site Infection (SSI)",
    followups: ["Was infection site related to index procedure?"]
  },

  // Return to OR signals
  {
    id: "planned_staged_return",
    label: "Planned Staged Return",
    definition: "Return was planned as part of staged procedure",
    group: "Planning",
    module: "Return to OR (Unplanned)",
    followups: ["Was a staged/planned return documented?"]
  },
  {
    id: "unplanned_return",
    label: "Unplanned Return",
    definition: "Return to OR was unplanned",
    group: "Complications",
    module: "Return to OR (Unplanned)",
    followups: ["Was the return unplanned?"]
  },
  {
    id: "infection_return",
    label: "Infection Return",
    definition: "Return due to infection",
    group: "Complications",
    module: "Return to OR (Unplanned)",
    followups: ["Indication: infection, fixation loss, new injury?"]
  },
  {
    id: "fixation_loss",
    label: "Fixation Loss",
    definition: "Loss of fracture fixation",
    group: "Complications",
    module: "Return to OR (Unplanned)",
    followups: ["Was fixation loss documented?"]
  },
  {
    id: "new_injury_return",
    label: "New Injury",
    definition: "New injury causing return",
    group: "Complications",
    module: "Return to OR (Unplanned)",
    followups: ["Was return due to new injury?"]
  },
  {
    id: "hardware_revised_removed",
    label: "Hardware Revised/Removed",
    definition: "Hardware revision or removal performed",
    group: "Complications",
    module: "Return to OR (Unplanned)",
    followups: ["Was hardware revised/removed?"]
  },

  // Readmission/ED Revisit signals
  {
    id: "pain_wound_cast_problem",
    label: "Pain/Wound/Cast Problem",
    definition: "Revisit for pain, wound, or cast issue",
    group: "Complications",
    module: "Readmission / ED Revisit Attribution",
    followups: ["Was revisit for pain/wound/cast?"]
  },
  {
    id: "imaging_index_site",
    label: "Imaging of Index Site",
    definition: "Imaging performed of index surgical site",
    group: "Follow-up",
    module: "Readmission / ED Revisit Attribution",
    followups: ["Was imaging of index site done?"]
  },
  {
    id: "unrelated_illness",
    label: "Unrelated Illness",
    definition: "Revisit due to illness unrelated to surgery",
    group: "Unrelated",
    module: "Readmission / ED Revisit Attribution",
    followups: ["Was revisit due to unrelated illness?"]
  },
  {
    id: "scheduled_followup_miscoded",
    label: "Scheduled Follow-Up Mis-coded",
    definition: "Scheduled follow-up visit mis-coded as emergency",
    group: "Documentation",
    module: "Readmission / ED Revisit Attribution",
    followups: ["Was it mis-coded scheduled follow-up?"]
  },

  // Neurovascular Injury signals
  {
    id: "normal_preop_exam",
    label: "Normal Pre-Op Exam",
    definition: "Pre-operative neurovascular exam was normal",
    group: "Assessment",
    module: "Neurovascular Injury",
    followups: ["Was NV exam normal pre-op?"]
  },
  {
    id: "new_persistent_deficit",
    label: "New Persistent Deficit",
    definition: "New persistent neurovascular deficit post-op",
    group: "Complications",
    module: "Neurovascular Injury",
    followups: ["Was deficit transient or persistent?"]
  },
  {
    id: "transient_deficit",
    label: "Transient Deficit",
    definition: "Transient neurovascular deficit post-op",
    group: "Complications",
    module: "Neurovascular Injury",
    followups: ["Was deficit transient or persistent?"]
  },
  {
    id: "vascular_consult_done",
    label: "Vascular Consult Done",
    definition: "Vascular surgery consultation performed",
    group: "Consultation",
    module: "Neurovascular Injury",
    followups: ["Was vascular consult performed?"]
  },

  // Functional Outcome signals
  {
    id: "rom_loss",
    label: "ROM Loss",
    definition: "Range of motion loss documented",
    group: "Function",
    module: "Functional Outcome",
    followups: ["What was ROM vs baseline/contralateral?"]
  },
  {
    id: "gait_change",
    label: "Gait Change",
    definition: "Gait abnormality or change documented",
    group: "Function",
    module: "Functional Outcome",
    followups: ["Was patient cleared for sports/school?"]
  },
  {
    id: "functional_limitation",
    label: "Functional Limitation",
    definition: "Functional limitation noted",
    group: "Function",
    module: "Functional Outcome",
    followups: ["Were functional limitations documented?"]
  },
  {
    id: "assistive_device_needed",
    label: "Assistive Device Still Needed",
    definition: "Assistive device still required",
    group: "Function",
    module: "Functional Outcome",
    followups: ["Were assistive devices still needed?"]
  },

  // Implant/Hardware Complication signals
  {
    id: "failure_mode",
    label: "Failure Mode (Breakage/Migration/Loosening)",
    definition: "Specific mode of implant failure",
    group: "Hardware",
    module: "Implant / Hardware Complication",
    followups: ["What was failure mode?"]
  },
  {
    id: "trauma_vs_gradual",
    label: "Trauma vs Gradual",
    definition: "Failure due to trauma versus gradual process",
    group: "Hardware",
    module: "Implant / Hardware Complication",
    followups: ["Was it trauma vs gradual?"]
  },
  {
    id: "revision_removal_done",
    label: "Revision/Removal Done",
    definition: "Hardware revision or removal performed",
    group: "Hardware",
    module: "Implant / Hardware Complication",
    followups: ["Was revision/removal performed?"]
  },

  // VTE & Prophylaxis signals
  {
    id: "dvt_pe_confirmed",
    label: "DVT/PE Confirmed",
    definition: "Venous thromboembolism confirmed by imaging",
    group: "VTE",
    module: "VTE & Prophylaxis",
    followups: ["Was VTE confirmed by imaging?"]
  },
  {
    id: "prophylaxis_ordered",
    label: "Prophylaxis Ordered",
    definition: "VTE prophylaxis ordered appropriately",
    group: "VTE",
    module: "VTE & Prophylaxis",
    followups: ["Was prophylaxis ordered?"]
  },
  {
    id: "prophylaxis_timing",
    label: "Prophylaxis Timing Appropriate",
    definition: "VTE prophylaxis timing was appropriate",
    group: "VTE",
    module: "VTE & Prophylaxis",
    followups: ["Was prophylaxis timing appropriate?"]
  },
  {
    id: "high_risk_patient",
    label: "High-Risk Patient Flag",
    definition: "Patient identified as high-risk for VTE",
    group: "VTE",
    module: "VTE & Prophylaxis",
    followups: ["Was patient high-risk?"]
  },

  // Compartment Syndrome signals
  {
    id: "clinical_signs_compartment",
    label: "Clinical Signs Present",
    definition: "Clinical signs of compartment syndrome present",
    group: "Assessment",
    module: "Compartment Syndrome",
    followups: ["What clinical signs prompted dx?"]
  },
  {
    id: "fasciotomy_performed",
    label: "Fasciotomy Performed",
    definition: "Fasciotomy procedure performed",
    group: "Treatment",
    module: "Compartment Syndrome",
    followups: ["Which compartments released?"]
  },
  {
    id: "linked_to_index",
    label: "Linked to Index Injury/Surgery",
    definition: "Compartment syndrome linked to index case",
    group: "Attribution",
    module: "Compartment Syndrome",
    followups: ["Was onset linked to index surgery?"]
  },

  // Mortality Attribution signals
  {
    id: "death_periop",
    label: "Death Peri-Op",
    definition: "Death occurred peri-operatively",
    group: "Mortality",
    module: "Mortality Attribution",
    followups: ["Was death peri-op vs later?"]
  },
  {
    id: "later_death",
    label: "Later Death",
    definition: "Death occurred post-discharge",
    group: "Mortality",
    module: "Mortality Attribution",
    followups: ["Was death peri-op vs later?"]
  },
  {
    id: "ortho_complication_cause",
    label: "Ortho Complication Cause",
    definition: "Orthopedic complication as cause of death",
    group: "Mortality",
    module: "Mortality Attribution",
    followups: ["Was ortho complication causal/contributory?"]
  },
  {
    id: "palliative_intent",
    label: "Palliative Intent Documented",
    definition: "Palliative care intent documented",
    group: "Mortality",
    module: "Mortality Attribution",
    followups: ["Was palliative intent documented?"]
  }
];

// Helper functions
export function getSignalsForModule(moduleName: string): SignalDefinition[] {
  return ORTHO_SIGNALS.filter(signal => signal.module === moduleName);
}

export function getSignalGroups(moduleName: string): string[] {
  const signals = getSignalsForModule(moduleName);
  const groups = Array.from(new Set(signals.map(s => s.group)));
  return groups.sort();
}

export function getFollowupsForSignal(signalId: string): string[] {
  const signal = ORTHO_SIGNALS.find(s => s.id === signalId);
  return signal ? signal.followups : [];
}

// Canonical group categories for validation - aligned with USNWR Matrix
export const CANONICAL_GROUPS = [
  "Core",
  "Delay Drivers", 
  "Documentation",
  "Ruleouts",
  "Attribution",
  "Mortality"
] as const;

// Module name mapping for legacy compatibility
export const MODULE_NAME_MAPPING: Record<string, string> = {
  "timeliness_sch": "Timeliness – SCH",
  "timeliness_other": "Timeliness – Other Urgent Ortho",
  "ssi": "Surgical Site Infection (SSI)",
  "rto": "Return to OR (Unplanned)",
  "readmit": "Readmission / ED Revisit Attribution",
  "neurovascular": "Neurovascular Injury",
  "function": "Functional Outcome",
  "implant": "Implant / Hardware Complication",
  "vte": "VTE & Prophylaxis",
  "compartment": "Compartment Syndrome",
  "mortality": "Mortality Attribution"
};