// Module ID Mapping Matrix
// Maps intake page module IDs to abstraction helper module IDs

/**
 * INTAKE PAGE (Screen 1) → ABSTRACTION HELPER (Screen 2) ID MAPPING
 * 
 * This matrix ensures consistent module ID translation between:
 * - AI Signal Intake page (uses simple IDs like "timeliness_sch")
 * - Abstraction Helper page (uses complex IDs like "Timeliness – SCH|timeliness_sch")
 */

export const MODULE_ID_MAPPING: Record<string, string> = {
  // Orthopedics modules - intake ID → abstraction helper ID format
  // The abstraction helper uses the simple value from specialtyMetadata
  "timeliness_sch": "timeliness_sch",
  "timeliness_urgent": "timeliness_urgent", 
  "ssi_assessment": "ssi_assessment",
  "return_or": "return_or",
  "neurovascular_injury": "neurovascular_injury",
  
  // Add more mappings as needed for other specialties
};

/**
 * Maps intake module ID to abstraction helper module ID
 */
export function mapIntakeToAbstractionModuleId(intakeModuleId: string): string {
  return MODULE_ID_MAPPING[intakeModuleId] || intakeModuleId;
}

/**
 * Gets the display name for a module ID from specialty metadata
 */
export function getModuleDisplayName(moduleId: string, specialty: string): string {
  // This would lookup from specialtyMetadata based on moduleId and specialty
  const moduleNames: Record<string, string> = {
    "timeliness_sch": "Timeliness – SCH",
    "timeliness_urgent": "Timeliness – Other Urgent Ortho",
    "ssi_assessment": "Surgical Site Infection (SSI)",
    "return_or": "Return to OR (Unplanned)",
    "neurovascular_injury": "Neurovascular Injury"
  };
  
  return moduleNames[moduleId] || moduleId;
}

/**
 * Debug helper to show the complete mapping matrix
 */
export function debugModuleMappings() {
  console.table({
    "Intake ID": Object.keys(MODULE_ID_MAPPING),
    "Abstraction ID": Object.values(MODULE_ID_MAPPING),
    "Display Names": Object.keys(MODULE_ID_MAPPING).map(id => getModuleDisplayName(id, "Orthopedics"))
  });
}