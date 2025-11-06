// Migration utilities for ProcessedCase data compatibility

export function migrateProcessedCase(pc: any) {
  if (!pc || typeof pc !== "object") return pc;
  
  // Ensure patient_payload exists
  pc.patient_payload = pc.patient_payload || {};
  
  // Ensure targets exist and are properly set
  pc.patient_payload.targets = pc.patient_payload.targets || {};
  if (pc.selectedModuleId === "timeliness_sch" && pc.patient_payload.targets.surgeryHours == null) {
    pc.patient_payload.targets.surgeryHours = 19;
  }
  
  // Handle derived field aliases
  const d = pc.patient_payload.derived || {};
  
  // Migrate arrival_to_surgery_min to hoursToSurgery
  if (d.arrival_to_surgery_min != null && d.hoursToSurgery == null) {
    d.hoursToSurgery = Math.round((d.arrival_to_surgery_min / 60) * 10) / 10;
  }
  
  // Migrate target_19h_met to timelyFlag
  if (typeof d.target_19h_met === "boolean" && d.timelyFlag == null) {
    d.timelyFlag = d.target_19h_met;
  }
  
  pc.patient_payload.derived = d;
  
  // Ensure notes array exists
  if (!Array.isArray(pc.patient_payload.notes)) {
    pc.patient_payload.notes = [];
  }
  
  // Migrate signal IDs for consistency
  const ID_MAP: Record<string, string> = { 
    SCH_TimelinessBreach: "on_time_19h" 
  };
  
  (pc.mergedSignals || []).forEach((s: any) => { 
    if (ID_MAP[s.id]) s.id = ID_MAP[s.id]; 
  });
  
  // Ensure specialty casing is consistent
  if (pc.selectedSpecialty?.toLowerCase() === "orthopedics") {
    pc.selectedSpecialty = "Orthopedics";
  }
  
  return pc;
}

// Utility to load and migrate case from localStorage
export function loadMigratedCase(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    const migrated = migrateProcessedCase(parsed);
    
    // Save back the migrated version
    localStorage.setItem(key, JSON.stringify(migrated));
    
    return migrated;
  } catch {
    return null;
  }
}