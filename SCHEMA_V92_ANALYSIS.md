# Schema v9.2 Analysis for HealthLevers
## Evaluating Revised GOLD_AI Schema Design

---

## Executive Summary

**Verdict: v9.2 is significantly improved but still cannot serve HealthLevers without substantial adaptations.**

### ✅ Major Improvements from v4:
1. **Evidence tracking added** - `evidence` table for cites (critical improvement!)
2. **Better case workflow** - `case` table with proper states
3. **Unified prompt governance** - Single `prompt` table with metadata
4. **Cleaner naming** - Removed prefixes (CORE__, ENRICH__, etc.)
5. **Better metadata structure** - `metric`, `display_plan`, `signal_group`, `followup`, `provenance_rule`

### ❌ Persistent Issues:
1. **Platform incompatibility** - Still Snowflake (VARIANT, TIMESTAMP_NTZ) vs. PostgreSQL
2. **Conceptual mismatch** - Still encounter-centric vs. HealthLevers' case-centric model
3. **Missing entity tables** - No patients, specialties, or modules as first-class entities
4. **Terminology divergence** - "metric" concept doesn't align with HealthLevers' "modules"

### 🎯 Recommendation:
**Hybrid approach**: Adopt v9.2's excellent ideas (evidence table, prompt structure, metadata design) but implement in PostgreSQL-native schema tailored to HealthLevers' case-centric model.

---

## Detailed Analysis

### 1. Improvements from v4 → v9.2

#### ✅ Evidence Table (Critical Addition)

**v4 (Missing):**
```sql
-- NO evidence tracking
ENRICH__SIGNAL_LEDGER (
  signal_id, signal_value, confidence
  -- No way to track WHY or WHERE this value came from
)
```

**v9.2 (Excellent):**
```sql
CREATE TABLE evidence (
  evidence_id STRING PRIMARY KEY,
  patient_id STRING,
  run_id STRING,
  encounter_id STRING NULL,
  signal_code STRING,
  cite_type STRING,        -- note|lab|op|image
  cite_ref STRING,          -- Field path
  span VARIANT,             -- Location in source
  raw_excerpt STRING,       -- Actual excerpt
  created_ts TIMESTAMP_NTZ
);
```

**Analysis:**
- ✅ Solves the AI transparency problem
- ✅ Tracks exact data sources for each signal
- ✅ Enables debugging ("Why did AI make this decision?")
- ✅ Supports cite types (notes, labs, operative reports, imaging)
- ⚠️ Uses VARIANT for span (should be JSONB in PostgreSQL)

**HealthLevers Impact:**
This is **exactly what HealthLevers needs**. Currently, cites are stored as arrays in memory:
```typescript
// current/src/types/usnwrMatrix.ts
signal.cites = ["times.ArrivalInstant", "times.IncisionStartInstant"]
```

The evidence table would persist these properly.

---

#### ✅ Unified Prompt Table

**v4 (Basic):**
```sql
PROMPT__DEF (
  prompt_id, version, text, owner, is_prod_approved, created_ts
)
```

**v9.2 (Enhanced):**
```sql
CREATE TABLE prompt (
  metric_id STRING,
  prompt_type STRING,        -- abstraction_help | signal_processing | automapper
  persona STRING,             -- Who the AI is
  purpose STRING,             -- Why this prompt exists
  description STRING,         -- Human-readable description
  prompt_text STRING,         -- Actual prompt content
  classifier_1 STRING,        -- Categorization
  classifier_2 STRING,        -- Sub-categorization
  content_version STRING,     -- Version tracking
  last_changed_at TIMESTAMP_NTZ
);
```

**Analysis:**
- ✅ Richer metadata (persona, purpose, description)
- ✅ Classifier fields for organization
- ✅ Content versioning built-in
- ⚠️ No separate prompt_versions table (versioning via content_version string)
- ⚠️ Tied to metric_id (should support specialty + module in HealthLevers)

**HealthLevers Impact:**
Better than v4, but HealthLevers already has structured prompt routing:
```typescript
// shared/promptRouting.ts
resolvePromptKey(specialty, module, type)
→ "Orthopedics:timeliness_sch:abstraction_help"
```

Should adapt v9.2 structure to support specialty + module routing.

---

#### ✅ Case Workflow Table

**v4 (Basic):**
```sql
OPS__ENCOUNTER_CASE (
  encounter_id PRIMARY KEY,
  case_state STRING,         -- 'OPEN'|'IN_REVIEW'|'CLOSED'
  state_comment STRING,
  updated_ts, updated_by
)
```

**v9.2 (Better):**
```sql
CREATE TABLE case (
  case_id STRING PRIMARY KEY,        -- UUID, not encounter_id
  patient_id STRING,
  encounter_id STRING NULL,          -- Optional encounter link
  specialty STRING,                  -- What specialty
  module_code STRING NULL,           -- What module
  case_state STRING,                 -- 'OPEN'|'IN_REVIEW'|'CLOSED'
  state_comment STRING,
  first_seen_ts TIMESTAMP_NTZ,
  updated_ts TIMESTAMP_NTZ,
  updated_by STRING
);
```

**Analysis:**
- ✅ case_id as primary key (much better!)
- ✅ encounter_id is optional (allows non-encounter cases)
- ✅ specialty + module_code tracked
- ✅ first_seen_ts for audit
- ⚠️ Still treats specialty/module as strings (no FK to reference tables)
- ⚠️ No assigned_to, reviewed_by (workflow assignment missing)

**HealthLevers Impact:**
This is closer to HealthLevers' needs. Current cases have:
```typescript
{
  selectedCaseId: "E12345",           // → case_id
  selectedSpecialty: "Orthopedics",   // → specialty
  selectedModuleId: "timeliness_sch", // → module_code
  // status not tracked (localStorage only)
}
```

Good alignment, but needs FK constraints to specialty/module tables.

---

#### ✅ Metadata Tables

**New in v9.2:**
```sql
metric           -- USNWR quality metrics
display_plan     -- UI tier configuration
signal_group     -- Signal groupings
signal_def       -- Signal definitions
followup         -- Conditional followup questions
provenance_rule  -- Field → source mapping
```

**Analysis:**
- ✅ Comprehensive metadata structure
- ✅ UI configuration database-driven (display_plan)
- ✅ Provenance rules formalized (huge improvement!)
- ✅ Followup questions with conditionals
- ⚠️ "metric" concept assumes USNWR-style metrics (doesn't directly map to HealthLevers' modules)

**HealthLevers Mapping:**

| v9.2 Concept | HealthLevers Equivalent | Notes |
|--------------|-------------------------|-------|
| `metric` | `module` | Similar but different granularity |
| `metric.specialty` | `specialties` table | Should be FK, not string |
| `display_plan` | `planningConfig.tsx` | Currently hardcoded, should be DB |
| `signal_def` | `orthoSignalMatrix.ts` | Currently 483+ hardcoded signals |
| `followup` | `planningConfig.followups` | Currently hardcoded array |
| `provenance_rule` | (Not implemented) | NEW - would be very valuable! |

The metadata structure is excellent but needs to be adapted to HealthLevers' terminology.

---

#### ✅ Cleaner Naming

**v4:**
```
CORE__ENCOUNTER_CONTEXT
ENRICH__AI_RUN
ENRICH__SIGNAL_LEDGER
OPS__ENCOUNTER_CASE
PROMPT__DEF
EVAL__TEST_SUITE
```

**v9.2:**
```
encounter_context
ai_run
signal_ledger
case
prompt
test_suite
```

**Analysis:**
- ✅ Much more readable
- ✅ Standard SQL naming conventions
- ✅ Easier to write queries

---

### 2. Persistent Issues

#### ❌ Platform Incompatibility (Snowflake vs. PostgreSQL)

**v9.2 DDL:**
```sql
context VARIANT              -- Snowflake type
TIMESTAMP_NTZ                -- Snowflake type
DATEADD(day,-7,...)          -- Snowflake function
CURRENT_TIMESTAMP()          -- Snowflake syntax
```

**HealthLevers Requirements:**
```sql
context JSONB                -- PostgreSQL type
TIMESTAMPTZ                  -- PostgreSQL type with timezone
CURRENT_TIMESTAMP - INTERVAL '7 days'  -- PostgreSQL syntax
CURRENT_TIMESTAMP            -- PostgreSQL (no parens)
```

**Impact:**
- ❌ All DDL must be rewritten for PostgreSQL
- ❌ VARIANT → JSONB conversion needed
- ❌ Indexes need PostgreSQL GIN/GiST syntax
- ❌ Functions need PostgreSQL equivalents

**Effort:** ~2-3 days to translate all DDL

---

#### ❌ Encounter-Centric vs. Case-Centric

**v9.2 Hierarchy:**
```
encounter_context (PRIMARY)
  ↓
  encounter_id → case.encounter_id (OPTIONAL)
  ↓
  ai_run.encounter_id
  ↓
  signal_ledger.encounter_id
```

**HealthLevers Hierarchy:**
```
case (PRIMARY)
  ↓
  case_id → case_payloads.case_id
  ↓
  case.patient_id → patients.id
  ↓
  case_payloads.payload.encounter (NESTED JSON)
```

**Key Difference:**
- v9.2: Encounters exist independently; cases link to them
- HealthLevers: Cases are primary; encounter data is nested within case payload

**Example:**

**v9.2 Model:**
```sql
-- Encounter exists first
INSERT INTO encounter_context (encounter_id, patient_id, mrn, context) VALUES
  ('E12345', 'P001', '00112233', '{ ... encounter data ... }');

-- Case links to encounter
INSERT INTO case (case_id, patient_id, encounter_id, specialty, module_code) VALUES
  ('C001', 'P001', 'E12345', 'Orthopedics', 'timeliness_sch');
```

**HealthLevers Model:**
```sql
-- Case exists first
INSERT INTO cases (id, case_number, patient_id, specialty_id, module_id) VALUES
  (uuid_generate_v4(), 'E12345', 'P001', 'orthopedics', 'timeliness_sch');

-- Encounter data is nested in payload
INSERT INTO case_payloads (case_id, payload) VALUES
  ('C001', '{
    "patient": { "mrn": "00112233", ... },
    "encounter": { "id": "E12345", "location": "ED", ... },
    "times": { ... },
    ...
  }');
```

**Impact:**
- ⚠️ Fundamental data modeling difference
- ⚠️ Query patterns differ significantly
- ⚠️ Migration complexity increases

**Which is better for HealthLevers?**
- HealthLevers' current model: Cases are the unit of work for quality abstraction
- Encounter data changes rarely (frozen at case creation)
- No need for encounter-level updates or multi-case-per-encounter tracking
- **Verdict:** Case-centric model is better fit for HealthLevers

---

#### ❌ Missing Entity Tables

**What's Missing:**

| Entity | v9.2 | HealthLevers Needs | Why Critical |
|--------|------|---------------------|--------------|
| **Patients** | `patient_id STRING` | `patients` table with demographics | Track MRN, name, DOB, facility across cases |
| **Specialties** | `specialty STRING` | `specialties` table | 8 specialties, need metadata (display name, order, active flag) |
| **Modules** | `module_code STRING` | `modules` table | 11+ modules per specialty, need metadata |
| **Users** | `updated_by STRING` | `users` table (already exists) | FK constraint for audit trail |

**Impact:**
- ❌ No referential integrity (can insert invalid specialty/module)
- ❌ No patient demographics (just an ID)
- ❌ No specialty/module metadata (display names, ordering, descriptions)
- ❌ Cannot query "all cases for patient MRN 00112233" (MRN buried in encounter_context.context)

**Example Problem:**
```sql
-- v9.2: Can insert invalid data
INSERT INTO case (case_id, patient_id, specialty, module_code) VALUES
  ('C001', 'P001', 'Basketweaving', 'invalid_module');  -- ❌ No FK constraint

-- HealthLevers v1.0: FK prevents invalid data
INSERT INTO cases (id, patient_id, specialty_id, module_id) VALUES
  (uuid_generate_v4(), 'P001', 'basketweaving', 'invalid_module');
  -- ERROR: FK constraint "cases_specialty_id_fkey" violated ✅
```

---

#### ❌ "Metric" vs. "Module" Terminology

**v9.2 Concept:**
```
metric = USNWR quality measure
  Examples: "SCH timeliness", "Documentation completeness"
  Tied to: specialty, domain, threshold_hours
```

**HealthLevers Concept:**
```
module = Abstraction workflow unit
  Examples: "timeliness_sch", "documentation_sch"
  Tied to: specialty, USNWR question, signal matrix, followups, prompts
```

**Differences:**

| Aspect | v9.2 "metric" | HealthLevers "module" |
|--------|---------------|------------------------|
| **Granularity** | Quality measure | Abstraction workflow |
| **Scope** | Single metric (e.g., ≤19h) | Multiple signals grouped |
| **Signals** | 1:N (metric → signals) | 1:N (module → signals) |
| **UI** | Dashboard metric card | Full abstraction interface |
| **Workflow** | Reporting/analytics | Human-in-loop abstraction |

**Example:**

**v9.2:**
```sql
INSERT INTO metric (metric_id, specialty, metric_name, domain, threshold_hours) VALUES
  ('M001', 'Orthopedics', 'SCH timeliness', 'Timeliness', 19);
```

**HealthLevers:**
```sql
INSERT INTO modules (id, specialty_id, name, display_name, usnwr_question_id) VALUES
  ('timeliness_sch', 'orthopedics',
   'Timeliness – SCH',
   'Timeliness – SCH (≤19h)',
   'sch_19h');
```

**Impact:**
- ⚠️ Conceptual mismatch in terminology
- ⚠️ Would require renaming throughout HealthLevers codebase
- **Recommendation:** Keep "module" terminology for HealthLevers; adapt v9.2 "metric" concept as needed

---

### 3. Table-by-Table Comparison

#### encounter_context (v9.2) vs. cases + case_payloads (HealthLevers)

| Feature | v9.2: encounter_context | HealthLevers: cases + case_payloads |
|---------|-------------------------|-------------------------------------|
| **Purpose** | Store clinical encounter data | Store abstraction case + clinical data |
| **Primary Key** | encounter_id (STRING) | cases.id (UUID) |
| **Display ID** | encounter_id | cases.case_number |
| **Patient Link** | patient_id (STRING, no FK) | cases.patient_id (UUID, FK to patients) |
| **MRN** | mrn (STRING) | patients.mrn (separate table) |
| **Clinical Data** | context (VARIANT) | case_payloads.payload (JSONB) |
| **Specialty** | ❌ Not in table | cases.specialty_id (FK) |
| **Module** | ❌ Not in table | cases.module_id (FK) |
| **Versioning** | payload_version | payload_version + payload_hash |
| **Source Tracking** | ❌ None | case_payloads.source (CABOODLE/MANUAL/API) |

**Winner:** HealthLevers model - more structured, better referential integrity

---

#### case (v9.2) vs. cases + case_reviews (HealthLevers)

| Feature | v9.2: case | HealthLevers: cases + case_reviews |
|---------|------------|-------------------------------------|
| **Primary Key** | case_id (STRING) | cases.id (UUID) |
| **Patient** | patient_id (STRING, no FK) | patient_id (UUID, FK) |
| **Encounter** | encounter_id (NULL) | Nested in payload |
| **Specialty** | specialty (STRING, no FK) | specialty_id (VARCHAR, FK) |
| **Module** | module_code (STRING, no FK) | module_id (VARCHAR, FK) |
| **Workflow State** | case_state | cases.status + case_reviews.review_status |
| **Comments** | state_comment | case_reviews.reviewer_comment + clinical_notes |
| **Assignment** | ❌ None | cases.assigned_to + reviewed_by |
| **Quality Metrics** | ❌ None | case_reviews.signals_correct/incorrect/modified |

**Winner:** HealthLevers model - richer workflow, quality tracking

---

#### evidence (v9.2) vs. signal_evidence (HealthLevers)

| Feature | v9.2: evidence | HealthLevers: signal_evidence |
|---------|----------------|-------------------------------|
| **Primary Key** | evidence_id | id (UUID) |
| **Run Link** | run_id | result_id (FK to abstraction_results) |
| **Signal Link** | signal_code (STRING) | Implicit via result_id |
| **Cite Type** | cite_type (note/lab/op/image) | ❌ Not categorized |
| **Field Path** | cite_ref | field_path |
| **Location** | span (VARIANT) | ❌ None |
| **Excerpt** | raw_excerpt | excerpt |
| **Field Value** | ❌ None | field_value + field_type |

**Winner:** v9.2 has better cite typing and span tracking; HealthLevers has field_value extraction

**Recommendation:** **Hybrid approach** - combine both:
```sql
CREATE TABLE signal_evidence (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES abstraction_results(id),

  -- From v9.2
  cite_type VARCHAR(20),      -- 'note' | 'lab' | 'op' | 'image' | 'timestamp'
  cite_ref VARCHAR(200),      -- Field path
  span JSONB,                 -- Location in source document
  raw_excerpt TEXT,           -- Full excerpt

  -- From HealthLevers v1.0
  field_value TEXT,           -- Extracted value
  field_type VARCHAR(50),     -- Data type
  confidence NUMERIC(3,2),    -- AI confidence

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

#### prompt (v9.2) vs. prompts + prompt_versions (HealthLevers)

| Feature | v9.2: prompt | HealthLevers: prompts + prompt_versions |
|---------|--------------|----------------------------------------|
| **Granularity** | Single row per metric+type | Separate versions table |
| **Routing** | metric_id + prompt_type | specialty_id + module_id + prompt_type |
| **Metadata** | persona, purpose, description, classifiers | name, description, owner |
| **Prompt Text** | prompt_text (inline) | prompt_versions.prompt_text |
| **Versioning** | content_version (string) | version_number (integer) + full history |
| **Approval** | ❌ None | prompt_versions.status (DRAFT/APPROVED) |
| **Current Version** | Implicit (latest row) | prompts.current_version_id (FK) |

**Winner:** HealthLevers has proper versioning; v9.2 has richer metadata

**Recommendation:** **Hybrid approach**:
```sql
-- Combine v9.2 metadata with HealthLevers versioning
CREATE TABLE prompts (
  id UUID PRIMARY KEY,
  specialty_id VARCHAR(50) REFERENCES specialties(id),
  module_id VARCHAR(100) REFERENCES modules(id),
  prompt_type VARCHAR(50) NOT NULL,

  -- From v9.2
  persona VARCHAR(200),           -- "You are a pediatric quality analyst"
  purpose TEXT,                   -- Why this prompt exists
  classifier_1 VARCHAR(50),       -- Categorization
  classifier_2 VARCHAR(50),       -- Sub-categorization

  -- From HealthLevers v1.0
  name VARCHAR(200),
  description TEXT,
  current_version_id UUID,        -- FK to prompt_versions
  owner_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(specialty_id, module_id, prompt_type)
);

CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES prompts(id),

  version_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,

  -- From v9.2
  content_version VARCHAR(20),    -- Semantic version

  -- From HealthLevers v1.0
  status VARCHAR(20) DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(prompt_id, version_number)
);
```

---

#### signal_ledger (v9.2) vs. abstraction_results (HealthLevers)

| Feature | v9.2: signal_ledger | HealthLevers: abstraction_results |
|---------|---------------------|-----------------------------------|
| **Primary Key** | ❌ Composite (patient+encounter+signal) | id (UUID) |
| **Run Link** | ❌ None | run_id (FK to abstraction_runs) |
| **Signal** | signal_code (STRING) | signal_id (VARCHAR, FK to signal_definitions) |
| **Value** | value (VARIANT) | status + finding + reason |
| **Confidence** | confidence | confidence |
| **Time Range** | start_ts, end_ts | ❌ Point-in-time only |
| **Source** | ❌ None | source (AI/RULE/HUMAN) |
| **Validation** | ❌ None | validated_by, validated_at |

**Winner:** HealthLevers has better provenance; v9.2 has time ranges (not needed for HealthLevers)

---

### 4. What's Good in v9.2 to Adopt

#### ✅ Must Adopt:

1. **Evidence table structure**
   - cite_type categorization
   - span tracking
   - raw_excerpt storage

2. **Prompt metadata**
   - persona field
   - purpose field
   - classifier fields

3. **Provenance rules**
   - Field → source mapping
   - Fallback logic
   - Explicitly document data lineage

4. **Display plan**
   - UI tier configuration
   - Visibility conditions
   - Field ordering

5. **Followup conditions**
   - Conditional question logic
   - response_type tracking

#### ⚠️ Adapt with Changes:

1. **metric → module** (terminology)
2. **encounter_context → cases + case_payloads** (structure)
3. **patient_id STRING → patients table** (add entity)
4. **specialty STRING → specialties table** (add entity)
5. **VARIANT → JSONB** (PostgreSQL)

#### ❌ Don't Adopt:

1. **Encounter-centric hierarchy** (keep case-centric)
2. **Snowflake syntax** (use PostgreSQL)
3. **Missing FK constraints** (add them)
4. **Single prompt table** (keep versioning separate)

---

## Hybrid Schema Recommendation (HealthLevers v2.0)

**Best of both worlds**: v9.2 ideas + PostgreSQL-native + HealthLevers terminology

### Core Changes from HealthLevers v1.0:

1. **Enhanced evidence table** (adopt v9.2 structure):
```sql
CREATE TABLE signal_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES abstraction_results(id) ON DELETE CASCADE,

  -- v9.2 improvements
  cite_type VARCHAR(20) NOT NULL,     -- 'note' | 'lab' | 'operative' | 'image' | 'timestamp' | 'computed'
  cite_ref VARCHAR(200) NOT NULL,     -- Field path (e.g., "times.ArrivalInstant")
  span JSONB,                         -- { "start": 100, "end": 150, "page": 2 }
  raw_excerpt TEXT,                   -- Full text excerpt

  -- HealthLevers v1.0 keeps
  field_value TEXT,                   -- Extracted value
  field_type VARCHAR(50),             -- Data type
  confidence NUMERIC(3,2),            -- AI confidence

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signal_evidence_result ON signal_evidence(result_id);
CREATE INDEX idx_signal_evidence_cite_type ON signal_evidence(cite_type);
CREATE INDEX idx_signal_evidence_cite_ref ON signal_evidence(cite_ref);
```

2. **Enhanced prompts table** (adopt v9.2 metadata):
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id VARCHAR(50) REFERENCES specialties(id),
  module_id VARCHAR(100) REFERENCES modules(id),
  prompt_type VARCHAR(50) NOT NULL,

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- v9.2 additions
  persona VARCHAR(500),              -- "You are an expert pediatric quality analyst..."
  purpose TEXT,                      -- Why this prompt exists
  classifier_1 VARCHAR(50),          -- Primary category
  classifier_2 VARCHAR(50),          -- Secondary category

  current_version_id UUID,
  owner_id UUID REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(specialty_id, module_id, prompt_type)
);
```

3. **Add provenance_rules table** (new from v9.2):
```sql
CREATE TABLE provenance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  field_name VARCHAR(200) NOT NULL,  -- Logical field name
  source_table VARCHAR(100),         -- Source table (if from Caboodle)
  source_field VARCHAR(200),         -- Source field path
  fallback_path VARCHAR(200),        -- Fallback JSON path in payload

  is_required BOOLEAN DEFAULT false,
  validation_rule TEXT,              -- SQL expression or JS function

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(module_id, field_name)
);

-- Example data:
INSERT INTO provenance_rules (module_id, field_name, fallback_path, is_required, validation_rule) VALUES
  ('timeliness_sch', 'ArrivalInstant', 'times.ArrivalInstant', true, 'IS_TIMESTAMP(value)'),
  ('timeliness_sch', 'IncisionStartInstant', 'times.IncisionStartInstant', true, 'IS_TIMESTAMP(value)'),
  ('timeliness_sch', 'PatientAge', 'patient.age', true, 'value >= 0 AND value <= 18');
```

4. **Add display_plan table** (new from v9.2):
```sql
CREATE TABLE display_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  field_name VARCHAR(200) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  tier VARCHAR(20) NOT NULL,         -- 'PRIMARY' | 'SECONDARY' | 'DETAIL' | 'HIDDEN'
  visibility_condition TEXT,         -- JS expression: "signal.status === 'fail'"
  display_order INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(module_id, field_name)
);

CREATE INDEX idx_display_plan_module ON display_plan(module_id, display_order);

-- Example data:
INSERT INTO display_plan (module_id, field_name, field_label, tier, display_order) VALUES
  ('timeliness_sch', 'on_time_19h', 'Incision within 19h of ED arrival', 'PRIMARY', 1),
  ('timeliness_sch', 'dx_confirmed', 'Diagnosis confirmed as SCH', 'PRIMARY', 2),
  ('timeliness_sch', 'npo_violation', 'NPO violation detected', 'SECONDARY', 3);
```

5. **Enhance followup_questions table** (adopt v9.2 conditions):
```sql
CREATE TABLE followup_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id VARCHAR(100) NOT NULL REFERENCES modules(id),

  question_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,

  -- v9.2 additions
  when_condition TEXT,               -- "signal.status === 'fail' && signal.id === 'on_time_19h'"
  response_type VARCHAR(20),         -- 'TEXT' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT'
  response_options JSONB,            -- For SELECT types: ["Option 1", "Option 2"]

  -- HealthLevers keeps
  show_when_signal_id VARCHAR(100) REFERENCES signal_definitions(id),
  show_when_status VARCHAR(20),

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_followups_module ON followup_questions(module_id, display_order);
```

---

## Final Recommendations

### ✅ DO Adopt from v9.2:

1. **Evidence table structure** - cite_type, span, raw_excerpt
2. **Prompt metadata** - persona, purpose, classifiers
3. **Provenance rules** - field → source mapping
4. **Display plan** - UI tier configuration
5. **Followup conditions** - when_condition, response_type
6. **Cleaner naming** - No prefixes, standard SQL naming

### ⚠️ DO Adapt from v9.2:

1. **Translate to PostgreSQL** - VARIANT → JSONB, TIMESTAMP_NTZ → TIMESTAMPTZ
2. **Add entity tables** - patients, specialties, modules (not just string columns)
3. **Keep case-centric** - Don't adopt encounter_context as primary table
4. **Rename metric → module** - Use HealthLevers terminology
5. **Separate version tables** - prompts + prompt_versions (not inline)

### ❌ DON'T Adopt from v9.2:

1. **Encounter-centric hierarchy** - HealthLevers is case-centric
2. **Snowflake syntax** - Not compatible with PostgreSQL
3. **Missing FK constraints** - Add referential integrity
4. **Inline prompt versioning** - Separate versions table is better

---

## Implementation Plan

### Phase 1: Update Schema Design (Week 1)
- Create HealthLevers v2.0 schema combining:
  - v1.0 base (patients, cases, case_payloads, specialties, modules)
  - v9.2 improvements (enhanced evidence, prompt metadata, provenance, display_plan)
- Write Drizzle migration files

### Phase 2: Enhance Existing Tables (Week 2)
- Migrate signal_evidence → enhanced version with cite_type, span
- Migrate prompts → add persona, purpose, classifiers
- Add provenance_rules table
- Add display_plan table
- Enhance followup_questions with conditions

### Phase 3: Implement Backend (Week 3-4)
- Update AI signal processing to populate evidence with cite_type
- Implement provenance rule validation
- Load display_plan configuration from database
- Add followup question conditional logic

### Phase 4: Update Frontend (Week 5-6)
- Display cite_type badges (note/lab/op/image)
- Show evidence excerpts in EvidenceDrawer
- Render followup questions conditionally
- Apply display_plan tiers (primary/secondary/detail)

### Phase 5: Test & Validate (Week 7-8)
- Test evidence tracking with real cases
- Validate provenance rules
- A/B test display plan configurations
- User acceptance testing

---

## Conclusion

**v9.2 shows significant progress** from v4:
- ✅ Evidence tracking added (critical)
- ✅ Better prompt governance
- ✅ Richer metadata structure
- ✅ Cleaner naming

**But core issues remain:**
- ❌ Platform mismatch (Snowflake vs PostgreSQL)
- ❌ Conceptual mismatch (encounter vs case-centric)
- ❌ Missing entity tables (patients, specialties, modules)

**Best path forward:**
1. **Adopt v9.2's best ideas** (evidence, prompt metadata, provenance, display_plan)
2. **Implement in PostgreSQL** (not Snowflake)
3. **Keep case-centric model** (not encounter-centric)
4. **Add missing entities** (patients, specialties, modules tables)
5. **Combine with v1.0** (versioning, workflow, audit trail)

**Result: HealthLevers v2.0** - The best of both worlds.

---

## Next Steps

1. **Review this analysis** with your team
2. **Approve v2.0 hybrid approach** (or provide feedback)
3. **Create updated schema document** with full PostgreSQL DDL
4. **Write Drizzle migrations** for v2.0
5. **Begin Phase 1 implementation**

Ready to proceed? I can create the full HealthLevers v2.0 schema with:
- Complete PostgreSQL DDL
- Drizzle ORM definitions
- Migration files
- Example data
- Updated API layer
