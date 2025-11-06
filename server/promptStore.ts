// Enhanced PromptStore with deterministic routing
import { PromptConfig, resolvePromptWithFallback, buildRequestEnvelope } from '../shared/promptRouting';

// Default prompt configurations with evidence scoping
const DEFAULT_PROMPTS: Record<string, PromptConfig> = {
  'Orthopedics:Timeliness – SCH:abstraction_help': {
    prompt_key: 'Orthopedics:Timeliness – SCH:abstraction_help',
    version_id: 'v1.3.2',
    metadata: {
      specialty: 'Orthopedics',
      module: 'Timeliness – SCH',
      type: 'abstraction_help',
      constraints: { reason_word_limit: 50, lines: 3 }
    },
    template: `You are an Abstraction Assistant for Orthopedics – Timeliness – SCH.

If no follow-up: decide if surgery occurred ≤19h from ED arrival.
If follow-up: answer only that.

Output (≤3 lines):
Result (≤19h ✅ / >19h ✗ / Not documented)
Reason (≤50 words, documented facts only)
Evidence (timestamps or note excerpts allowed by allowedEvidence).

No speculation.`,
    followup_allowed_evidence: {
      'possible_miscoding': ['notes[*].text', 'notes[*].source', 'surgery.procedure'],
      'npo_violation': ['notes[*].text', 'anesthesia.npo_*'],
      'higher_priority_injury': ['notes[*].text', 'imaging[*].result'],
      'comorbidity_delay': ['notes[*].text', 'medical.conditions[*]'],
      'non_ortho_admit': ['notes[*].text', 'admission.service'],
      'conflicting_timestamps': ['times.ArrivalInstant', 'times.IncisionStartInstant', 'notes[*].text'],
      '_default_19h': ['times.ArrivalInstant', 'times.IncisionStartInstant']
    }
  },

  'Orthopedics:Timeliness – SCH:signal_processing': {
    prompt_key: 'Orthopedics:Timeliness – SCH:signal_processing',
    version_id: 'v1.0.1',
    metadata: {
      specialty: 'Orthopedics',
      module: 'Timeliness – SCH',
      type: 'signal_processing',
      constraints: { reason_word_limit: 30, lines: 2 }
    },
    template: `You are a Signal Processing Assistant for Orthopedics – Timeliness – SCH.

Analyze patient data and return structured signals with status (pass/fail/caution/inactive).

Output format:
Signal ID: Status (Reason)
Evidence: [relevant paths]`,
    followup_allowed_evidence: {
      '_default': ['times.*', 'notes[*].text', 'surgery.*']
    }
  },

  'Orthopedics:Surgical Site Infection (SSI):abstraction_help': {
    prompt_key: 'Orthopedics:Surgical Site Infection (SSI):abstraction_help',
    version_id: 'v1.2.0',
    metadata: {
      specialty: 'Orthopedics',
      module: 'Surgical Site Infection (SSI)',
      type: 'abstraction_help',
      constraints: { reason_word_limit: 50, lines: 3 }
    },
    template: `You are an Abstraction Assistant for Orthopedics – Surgical Site Infection (SSI).

Analyze for signs of SSI within 30 days of index procedure.

Output (≤3 lines):
Result (SSI ✅ / No SSI ✗ / Not documented)
Reason (≤50 words, documented clinical signs only)
Evidence (culture results, clinical notes, return to OR dates).

No speculation.`,
    followup_allowed_evidence: {
      'clinical_signs': ['notes[*].text', 'vitals.*', 'assessment.*'],
      'positive_culture': ['culture.*', 'microbiology.*'],
      'operative_debridement': ['times.ReturnORInstant', 'surgery.procedure'],
      '_default': ['notes[*].text', 'culture.*', 'times.*']
    }
  },

  'Orthopedics:default:default': {
    prompt_key: 'Orthopedics:default:default',
    version_id: 'v1.0.0',
    metadata: {
      specialty: 'Orthopedics',
      module: 'default',
      type: 'default',
      constraints: { reason_word_limit: 75, lines: 4 }
    },
    template: `You are an Abstraction Assistant for Orthopedics.

Analyze the case based on the specific module requirements.

Output:
Assessment
Reasoning (≤75 words)
Evidence
Recommendations`,
    followup_allowed_evidence: {
      '_default': ['notes[*].text', 'times.*', 'surgery.*', 'medical.*']
    }
  },

  'global:default:default': {
    prompt_key: 'global:default:default',
    version_id: 'v1.0.0',
    metadata: {
      specialty: 'global',
      module: 'default',
      type: 'default',
      constraints: { reason_word_limit: 100, lines: 5 }
    },
    template: `You are a Medical Abstraction Assistant.

Provide general medical record analysis.

Output:
Clinical Assessment
Supporting Evidence
Documentation Quality
Recommendations
Follow-up Questions`,
    followup_allowed_evidence: {
      '_default': ['notes[*].text', 'times.*', 'vitals.*', 'assessments.*', 'procedures.*']
    }
  }
};

// In-memory store with fallback capabilities
export class EnhancedPromptStore {
  private store: Record<string, PromptConfig> = { ...DEFAULT_PROMPTS };

  // Get prompt with deterministic fallback
  getPrompt(specialty: string, module: string, type: string): PromptConfig | null {
    return resolvePromptWithFallback(this.store, specialty, module, type);
  }

  // Add or update prompt
  setPrompt(config: PromptConfig): void {
    this.store[config.prompt_key] = config;
  }

  // Build request envelope for LLM
  buildRequest(
    specialty: string,
    module: string,
    type: string,
    caseData: any,
    followUp?: string
  ) {
    return buildRequestEnvelope(this.store, specialty, module, type, caseData, followUp);
  }

  // Get all prompt keys for debugging
  getAllKeys(): string[] {
    return Object.keys(this.store);
  }

  // Check if specific prompt exists
  hasPrompt(specialty: string, module: string, type: string): boolean {
    const key = `${specialty}:${module}:${type}`;
    return key in this.store;
  }

  // Get prompt metadata only
  getPromptMetadata(specialty: string, module: string, type: string) {
    const config = this.getPrompt(specialty, module, type);
    return config ? config.metadata : null;
  }

  // Get allowed evidence for specific follow-up
  getAllowedEvidence(
    specialty: string, 
    module: string, 
    type: string, 
    followUp?: string
  ): string[] {
    const config = this.getPrompt(specialty, module, type);
    if (!config) return [];

    const followUpKey = followUp ? this.slugify(followUp) : '_default';
    return config.followup_allowed_evidence[followUpKey] || 
           config.followup_allowed_evidence['_default'] || 
           [];
  }

  private slugify(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }
}

// Global instance
export const promptStore = new EnhancedPromptStore();

// Export for use in API routes
export { DEFAULT_PROMPTS };