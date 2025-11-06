// Time calculation rules for different medical modules
export interface TimeRule {
  targetHours: number;
  startField: string;
  endField: string;
  description: string;
  warningThresholdHours?: number; // Optional threshold for warnings
  criticalThresholdHours?: number; // Optional threshold for critical alerts
}

export const TIME_RULES: Record<string, TimeRule> = {
  // SCH (Supracondylar Humerus) - 19 hour rule
  "timeliness_sch": {
    targetHours: 19,
    startField: "ArrivalInstant",
    endField: "IncisionStartInstant",
    description: "ED arrival to incision",
    warningThresholdHours: 16,
    criticalThresholdHours: 19
  },
  
  // Other urgent orthopedic procedures - 6 hour rule
  "timeliness_urgent": {
    targetHours: 6,
    startField: "ArrivalInstant", 
    endField: "IncisionStartInstant",
    description: "Arrival to definitive care",
    warningThresholdHours: 4,
    criticalThresholdHours: 6
  },

  // Open fracture antibiotic timing - 1 hour rule
  "timeliness_open_fx_abx": {
    targetHours: 1,
    startField: "ArrivalInstant",
    endField: "AbxFirstDose",
    description: "Arrival to first antibiotic dose",
    warningThresholdHours: 0.75,
    criticalThresholdHours: 1
  },

  // SSI antibiotic timing - 24 hour rule
  "ssi_assessment": {
    targetHours: 24,
    startField: "IncisionStartInstant",
    endField: "AbxFirstDose",
    description: "Surgery to antibiotic",
    warningThresholdHours: 20,
    criticalThresholdHours: 24
  },

  // VTE prophylaxis timing - varies by risk
  "vte_prophylaxis": {
    targetHours: 24,
    startField: "IncisionStartInstant",
    endField: "VteProphylaxisStart",
    description: "Surgery to VTE prophylaxis",
    warningThresholdHours: 18,
    criticalThresholdHours: 24
  },

  "vte_prophylaxis_high_risk": {
    targetHours: 12,
    startField: "IncisionStartInstant", 
    endField: "VteProphylaxisStart",
    description: "Surgery to VTE prophylaxis (high risk)",
    warningThresholdHours: 8,
    criticalThresholdHours: 12
  },

  // Compartment syndrome timing - 6 hour rule
  "compartment_syndrome": {
    targetHours: 6,
    startField: "SymptomsOnset",
    endField: "FasciotomyStart", 
    description: "Symptom onset to fasciotomy",
    warningThresholdHours: 4,
    criticalThresholdHours: 6
  }
};

export type TimeStatus = "pass" | "warning" | "fail" | "inactive";

export function deltaMinutes(aISO?: string, bISO?: string): number | null {
  if (!aISO || !bISO) return null;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

export function fmtHours1dp(min: number): string {
  return `${Math.round((min / 60) * 10) / 10}h`;
}

export function calculateTimeStatus(
  moduleId: string,
  caseData: any
): {
  deltaMin: number | null;
  status: TimeStatus;
  description: string;
  targetMet: boolean;
} {
  const rule = TIME_RULES[moduleId];
  if (!rule) {
    return {
      deltaMin: null,
      status: "inactive",
      description: "No time rule defined",
      targetMet: false
    };
  }

  // Try multiple data structure patterns for flexibility
  const startTime = 
    caseData.times?.[rule.startField] ||
    caseData.events?.[rule.startField.toLowerCase()] ||
    caseData[rule.startField.toLowerCase()];

  const endTime = 
    caseData.times?.[rule.endField] ||
    caseData.events?.[rule.endField.toLowerCase()] ||
    caseData[rule.endField.toLowerCase()];

  const deltaMin = deltaMinutes(startTime, endTime);
  
  if (deltaMin === null) {
    return {
      deltaMin: null,
      status: "inactive",
      description: rule.description,
      targetMet: false
    };
  }

  const deltaHours = deltaMin / 60;
  const targetMet = deltaHours <= rule.targetHours;

  let status: TimeStatus;
  if (targetMet) {
    status = "pass";
  } else if (rule.warningThresholdHours && deltaHours <= rule.warningThresholdHours) {
    status = "warning";
  } else {
    status = "fail";
  }

  return {
    deltaMin,
    status,
    description: rule.description,
    targetMet
  };
}

// Helper to get time rule for a module
export function getTimeRule(moduleId: string): TimeRule | null {
  return TIME_RULES[moduleId] || null;
}

// Helper to list all available time rules
export function getAvailableTimeRules(): string[] {
  return Object.keys(TIME_RULES);
}

// Helper to format time delta for display
export function formatTimeDelta(deltaMin: number | null): string {
  if (deltaMin === null) return "N/A";
  return fmtHours1dp(deltaMin);
}

// Helper to get target display string
export function getTargetDisplay(moduleId: string): string {
  const rule = TIME_RULES[moduleId];
  if (!rule) return "";
  return `≤${rule.targetHours}h`;
}

export default TIME_RULES;