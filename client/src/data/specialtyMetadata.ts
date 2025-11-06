// USNWR Specialty Metadata
// Defines medical specialties and their abstraction-worthy modules

export interface SpecialtyModule {
  name: string;
  value: string;
  description: string;
  defaultPrompt: string;
  displayOrder: number;
  groups?: string[];
}

export interface SpecialtyMetadata {
  specialty: string;
  modules: SpecialtyModule[];
}

// Comprehensive specialty metadata for medical abstraction
export const SPECIALTY_METADATA: SpecialtyMetadata[] = [
  {
    specialty: "Orthopedics",
    modules: [
      {
        name: "Timeliness – SCH",
        value: "timeliness_sch", // Maps to intake page selectedModuleId
        description: "Was surgery ≤19h from ED arrival? If delayed, was delay justified?",
        defaultPrompt: "Analyze the timeline from ED arrival to incision for this SCH case. Evaluate if surgery was performed within 19 hours and assess any delay justifications. Review timestamps, NPO status, competing priorities, and clinical context factors that structured data might miss.",
        displayOrder: 1,
        groups: ["Core", "Delay Drivers", "Documentation", "Ruleouts"]
      },
      {
        name: "Timeliness – Other Urgent Ortho",
        value: "timeliness_urgent",
        description: "Was definitive care within condition-specific time target for open fx, septic hip, SCFE?",
        defaultPrompt: "Evaluate timeliness of definitive care for urgent orthopedic conditions (open fractures, septic hip, SCFE). Assess whether condition-specific time targets were met and review competing priorities that structured timestamps may not capture.",
        displayOrder: 2
      },
      {
        name: "Surgical Site Infection (SSI)",
        value: "ssi_assessment",
        description: "Did SSI occur during index or within 30/90 days per CDC/NHSN criteria?",
        defaultPrompt: "Assess for surgical site infection using CDC/NHSN criteria. Evaluate clinical signs, laboratory findings, and operative interventions. Determine if cultures and antibiotics alone provide accurate classification or if clinical context is needed.",
        displayOrder: 3
      },
      {
        name: "Return to OR (Unplanned)",
        value: "return_or",
        description: "Was the return unplanned and related to index procedure?",
        defaultPrompt: "Evaluate unplanned returns to the operating room. Distinguish between planned staged procedures and truly unplanned returns. Assess relationship to index procedure and identify specific indications for return.",
        displayOrder: 4
      },
      {
        name: "Readmission / ED Revisit Attribution",
        value: "readmission_attribution",
        description: "Was the 7/30-day revisit related to index surgery?",
        defaultPrompt: "Analyze readmissions and ED revisits within 7/30 days. Determine causality relationship to index surgery, distinguishing between related complications and unrelated illnesses that structured diagnosis codes may not reliably capture.",
        displayOrder: 5
      },
      {
        name: "Neurovascular Injury",
        value: "neurovascular_injury",
        description: "Was there a new NV deficit post-op?",
        defaultPrompt: "Assess for new neurovascular deficits post-operatively. Compare pre-operative and post-operative neurovascular examinations. Evaluate persistence of deficits and any vascular consultations performed.",
        displayOrder: 6
      },
      {
        name: "Functional Outcome",
        value: "functional_outcome",
        description: "Was there ROM loss, gait change, or functional limitation?",
        defaultPrompt: "Evaluate functional outcomes including range of motion, gait changes, and functional limitations. Synthesize clinic notes and physical therapy assessments that discrete data fields may not capture.",
        displayOrder: 7
      },
      {
        name: "Implant / Hardware Complication",
        value: "implant_complication",
        description: "Was there implant failure, migration, infection, or revision?",
        defaultPrompt: "Assess implant and hardware complications including failure, migration, infection, or need for revision. Classify complication types using imaging and operative notes beyond structured fields.",
        displayOrder: 8
      },
      {
        name: "VTE & Prophylaxis",
        value: "vte_prophylaxis",
        description: "Did VTE occur and was prophylaxis appropriate?",
        defaultPrompt: "Evaluate venous thromboembolism occurrence and prophylaxis appropriateness. Review orders, imaging confirmations, and adherence to protocols that structured data alone may not fully capture.",
        displayOrder: 9
      },
      {
        name: "Compartment Syndrome",
        value: "compartment_syndrome",
        description: "Did it occur and was fasciotomy performed?",
        defaultPrompt: "Assess compartment syndrome diagnosis and management. Evaluate clinical signs, fasciotomy timing, and relationship to index injury or surgery. Review symptom context and timing that notes provide beyond structured diagnosis.",
        displayOrder: 10
      },
      {
        name: "Mortality Attribution",
        value: "mortality_attribution",
        description: "Was death related to orthopedic condition/procedure?",
        defaultPrompt: "Determine mortality attribution to orthopedic condition or procedure. Assess whether death was peri-operative or later, and evaluate orthopedic complications as causal or contributory factors requiring clinical judgment.",
        displayOrder: 11
      }
    ]
  },
  {
    specialty: "Cardiology & Heart Surgery",
    modules: [
      {
        name: "CHD Surgical Outcomes",
        value: "chd_surgical_outcomes",
        description: "Congenital heart disease surgical outcome analysis",
        defaultPrompt: "Analyze the surgical outcomes for this CHD case. Review operative success, complications, functional status, and any reinterventions required.",
        displayOrder: 1
      },
      {
        name: "Cath Lab Complications",
        value: "cath_lab_complications",
        description: "Catheterization laboratory procedural complications",
        defaultPrompt: "Review this cardiac catheterization for complications. Look for vascular injury, arrhythmias, contrast reactions, or procedural difficulties.",
        displayOrder: 2
      },
      {
        name: "Mortality Attribution",
        value: "mortality_attribution",
        description: "Determine mortality relationship to cardiac intervention",
        defaultPrompt: "Evaluate mortality in this cardiac case. Determine if death is attributable to the procedure, underlying condition, or other factors. Reference timeline and clinical course.",
        displayOrder: 3
      },
      {
        name: "Readmission",
        value: "readmission",
        description: "Analyze cardiac readmissions within 30 days",
        defaultPrompt: "Review this cardiac readmission. Determine if it's related to the original procedure, identify contributing factors, and assess preventability.",
        displayOrder: 4
      }
    ]
  },
  {
    specialty: "Neurology & Neurosurgery",
    modules: [
      {
        name: "Seizure Control",
        value: "seizure_control",
        description: "Evaluate seizure management and control",
        defaultPrompt: "Assess seizure control in this case. Review medication management, breakthrough seizures, and response to treatment adjustments.",
        displayOrder: 1
      },
      {
        name: "Craniotomy Timeliness",
        value: "craniotomy_timeliness",
        description: "Analyze timing of urgent craniotomy procedures",
        defaultPrompt: "Evaluate the timeliness of craniotomy in this case. Review indication urgency, delays, and impact on patient outcomes.",
        displayOrder: 2
      },
      {
        name: "Shunt Complications",
        value: "shunt_complications",
        description: "Assess CSF shunt complications and revisions",
        defaultPrompt: "Review this case for shunt complications. Look for obstruction, infection, overdrainage, or mechanical failure requiring revision.",
        displayOrder: 3
      },
      {
        name: "Mortality Attribution",
        value: "mortality_attribution",
        description: "Determine mortality relationship to neurosurgical intervention",
        defaultPrompt: "Evaluate mortality in this neurosurgical case. Determine if death is attributable to the procedure, underlying pathology, or other factors.",
        displayOrder: 4
      }
    ]
  },
  {
    specialty: "NICU",
    modules: [
      {
        name: "Unplanned Extubations",
        value: "unplanned_extubations",
        description: "Analyze unplanned extubation events",
        defaultPrompt: "Review this unplanned extubation event. Assess contributing factors, patient stability, reintubation requirements, and preventability.",
        displayOrder: 1
      },
      {
        name: "Device-Associated Infections",
        value: "device_infections",
        description: "Evaluate central line and device infections",
        defaultPrompt: "Assess this case for device-associated infections. Review central line care, infection timeline, and compliance with prevention protocols.",
        displayOrder: 2
      },
      {
        name: "Mortality Attribution",
        value: "mortality_attribution",
        description: "Determine mortality relationship to NICU care",
        defaultPrompt: "Evaluate mortality in this NICU case. Determine if death is related to care delivery, underlying condition severity, or other factors.",
        displayOrder: 3
      },
      {
        name: "Length of Stay",
        value: "length_of_stay",
        description: "Analyze extended NICU length of stay",
        defaultPrompt: "Review factors contributing to extended NICU stay. Identify delays in care, complications, or social factors affecting discharge.",
        displayOrder: 4
      }
    ]
  },
  {
    specialty: "General Pediatrics",
    modules: [
      {
        name: "Vaccination Timeliness",
        value: "vaccination_timeliness",
        description: "Evaluate adherence to vaccination schedules",
        defaultPrompt: "Review vaccination timeliness in this case. Assess schedule adherence, missed opportunities, and barriers to completion.",
        displayOrder: 1
      },
      {
        name: "Preventable ED Visits",
        value: "preventable_ed_visits", 
        description: "Analyze potentially preventable emergency department visits", 
        defaultPrompt: "Evaluate if this ED visit was preventable. Review access to primary care, condition management, and care coordination.",
        displayOrder: 2
      },
      {
        name: "Readmission Analysis",
        value: "readmission_analysis",
        description: "Assess pediatric readmissions within 30 days",
        defaultPrompt: "Review this pediatric readmission. Determine contributing factors, care transitions, and potential for prevention.",
        displayOrder: 3
      },
      {
        name: "Mortality Review",
        value: "mortality_review",
        description: "Comprehensive mortality case analysis",
        defaultPrompt: "Conduct mortality review for this pediatric case. Assess care quality, missed opportunities, and contributing factors.",
        displayOrder: 4
      }
    ]
  }
];

// Helper functions for easy access
export function getSpecialties(): string[] {
  return SPECIALTY_METADATA.map(s => s.specialty);
}

export function getModulesForSpecialty(specialty: string): SpecialtyModule[] {
  const meta = SPECIALTY_METADATA.find(s => s.specialty === specialty);
  return meta ? meta.modules.sort((a, b) => a.displayOrder - b.displayOrder) : [];
}

export function getDefaultPrompt(specialty: string, moduleName: string): string | null {
  const modules = getModulesForSpecialty(specialty);
  const module = modules.find(m => m.name === moduleName);
  return module ? module.defaultPrompt : null;
}

export function getAllModules(): Array<{specialty: string; module: SpecialtyModule}> {
  const result: Array<{specialty: string; module: SpecialtyModule}> = [];
  for (const spec of SPECIALTY_METADATA) {
    for (const module of spec.modules) {
      result.push({ specialty: spec.specialty, module });
    }
  }
  return result.sort((a, b) => 
    a.specialty.localeCompare(b.specialty) || 
    a.module.displayOrder - b.module.displayOrder
  );
}