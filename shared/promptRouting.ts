// Deterministic Prompt Routing System
// Based on crisp routing design for unambiguous prompts and scoped evidence

export interface PromptMetadata {
  specialty: string;
  module: string;
  type: 'abstraction_help' | 'signal_processing' | 'automapper' | 'default';
  constraints: {
    reason_word_limit: number;
    lines: number;
  };
}

export interface PromptConfig {
  prompt_key: string;
  version_id: string;
  metadata: PromptMetadata;
  template: string;
  followup_allowed_evidence: Record<string, string[]>;
}

export interface RequestEnvelope {
  prompt_key: string;
  patientContext: any;
  followUp?: string;
  allowedEvidence: string[];
  style: {
    max_lines: number;
    reason_words: number;
  };
}

export interface PromptResolution {
  promptId: string;
  versionId: string;
  timestamp: string;
}

// Deterministic prompt key resolver
export function resolvePromptKey(
  specialty: string, 
  module: string, 
  type: string
): string {
  return `${specialty}:${module}:${type}`;
}

// Fallback chain for prompt resolution
export function resolvePromptWithFallback(
  store: Record<string, PromptConfig>,
  specialty: string,
  module: string,
  type: string
): PromptConfig | null {
  const primaryKey = resolvePromptKey(specialty, module, type);
  const moduleDefaultKey = resolvePromptKey(specialty, module, 'default');
  const specialtyDefaultKey = resolvePromptKey(specialty, 'default', 'default');
  const globalDefaultKey = 'global:default:default';

  return store[primaryKey] || 
         store[moduleDefaultKey] || 
         store[specialtyDefaultKey] || 
         store[globalDefaultKey] || 
         null;
}

// Build minimal context based on module type
export function buildMinimalContext(
  fullPayload: any,
  module: string,
  followUp?: string
): any {
  const context: any = {};

  // For timeliness modules
  if (module.includes('Timeliness')) {
    context.times = {
      ArrivalInstant: fullPayload.times?.ArrivalInstant,
      IncisionStartInstant: fullPayload.times?.IncisionStartInstant
    };
    // Add relevant notes
    context.notes = fullPayload.notes?.filter((n: any) => 
      n.text?.toLowerCase().includes('arrival') ||
      n.text?.toLowerCase().includes('surgery') ||
      n.text?.toLowerCase().includes('incision')
    ) || [];
  }

  // For SSI modules
  if (module.includes('SSI') || module.includes('Infection')) {
    context.notes = fullPayload.notes?.filter((n: any) => 
      n.text?.toLowerCase().includes('infection') ||
      n.text?.toLowerCase().includes('wound') ||
      n.text?.toLowerCase().includes('drainage')
    ) || [];
    context.culture = fullPayload.times?.CultureInstant;
  }

  // Add surgery context for miscoding follow-ups
  if (followUp?.toLowerCase().includes('miscoding') || 
      followUp?.toLowerCase().includes('procedure')) {
    context.surgery = fullPayload.surgery;
    context.notes = fullPayload.notes || [];
  }

  // Add anesthesia context for NPO follow-ups
  if (followUp?.toLowerCase().includes('npo') || 
      followUp?.toLowerCase().includes('violation')) {
    context.anesthesia = fullPayload.anesthesia;
    context.notes = fullPayload.notes?.filter((n: any) => 
      n.text?.toLowerCase().includes('npo') ||
      n.text?.toLowerCase().includes('nil') ||
      n.text?.toLowerCase().includes('fasting')
    ) || [];
  }

  return context;
}

// Evidence path validator
export function validateEvidencePaths(
  cites: string[],
  allowedEvidence: string[]
): boolean {
  const patterns = allowedEvidence.map(pattern => 
    new RegExp(pattern.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.'))
  );
  
  return cites.every(cite => 
    patterns.some(pattern => pattern.test(cite))
  );
}

// Word count validator
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Request envelope builder
export function buildRequestEnvelope(
  store: Record<string, PromptConfig>,
  specialty: string,
  module: string,
  type: string,
  caseData: any,
  followUp?: string
): RequestEnvelope | null {
  const config = resolvePromptWithFallback(store, specialty, module, type);
  if (!config) return null;

  const followUpKey = followUp ? slugify(followUp) : '_default_19h';
  const allowedEvidence = config.followup_allowed_evidence[followUpKey] || 
                         config.followup_allowed_evidence['_default_19h'] || 
                         [];

  return {
    prompt_key: config.prompt_key,
    patientContext: buildMinimalContext(caseData, module, followUp),
    followUp,
    allowedEvidence,
    style: {
      max_lines: config.metadata.constraints.lines,
      reason_words: config.metadata.constraints.reason_word_limit
    }
  };
}

// Helper function to slugify follow-up text for lookup
function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Complete request validator
export function validateRequest(request: RequestEnvelope, response: any): ValidationResult {
  const errors: string[] = [];

  // Validate evidence scope
  if (response.cites && !validateEvidencePaths(response.cites, request.allowedEvidence)) {
    errors.push('Evidence cites outside allowed scope');
  }

  // Validate word count
  if (response.reason && countWords(response.reason) > request.style.reason_words) {
    errors.push(`Reason exceeds ${request.style.reason_words} word limit`);
  }

  // Validate line count
  if (response.result && response.result.split('\n').length > request.style.max_lines) {
    errors.push(`Response exceeds ${request.style.max_lines} line limit`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Log prompt usage for telemetry
export function logPromptUsage(
  caseId: string,
  promptKey: string,
  versionId: string,
  success: boolean,
  errors?: string[]
): PromptResolution {
  const resolution: PromptResolution = {
    promptId: promptKey,
    versionId,
    timestamp: new Date().toISOString()
  };

  // In production, this would go to analytics/logging service
  console.log('Prompt Usage:', {
    caseId,
    ...resolution,
    success,
    errors
  });

  return resolution;
}