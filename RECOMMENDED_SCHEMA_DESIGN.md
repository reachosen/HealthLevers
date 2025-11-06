# HealthLevers PostgreSQL Schema Design v1.0
## Tailored for Medical Quality Abstraction Platform

---

## Executive Summary

This schema design is specifically built for:
- **PostgreSQL** (Neon serverless) with Drizzle ORM
- **Medical quality abstraction** with AI-assisted signal detection
- **Multi-specialty support** with configurable modules
- **Evidence-based reasoning** with cite tracking
- **Migration path** from localStorage to persistent storage

**Key Principles:**
1. **PostgreSQL-native** - JSONB, indexes, constraints
2. **Drizzle ORM compatible** - TypeScript-first modeling
3. **Incremental migration** - Can coexist with current localStorage approach
4. **Evidence transparency** - Track every signal's data sources
5. **Audit trail** - Who did what when

---

## Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CORE ENTITIES                                │
├─────────────────────────────────────────────────────────────────┤
│  patients              → Patient demographics & identifiers      │
│  cases                 → Abstraction cases (persistent)          │
│  encounters            → Clinical encounters (optional FK)       │
│  case_payloads         → Full clinical data (JSONB)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CONFIGURATION                                  │
├─────────────────────────────────────────────────────────────────┤
│  specialties           → Orthopedics, Cardiology, etc.          │
│  modules               → Timeliness, Documentation, etc.         │
│  signal_definitions    → 483+ signal definitions                │
│  followup_questions    → Module-specific followups              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   AI & ABSTRACTION                               │
├─────────────────────────────────────────────────────────────────┤
│  abstraction_runs      → AI processing runs                     │
│  abstraction_results   → Validated signals per run              │
│  signal_evidence       → Cites & evidence per signal            │
│  prompts               → Versioned AI prompts                   │
│  prompt_versions       → Prompt history                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   QUALITY & FEEDBACK                             │
├─────────────────────────────────────────────────────────────────┤
│  case_reviews          → Human review workflow                  │
│  feedback              → User feedback on signals               │
│  audit_log             → Change tracking                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Table Definitions (PostgreSQL + Drizzle ORM)

### 1. Core Entities

#### `patients`
Represents individual patients across cases.

```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn VARCHAR(50) NOT NULL,  -- Medical Record Number
  name_encrypted TEXT,        -- PHI - encrypt at rest
  date_of_birth DATE,

  -- Metadata
  facility_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(mrn, facility_id)
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_facility ON patients(facility_id);
```

**Drizzle Schema:**
```typescript
// shared/schema.ts
export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  mrn: varchar('mrn', { length: 50 }).notNull(),
  nameEncrypted: text('name_encrypted'),
  dateOfBirth: date('date_of_birth'),
  facilityId: varchar('facility_id', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => ({
  uniqMrnFacility: uniqueIndex('patients_mrn_facility_idx').on(table.mrn, table.facilityId),
  mrnIdx: index('patients_mrn_idx').on(table.mrn),
}));
```

---

#### `cases`
Primary abstraction workflow unit.

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) NOT NULL UNIQUE,  -- E12345, legacy IDs

  -- Relationships
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  specialty_id VARCHAR(50) NOT NULL REFERENCES specialties(id),
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | IN_PROGRESS | PENDING_REVIEW | REVIEWED | CLOSED
  priority VARCHAR(20) DEFAULT 'NORMAL',
    -- LOW | NORMAL | HIGH | URGENT

  -- Workflow
  assigned_to UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_cases_patient ON cases(patient_id);
CREATE INDEX idx_cases_specialty_module ON cases(specialty_id, module_id);
CREATE INDEX idx_cases_status ON cases(status) WHERE status != 'CLOSED';
CREATE INDEX idx_cases_assigned ON cases(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_cases_updated ON cases(updated_at DESC);
```

**Drizzle Schema:**
```typescript
export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseNumber: varchar('case_number', { length: 50 }).notNull().unique(),

  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'restrict' }),
  specialtyId: varchar('specialty_id', { length: 50 }).notNull().references(() => specialties.id),
  moduleId: varchar('module_id', { length: 100 }).notNull().references(() => modules.id),

  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  priority: varchar('priority', { length: 20 }).default('NORMAL'),

  assignedTo: uuid('assigned_to').references(() => users.id),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
});
```

---

#### `case_payloads`
Stores full clinical data (JSONB for flexibility).

```sql
CREATE TABLE case_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  -- Clinical data
  payload JSONB NOT NULL,
    -- Full JSON structure from sampleCase.USNWR_SCH.json
    -- Contains: patient, encounter, events, times, consults, imaging,
    --           surgery, anesthesia, clinical, derived, flags, outcomes, notes

  payload_version VARCHAR(10) DEFAULT '1.0',
  payload_hash TEXT,  -- For change detection

  -- Metadata
  source VARCHAR(50),  -- 'CABOODLE' | 'MANUAL_ENTRY' | 'API_IMPORT'
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by UUID REFERENCES users(id),

  CONSTRAINT one_payload_per_case UNIQUE(case_id)
);

CREATE INDEX idx_case_payloads_case ON case_payloads(case_id);
CREATE INDEX idx_case_payloads_source ON case_payloads(source);

-- JSONB indexes for common queries
CREATE INDEX idx_case_payloads_mrn ON case_payloads
  USING gin ((payload->'patient'->>'mrn') gin_trgm_ops);
CREATE INDEX idx_case_payloads_arrival ON case_payloads
  ((payload->'times'->>'ArrivalInstant'));
```

**Drizzle Schema:**
```typescript
export const casePayloads = pgTable('case_payloads', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }).unique(),

  payload: jsonb('payload').notNull(),
  payloadVersion: varchar('payload_version', { length: 10 }).default('1.0'),
  payloadHash: text('payload_hash'),

  source: varchar('source', { length: 50 }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
});
```

---

#### `encounters` (Optional - for multi-encounter tracking)
If you need to track multiple encounters per patient.

```sql
CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id VARCHAR(50) NOT NULL UNIQUE,  -- External encounter ID

  patient_id UUID NOT NULL REFERENCES patients(id),
  case_id UUID REFERENCES cases(id),  -- Link to abstraction case

  encounter_type VARCHAR(50),  -- 'ED' | 'INPATIENT' | 'OUTPATIENT'
  location VARCHAR(100),
  disposition VARCHAR(50),

  arrival_ts TIMESTAMPTZ,
  discharge_ts TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_encounters_patient ON encounters(patient_id);
CREATE INDEX idx_encounters_case ON encounters(case_id);
CREATE INDEX idx_encounters_arrival ON encounters(arrival_ts);
```

---

### 2. Configuration & Metadata

#### `specialties`
```sql
CREATE TABLE specialties (
  id VARCHAR(50) PRIMARY KEY,  -- 'orthopedics', 'cardiology'
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO specialties (id, name, display_name, description, display_order) VALUES
  ('orthopedics', 'Orthopedics', 'Orthopedics (Pediatric)', 'Pediatric orthopedic quality measures', 1),
  ('cardiology', 'Cardiology', 'Cardiology', 'Cardiac care quality measures', 2),
  ('neurosurgery', 'Neurosurgery', 'Neurosurgery', 'Neurosurgical quality measures', 3);
```

**Drizzle Schema:**
```typescript
export const specialties = pgTable('specialties', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

#### `modules`
```sql
CREATE TABLE modules (
  id VARCHAR(100) PRIMARY KEY,  -- 'timeliness_sch', 'documentation_sch'
  specialty_id VARCHAR(50) NOT NULL REFERENCES specialties(id),

  name VARCHAR(200) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,

  -- USNWR question mapping
  usnwr_question_id VARCHAR(50),
  usnwr_question_text TEXT,

  -- Configuration
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_modules_specialty ON modules(specialty_id, display_order);

-- Example data from specialtyMetadata.ts
INSERT INTO modules (id, specialty_id, name, display_name, description, usnwr_question_id, display_order) VALUES
  ('timeliness_sch', 'orthopedics', 'Timeliness – SCH', 'Timeliness – SCH (≤19h)',
   'Track whether supracondylar humerus fractures received surgery within 19 hours of ED arrival',
   'sch_19h', 1),
  ('documentation_sch', 'orthopedics', 'Documentation – SCH', 'Documentation – SCH',
   'Validate documentation completeness for SCH cases',
   'sch_docs', 2);
```

**Drizzle Schema:**
```typescript
export const modules = pgTable('modules', {
  id: varchar('id', { length: 100 }).primaryKey(),
  specialtyId: varchar('specialty_id', { length: 50 }).notNull().references(() => specialties.id),
  name: varchar('name', { length: 200 }).notNull(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  description: text('description'),
  usnwrQuestionId: varchar('usnwr_question_id', { length: 50 }),
  usnwrQuestionText: text('usnwr_question_text'),
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

#### `signal_definitions`
Replaces hardcoded `orthoSignalMatrix.ts`.

```sql
CREATE TABLE signal_definitions (
  id VARCHAR(100) PRIMARY KEY,  -- 'on_time_19h', 'dx_confirmed'
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  label VARCHAR(200) NOT NULL,
  group_name VARCHAR(50),  -- 'Core' | 'Delay Drivers' | 'Documentation'

  definition TEXT,
  tooltip TEXT,

  -- Evidence configuration
  allowed_cites JSONB,  -- Array of allowed evidence paths
    -- Example: ["times.ArrivalInstant", "times.IncisionStartInstant"]

  -- Validation rules
  validation_rule TEXT,  -- SQL or JS expression
    -- Example: "hours_to_surgery <= 19"

  -- Triggering logic
  triggers TEXT[],
  expected_status VARCHAR(20),  -- 'pass' | 'fail' | 'caution' | 'inactive'

  -- Display
  display_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signal_defs_module ON signal_definitions(module_id, display_order);
CREATE INDEX idx_signal_defs_group ON signal_definitions(module_id, group_name);

-- Example from orthoSignalMatrix.ts
INSERT INTO signal_definitions (id, module_id, label, group_name, definition, allowed_cites, validation_rule, display_order) VALUES
  ('on_time_19h', 'timeliness_sch', 'Incision within 19h of ED arrival', 'Core',
   'Delta between ED arrival and incision start ≤19 hours',
   '["times.ArrivalInstant", "times.IncisionStartInstant", "derived.arrival_to_surgery_min"]'::jsonb,
   'hours_to_surgery <= 19',
   1),
  ('dx_confirmed', 'timeliness_sch', 'Diagnosis confirmed as SCH', 'Core',
   'Operative report or imaging confirms supracondylar humerus fracture',
   '["notes.delay_summary", "surgery.procedure", "imaging.xray"]'::jsonb,
   NULL,
   2);
```

**Drizzle Schema:**
```typescript
export const signalDefinitions = pgTable('signal_definitions', {
  id: varchar('id', { length: 100 }).primaryKey(),
  moduleId: varchar('module_id', { length: 100 }).notNull().references(() => modules.id),
  label: varchar('label', { length: 200 }).notNull(),
  groupName: varchar('group_name', { length: 50 }),
  definition: text('definition'),
  tooltip: text('tooltip'),
  allowedCites: jsonb('allowed_cites'),
  validationRule: text('validation_rule'),
  triggers: text('triggers').array(),
  expectedStatus: varchar('expected_status', { length: 20 }),
  displayOrder: integer('display_order'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

#### `followup_questions`
```sql
CREATE TABLE followup_questions (
  id SERIAL PRIMARY KEY,
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  question_text TEXT NOT NULL,
  display_order INTEGER,

  -- Conditional display
  show_when_signal_id VARCHAR(100) REFERENCES signal_definitions(id),
  show_when_status VARCHAR(20),  -- 'fail' | 'caution'

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_followups_module ON followup_questions(module_id, display_order);

-- Example from planningConfig.tsx
INSERT INTO followup_questions (module_id, question_text, display_order) VALUES
  ('timeliness_sch', 'Does operative report confirm SCH?', 1),
  ('timeliness_sch', 'Were there any documented delays outside ortho control?', 2),
  ('timeliness_sch', 'Was there CT imaging for another injury?', 3);
```

---

### 3. AI & Abstraction

#### `abstraction_runs`
Tracks AI processing attempts (replaces ENRICH__AI_RUN).

```sql
CREATE TABLE abstraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  -- Run configuration
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  model_name VARCHAR(50) NOT NULL,  -- 'gpt-4o', 'gpt-4o-mini'
  model_params JSONB,  -- { temperature, max_tokens, etc. }

  -- Input snapshot (for reproducibility)
  input_payload JSONB NOT NULL,
  input_hash TEXT NOT NULL,

  -- Execution
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,

  -- Output
  raw_response JSONB,
  error_message TEXT,

  -- Metrics
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,

  -- Metadata
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_abstraction_runs_case ON abstraction_runs(case_id, started_at DESC);
CREATE INDEX idx_abstraction_runs_status ON abstraction_runs(status) WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_abstraction_runs_prompt ON abstraction_runs(prompt_version_id);
```

**Drizzle Schema:**
```typescript
export const abstractionRuns = pgTable('abstraction_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  promptVersionId: uuid('prompt_version_id').notNull().references(() => promptVersions.id),
  modelName: varchar('model_name', { length: 50 }).notNull(),
  modelParams: jsonb('model_params'),
  inputPayload: jsonb('input_payload').notNull(),
  inputHash: text('input_hash').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  rawResponse: jsonb('raw_response'),
  errorMessage: text('error_message'),
  tokensPrompt: integer('tokens_prompt'),
  tokensCompletion: integer('tokens_completion'),
  tokensTotal: integer('tokens_total'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  durationMs: integer('duration_ms'),
  createdBy: uuid('created_by').references(() => users.id),
});
```

---

#### `abstraction_results`
Validated signals from AI + human review.

```sql
CREATE TABLE abstraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES abstraction_runs(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  signal_id VARCHAR(100) NOT NULL REFERENCES signal_definitions(id),

  -- Signal outcome
  status VARCHAR(20) NOT NULL,  -- 'pass' | 'fail' | 'caution' | 'inactive'
  confidence NUMERIC(3, 2),  -- 0.00 to 1.00

  -- Evidence
  finding TEXT,  -- Human-readable finding
  reason TEXT,   -- Short explanation (≤10 words per promptRouting.ts)

  -- Source tracking (from current abstraction results)
  source VARCHAR(20) NOT NULL,  -- 'AI' | 'RULE' | 'HUMAN'
  is_enriched BOOLEAN DEFAULT false,  -- Whether human-edited

  -- Validation
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_abstraction_results_run ON abstraction_results(run_id);
CREATE INDEX idx_abstraction_results_case_signal ON abstraction_results(case_id, signal_id);
CREATE INDEX idx_abstraction_results_status ON abstraction_results(status);

-- Ensure one result per signal per run
CREATE UNIQUE INDEX idx_abstraction_results_unique ON abstraction_results(run_id, signal_id);
```

**Drizzle Schema:**
```typescript
export const abstractionResults = pgTable('abstraction_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => abstractionRuns.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  signalId: varchar('signal_id', { length: 100 }).notNull().references(() => signalDefinitions.id),

  status: varchar('status', { length: 20 }).notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  finding: text('finding'),
  reason: text('reason'),

  source: varchar('source', { length: 20 }).notNull(),
  isEnriched: boolean('is_enriched').default(false),

  validatedBy: uuid('validated_by').references(() => users.id),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueRunSignal: uniqueIndex('abstraction_results_run_signal_idx').on(table.runId, table.signalId),
}));
```

---

#### `signal_evidence`
Tracks cites for each signal (critical for transparency).

```sql
CREATE TABLE signal_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES abstraction_results(id) ON DELETE CASCADE,

  -- Evidence details
  field_path VARCHAR(200) NOT NULL,  -- 'times.ArrivalInstant'
  field_value TEXT,
  field_type VARCHAR(50),  -- 'timestamp' | 'string' | 'boolean' | 'number'

  -- Context
  excerpt TEXT,  -- Relevant excerpt from notes/reports
  confidence NUMERIC(3, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signal_evidence_result ON signal_evidence(result_id);
CREATE INDEX idx_signal_evidence_field ON signal_evidence(field_path);

-- Example:
-- For signal "on_time_19h", cites would include:
-- { field_path: "times.ArrivalInstant", field_value: "2025-08-15T10:40:00Z", field_type: "timestamp" }
-- { field_path: "times.IncisionStartInstant", field_value: "2025-08-16T02:05:00Z", field_type: "timestamp" }
-- { field_path: "derived.arrival_to_surgery_min", field_value: "920", field_type: "number" }
```

**Drizzle Schema:**
```typescript
export const signalEvidence = pgTable('signal_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  resultId: uuid('result_id').notNull().references(() => abstractionResults.id, { onDelete: 'cascade' }),
  fieldPath: varchar('field_path', { length: 200 }).notNull(),
  fieldValue: text('field_value'),
  fieldType: varchar('field_type', { length: 50 }),
  excerpt: text('excerpt'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

#### `prompts`
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Routing key (from promptRouting.ts)
  specialty_id VARCHAR(50) REFERENCES specialties(id),
  module_id VARCHAR(100) REFERENCES modules(id),
  prompt_type VARCHAR(50) NOT NULL,
    -- 'abstraction_help' | 'signal_processing' | 'automapper' | 'default'

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Current version
  current_version_id UUID,  -- FK added after prompt_versions created

  -- Metadata
  owner_id UUID REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Routing key must be unique
  UNIQUE(specialty_id, module_id, prompt_type)
);

CREATE INDEX idx_prompts_routing ON prompts(specialty_id, module_id, prompt_type);
```

**Drizzle Schema:**
```typescript
export const prompts = pgTable('prompts', {
  id: uuid('id').defaultRandom().primaryKey(),
  specialtyId: varchar('specialty_id', { length: 50 }).references(() => specialties.id),
  moduleId: varchar('module_id', { length: 100 }).references(() => modules.id),
  promptType: varchar('prompt_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  currentVersionId: uuid('current_version_id'),
  ownerId: uuid('owner_id').references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueRouting: uniqueIndex('prompts_routing_idx').on(
    table.specialtyId, table.moduleId, table.promptType
  ),
}));
```

---

#### `prompt_versions`
```sql
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,

  version_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,

  -- Configuration
  model_instructions JSONB,  -- Additional model-specific config

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | TESTING | APPROVED | ARCHIVED
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(prompt_id, version_number)
);

CREATE INDEX idx_prompt_versions_prompt ON prompt_versions(prompt_id, version_number DESC);
CREATE INDEX idx_prompt_versions_status ON prompt_versions(status) WHERE status = 'APPROVED';

-- Add FK constraint to prompts.current_version_id
ALTER TABLE prompts
  ADD CONSTRAINT fk_prompts_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES prompt_versions(id);
```

---

### 4. Quality & Feedback

#### `case_reviews`
Human review workflow (replaces OPS__ENCOUNTER_CASE).

```sql
CREATE TABLE case_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  run_id UUID REFERENCES abstraction_runs(id),  -- Which AI run is being reviewed

  -- Review state
  review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | IN_PROGRESS | COMPLETED | REJECTED

  -- Comments
  reviewer_comment TEXT,
  clinical_notes TEXT,

  -- Workflow
  assigned_to UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  -- Quality metrics
  signals_correct INTEGER,
  signals_incorrect INTEGER,
  signals_modified INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_case_reviews_case ON case_reviews(case_id);
CREATE INDEX idx_case_reviews_status ON case_reviews(review_status)
  WHERE review_status IN ('PENDING', 'IN_PROGRESS');
CREATE INDEX idx_case_reviews_assigned ON case_reviews(assigned_to)
  WHERE assigned_to IS NOT NULL;
```

---

#### `feedback`
User feedback on individual signals.

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  result_id UUID NOT NULL REFERENCES abstraction_results(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id),
  signal_id VARCHAR(100) NOT NULL REFERENCES signal_definitions(id),

  -- Feedback content
  feedback_type VARCHAR(20) NOT NULL,
    -- 'CORRECT' | 'INCORRECT' | 'MISSING_EVIDENCE' | 'HALLUCINATION' | 'OTHER'
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,

  -- Suggested correction
  suggested_status VARCHAR(20),
  suggested_finding TEXT,

  -- User
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_result ON feedback(result_id);
CREATE INDEX idx_feedback_signal ON feedback(signal_id);
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_user ON feedback(user_id);
```

---

#### `audit_log`
Comprehensive change tracking.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity tracking
  entity_type VARCHAR(50) NOT NULL,  -- 'case' | 'signal' | 'payload' | 'prompt'
  entity_id UUID NOT NULL,

  -- Change details
  action VARCHAR(20) NOT NULL,  -- 'CREATE' | 'UPDATE' | 'DELETE' | 'REVIEW'
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,

  -- Context
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

---

## Migration Strategy: localStorage → PostgreSQL

### Phase 1: Coexistence (Week 1-2)

1. **Create tables** in production (non-blocking)
2. **Dual-write**: Save to both localStorage AND database
3. **Read from localStorage** (existing behavior)
4. **Validate**: Compare localStorage vs. DB in background

**Implementation:**
```typescript
// server/storage.ts
export class HybridStorage {
  async saveCaseResult(caseData: ProcessedCase) {
    // Save to localStorage (existing)
    localStorage.setItem('abstraction.cases', JSON.stringify(cases));

    // NEW: Also save to PostgreSQL
    await db.insert(cases).values({
      caseNumber: caseData.selectedCaseId,
      patientId: await this.getOrCreatePatient(caseData.patient_payload.patient),
      specialtyId: caseData.selectedSpecialty,
      moduleId: caseData.selectedModuleId,
      status: 'IN_PROGRESS',
    });

    await db.insert(abstractionResults).values(
      caseData.mergedSignals.map(signal => ({
        caseId: caseId,
        signalId: signal.id,
        status: signal.status,
        finding: signal.evidence,
        // ...
      }))
    );
  }
}
```

### Phase 2: Read Migration (Week 3-4)

1. **Backfill**: Migrate all localStorage cases to database
2. **Add "source" field**: Track whether data came from localStorage or DB
3. **Switch reads**: API reads from database first, fallback to localStorage
4. **Monitor**: Track read success rates

**Migration script:**
```typescript
// server/migrations/backfill-localstorage.ts
export async function migrateLocalStorageCases() {
  const localCases = JSON.parse(localStorage.getItem('abstraction.cases') || '[]');

  for (const localCase of localCases) {
    // Check if already migrated
    const exists = await db.select().from(cases)
      .where(eq(cases.caseNumber, localCase.selectedCaseId))
      .limit(1);

    if (exists.length > 0) continue;

    // Create patient
    const patient = await db.insert(patients).values({
      mrn: localCase.patient_payload.patient.mrn,
      nameEncrypted: encrypt(localCase.patient_payload.patient.name),
      createdBy: MIGRATION_USER_ID,
    }).returning();

    // Create case
    const case = await db.insert(cases).values({
      caseNumber: localCase.selectedCaseId,
      patientId: patient.id,
      specialtyId: localCase.selectedSpecialty,
      moduleId: localCase.selectedModuleId,
      status: 'REVIEWED',  // Assume completed if in localStorage
      createdBy: MIGRATION_USER_ID,
    }).returning();

    // Create payload
    await db.insert(casePayloads).values({
      caseId: case.id,
      payload: localCase.patient_payload,
      source: 'LOCALSTORAGE_MIGRATION',
      uploadedBy: MIGRATION_USER_ID,
    });

    // Create abstraction results (mock run since we don't have AI run history)
    const mockRun = await db.insert(abstractionRuns).values({
      caseId: case.id,
      promptVersionId: DEFAULT_PROMPT_VERSION_ID,
      modelName: 'unknown',
      inputPayload: localCase.patient_payload,
      inputHash: hashObject(localCase.patient_payload),
      status: 'COMPLETED',
      createdBy: MIGRATION_USER_ID,
    }).returning();

    for (const signal of localCase.mergedSignals) {
      await db.insert(abstractionResults).values({
        runId: mockRun.id,
        caseId: case.id,
        signalId: signal.id,
        status: signal.status,
        finding: signal.evidence,
        source: 'HUMAN',  // Since we don't know if AI or human
        isEnriched: signal.enriched || false,
        createdBy: MIGRATION_USER_ID,
      });
    }
  }

  console.log(`Migrated ${localCases.length} cases from localStorage to PostgreSQL`);
}
```

### Phase 3: Full Cutover (Week 5+)

1. **Remove localStorage reads** from production code
2. **Keep localStorage writes** for 1 week (rollback safety)
3. **Monitor**: Ensure all features work with DB-only reads
4. **Remove localStorage writes**: Full database-backed

---

## Time-Window Views (for UI dropdowns)

```sql
-- Cases updated in last 7 days
CREATE VIEW v_cases_recent AS
  SELECT c.*, p.mrn, s.display_name as specialty_name, m.display_name as module_name
  FROM cases c
  LEFT JOIN patients p ON c.patient_id = p.id
  LEFT JOIN specialties s ON c.specialty_id = s.id
  LEFT JOIN modules m ON c.module_id = m.id
  WHERE c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  ORDER BY c.updated_at DESC;

-- Cases awaiting review
CREATE VIEW v_cases_pending_review AS
  SELECT c.*, COUNT(cr.id) as review_count
  FROM cases c
  LEFT JOIN case_reviews cr ON c.id = cr.case_id
  WHERE c.status IN ('PENDING_REVIEW', 'IN_PROGRESS')
  GROUP BY c.id
  ORDER BY c.updated_at DESC;

-- Signal accuracy metrics
CREATE VIEW v_signal_accuracy AS
  SELECT
    sd.id as signal_id,
    sd.label,
    sd.module_id,
    COUNT(ar.id) as total_evaluations,
    COUNT(ar.id) FILTER (WHERE f.feedback_type = 'CORRECT') as correct_count,
    COUNT(ar.id) FILTER (WHERE f.feedback_type = 'INCORRECT') as incorrect_count,
    ROUND(
      100.0 * COUNT(ar.id) FILTER (WHERE f.feedback_type = 'CORRECT') /
      NULLIF(COUNT(ar.id), 0), 2
    ) as accuracy_pct
  FROM signal_definitions sd
  LEFT JOIN abstraction_results ar ON sd.id = ar.signal_id
  LEFT JOIN feedback f ON ar.id = f.result_id
  WHERE ar.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
  GROUP BY sd.id, sd.label, sd.module_id;
```

---

## Drizzle Migration Files

### Initial Migration: Create Core Tables

```typescript
// migrations/0001_create_core_tables.ts
import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export async function up(db: Database) {
  // Enable pgcrypto for gen_random_uuid()
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);  // For text search

  // Create specialties table
  await db.execute(sql`
    CREATE TABLE specialties (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default specialties
  await db.execute(sql`
    INSERT INTO specialties (id, name, display_name, description, display_order) VALUES
      ('orthopedics', 'Orthopedics', 'Orthopedics (Pediatric)', 'Pediatric orthopedic quality measures', 1),
      ('cardiology', 'Cardiology', 'Cardiology', 'Cardiac care quality measures', 2),
      ('neurosurgery', 'Neurosurgery', 'Neurosurgery', 'Neurosurgical quality measures', 3),
      ('general_surgery', 'General Surgery', 'General Surgery', 'General surgical quality measures', 4),
      ('pediatrics', 'Pediatrics', 'Pediatrics', 'Pediatric quality measures', 5),
      ('emergency_medicine', 'Emergency Medicine', 'Emergency Medicine', 'Emergency department quality measures', 6),
      ('internal_medicine', 'Internal Medicine', 'Internal Medicine', 'Internal medicine quality measures', 7),
      ('anesthesiology', 'Anesthesiology', 'Anesthesiology', 'Anesthesia quality measures', 8);
  `);

  // Create modules table
  await db.execute(sql`
    CREATE TABLE modules (
      id VARCHAR(100) PRIMARY KEY,
      specialty_id VARCHAR(50) NOT NULL REFERENCES specialties(id),
      name VARCHAR(200) NOT NULL,
      display_name VARCHAR(200) NOT NULL,
      description TEXT,
      usnwr_question_id VARCHAR(50),
      usnwr_question_text TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_modules_specialty ON modules(specialty_id, display_order);
  `);

  // Create patients table
  await db.execute(sql`
    CREATE TABLE patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mrn VARCHAR(50) NOT NULL,
      name_encrypted TEXT,
      date_of_birth DATE,
      facility_id VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by UUID REFERENCES users(id)
    );

    CREATE UNIQUE INDEX patients_mrn_facility_idx ON patients(mrn, facility_id);
    CREATE INDEX patients_mrn_idx ON patients(mrn);
  `);

  // Create cases table
  await db.execute(sql`
    CREATE TABLE cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_number VARCHAR(50) NOT NULL UNIQUE,
      patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
      specialty_id VARCHAR(50) NOT NULL REFERENCES specialties(id),
      module_id VARCHAR(100) NOT NULL REFERENCES modules(id),
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      priority VARCHAR(20) DEFAULT 'NORMAL',
      assigned_to UUID REFERENCES users(id),
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    );

    CREATE INDEX idx_cases_patient ON cases(patient_id);
    CREATE INDEX idx_cases_specialty_module ON cases(specialty_id, module_id);
    CREATE INDEX idx_cases_status ON cases(status) WHERE status != 'CLOSED';
    CREATE INDEX idx_cases_updated ON cases(updated_at DESC);
  `);

  // Create case_payloads table
  await db.execute(sql`
    CREATE TABLE case_payloads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      payload_version VARCHAR(10) DEFAULT '1.0',
      payload_hash TEXT,
      source VARCHAR(50),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      uploaded_by UUID REFERENCES users(id)
    );

    CREATE INDEX idx_case_payloads_case ON case_payloads(case_id);
    CREATE INDEX idx_case_payloads_mrn ON case_payloads USING gin ((payload->'patient'->>'mrn') gin_trgm_ops);
  `);
}

export async function down(db: Database) {
  await db.execute(sql`DROP TABLE IF EXISTS case_payloads CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS cases CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS patients CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS modules CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS specialties CASCADE;`);
}
```

---

## Key Differences from Proposed v4 Schema

| Aspect | Proposed v4 (Snowflake) | HealthLevers v1.0 (PostgreSQL) |
|--------|-------------------------|--------------------------------|
| **Platform** | Snowflake | PostgreSQL (Neon) |
| **ORM** | None (raw SQL) | Drizzle ORM + TypeScript |
| **Data Types** | VARIANT, IDENTITY | JSONB, SERIAL, UUID |
| **Primary Keys** | STRING | UUID (gen_random_uuid()) |
| **Naming** | CORE__ENCOUNTER_CONTEXT | cases, case_payloads |
| **Terminology** | encounter_id + encounter_key | case_number + case_id |
| **Episodes** | CORE__EPISODE_MAP | Not needed (single encounters) |
| **Signals** | SIGNAL_LEDGER (normalized) | abstraction_results + signal_evidence |
| **Case States** | OPS__ENCOUNTER_CASE (OPEN/IN_REVIEW/CLOSED) | cases.status + case_reviews.review_status |
| **TEST/PROD** | mode column + secure views | Single environment (for now) |
| **Evidence** | Not tracked | signal_evidence table (critical!) |
| **Prompts** | PROMPT__DEF + PROMPT__BIND | prompts + prompt_versions (versioned) |
| **Metadata** | Hardcoded/external | specialties, modules, signal_definitions |
| **Audit** | Minimal | Full audit_log table |

---

## Recommendations

### ✅ Implement Immediately (Phase 1)

1. **Core tables**: patients, cases, case_payloads
2. **Configuration tables**: specialties, modules (seed from existing JSON)
3. **Dual-write**: localStorage + PostgreSQL
4. **Migration script**: Backfill existing localStorage cases

### ✅ Implement Next (Phase 2)

1. **Signal tables**: signal_definitions, abstraction_runs, abstraction_results, signal_evidence
2. **Prompt tables**: prompts, prompt_versions
3. **Switch API reads**: Database-first, localStorage fallback
4. **Admin UI**: Manage specialties/modules/signals

### ⏸️ Defer (Phase 3+)

1. **encounters table**: Only if multi-encounter tracking needed
2. **Case reviews**: Add when ready for formal review workflow
3. **Feedback system**: Add after initial rollout
4. **Audit log**: Implement via triggers/ORM hooks

### ❌ Don't Implement Yet

1. **Episode mapping**: Not in current scope
2. **TEST/PROD split**: Use separate databases if needed
3. **Time-window secure views**: Start with simple views, add security later
4. **Clustering/partitioning**: Wait until data volume justifies

---

## Next Steps

1. **Review this schema** with your team
2. **Create first migration**: Core tables (patients, cases, case_payloads, specialties, modules)
3. **Update `shared/schema.ts`** with Drizzle definitions
4. **Test dual-write** in development
5. **Plan metadata migration**: Load from `specialtyMetadata.ts` and `orthoSignalMatrix.ts` into database
6. **Update API layer**: Read from database instead of JSON files

This schema will serve your project well because it:
- ✅ Matches your actual data model (cases, not encounters)
- ✅ Uses PostgreSQL (your current database)
- ✅ Supports Drizzle ORM (your current ORM)
- ✅ Tracks evidence (critical for AI transparency)
- ✅ Enables incremental migration (localStorage → DB)
- ✅ Allows specialty expansion (metadata-driven)
- ✅ Provides audit trail (provenance tracking)

**Ready to implement?** Let me know and I can help with:
- Creating the Drizzle migration files
- Writing the migration scripts
- Updating the API layer
- Building the admin UI for metadata management
