// lib/promptTemplates.ts
export function buildDefaultPrompt(specialty: string, moduleTitle: string, followup?: string | null) {
  const base = `USNWR abstraction. Be concise; 3 lines max.
Result/Finding: <yes/no/short>
Reason: <≤10 words>
Evidence: [timestamps, note snippets]`;

  if (/Timeliness.*SCH/i.test(moduleTitle)) {
    return `${base}

Task: Decide if incision occurred ≤19h from ED arrival for SCH.
Use patient_payload.times.ArrivalInstant, IncisionStartInstant; cite exact times.
If unclear or missing timestamps, return CAUTION.

${followup ? `Focus: ${followup}` : ""}`.trim();
  }

  if (/SSI/i.test(moduleTitle)) {
    return `${base}

Task: Evaluate surgical site infection risk and documentation.
Use patient_payload for procedure details, wound classifications, prophylaxis timing.
Focus on CDC/NHSN criteria.

${followup ? `Focus: ${followup}` : ""}`.trim();
  }

  if (/Return.*OR/i.test(moduleTitle)) {
    return `${base}

Task: Determine if patient returned to OR within specified timeframe.
Use patient_payload.times for surgery dates, check for unplanned returns.
Include complication details if available.

${followup ? `Focus: ${followup}` : ""}`.trim();
  }

  if (/Mortality/i.test(moduleTitle)) {
    return `${base}

Task: Assess 30-day mortality and orthopedic complication linkage.
Use patient_payload.times.DeathInstant, DischargeInstant for timing.
Check notes for orthopedic complications.

${followup ? `Focus: ${followup}` : ""}`.trim();
  }

  // Generic fallback for other modules
  return `${base}

Task: Answer the module-level question for ${moduleTitle}.
Use only provided patient_payload; cite evidence. ${followup ? `Focus: ${followup}` : ""}`.trim();
}