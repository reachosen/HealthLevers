// Signal ID canonicalizer for consistent AI ↔ Home mapping
export interface SignalAlias {
  [intakeId: string]: string; // AI ID → Home ID
}

// Per-module alias mappings - now simplified since Home uses USNWR matrix too
export const SIGNAL_ALIAS_MAP: Record<string, SignalAlias> = {
  timeliness_sch: {
    // Both AI and Home use USNWR matrix IDs - no mapping needed, pass-through
  },
  // Add other modules as needed
};

/**
 * Canonicalize a signal ID for consistent mapping between AI and Home
 */
export function canonicalizeSignalId(moduleId: string, signalId: string): string {
  const aliasMap = SIGNAL_ALIAS_MAP[moduleId];
  return aliasMap?.[signalId] ?? signalId;
}

/**
 * Canonicalize all signals in a mergedSignals array
 */
export function canonicalizeMergedSignals(moduleId: string, signals: any[]): any[] {
  return signals.map(signal => ({
    ...signal,
    id: canonicalizeSignalId(moduleId, signal.id)
  }));
}

/**
 * Generate join diagnostic report for provenance tracking
 */
export function generateJoinReport(mergedSignals: any[], moduleSignals: any[]): {
  missing: string[];
  extra: string[];
  matched: string[];
} {
  const mergedIds = new Set(mergedSignals.map(s => s.id));
  const moduleIds = new Set(moduleSignals.map(s => s.id));
  
  const missing = moduleSignals.filter(s => !mergedIds.has(s.id)).map(s => s.id);
  const extra = mergedSignals.filter(s => !moduleIds.has(s.id)).map(s => s.id);
  const matched = mergedSignals.filter(s => moduleIds.has(s.id)).map(s => s.id);
  
  return { missing, extra, matched };
}