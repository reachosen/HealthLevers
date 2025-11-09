# Complete Database Schema for Core Engine

## Table Categories

### A. Configuration Tables (Metadata from Excel) ✅
These define WHAT to measure and HOW to measure it.

### B. Runtime Tables (Case Processing) ⚠️
These store ACTUAL case data and processing results.

---

## A. Configuration Tables (Already Implemented)

### 1. `metric` ✅
Defines quality metrics to measure
```sql
CREATE TABLE metric (
  metric_id TEXT PRIMARY KEY,           -- "ORTHO_I25"
  specialty TEXT NOT NULL,              -- "Ortho"
  specialty_id TEXT,                    -- "ORTHO"
  question_code TEXT,                   -- "I25"
  metric_name TEXT NOT NULL,            -- "In OR <18 hrs – Supracondylar fracture"
  domain TEXT,                          -- "timeliness"
  priority INTEGER,                     -- 1
  threshold_hours NUMERIC,              -- 18
  definition_window TEXT,               -- "start_time -> end_time"
  active BOOLEAN DEFAULT true,
  version TEXT,                         -- "0.0.1"
  content_version TEXT
);
```

### 2. `signal_group` ✅
Groups signals for UI display
```sql
CREATE TABLE signal_group (
  metric_id TEXT NOT NULL,
  group_id TEXT NOT NULL,               -- "demographics"
  group_code TEXT NOT NULL,             -- "Demographics"
  PRIMARY KEY (metric_id, group_id)
);
```

### 3. `signal_def` ✅
Defines signals to collect for each metric
```sql
CREATE TABLE signal_def (
  metric_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,            -- "patient_age"
  group_id TEXT,                        -- "demographics"
  severity TEXT,                        -- "critical", "warning", "info"
  status TEXT,                          -- "required", "optional"
  PRIMARY KEY (metric_id, signal_code)
);
```

### 4. `followup` ✅
Follow-up questions to ask abstractors
```sql
CREATE TABLE followup (
  metric_id TEXT NOT NULL,
  followup_id TEXT NOT NULL,            -- "injury_mechanism"
  when_cond TEXT,                       -- "patient_age < 10"
  question_text TEXT NOT NULL,          -- "What was the mechanism of injury?"
  response_type TEXT,                   -- "text", "boolean", "date"
  PRIMARY KEY (metric_id, followup_id)
);
```

### 5. `display_plan` ✅
UI field ordering and presentation
```sql
CREATE TABLE display_plan (
  metric_id TEXT NOT NULL,
  display_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  order_nbr INTEGER NOT NULL,
  tier TEXT,                            -- "basic", "advanced"
  PRIMARY KEY (metric_id, display_id)
);
```

### 6. `provenance_rule` ✅
Data extraction rules (where to find signals)
```sql
CREATE TABLE provenance_rule (
  metric_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,
  source_system TEXT,                   -- "EPIC", "Cerner"
  source_table TEXT,                    -- "encounter"
  source_field TEXT,                    -- "admission_datetime"
  extraction_method TEXT,               -- "direct", "calculated", "ai"
  PRIMARY KEY (metric_id, signal_code)
);
```

### 7. `prompt` ✅
AI prompts for enrichment
```sql
CREATE TABLE prompt (
  metric_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_type TEXT NOT NULL,            -- "extraction", "validation"
  prompt_text TEXT NOT NULL,
  target_signals TEXT[],                -- Array of signal codes
  PRIMARY KEY (metric_id, prompt_id)
);
```

---

## B. Runtime Tables (NEED TO CREATE) ⚠️

### 8. `case_instance` ❌ MISSING
Stores each patient encounter being abstracted
```sql
CREATE TABLE case_instance (
  case_id TEXT PRIMARY KEY,                    -- Generated UUID
  encounter_id TEXT UNIQUE NOT NULL,           -- External encounter ID
  patient_age INTEGER,
  admission_date TIMESTAMP,
  specialty TEXT NOT NULL,
  diagnosis_codes TEXT[],                      -- Array of ICD-10 codes
  procedure_codes TEXT[],                      -- Array of CPT codes
  raw_data JSONB,                              -- Full case data
  status TEXT NOT NULL,                        -- "new", "enriched", "under_review", "completed"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_case_specialty ON case_instance(specialty);
CREATE INDEX idx_case_status ON case_instance(status);
CREATE INDEX idx_case_admission ON case_instance(admission_date);
```

### 9. `case_metric_assignment` ❌ MISSING
Links cases to applicable metrics (many-to-many)
```sql
CREATE TABLE case_metric_assignment (
  case_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  confidence NUMERIC(3,2),                     -- 0.95 (how sure we are this metric applies)
  assignment_reason TEXT,                      -- "Diagnosis S42.411A matches ORTHO_I25"
  status TEXT NOT NULL,                        -- "pending", "in_progress", "completed"
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (case_id, metric_id),
  FOREIGN KEY (case_id) REFERENCES case_instance(case_id),
  FOREIGN KEY (metric_id) REFERENCES metric(metric_id)
);

CREATE INDEX idx_assignment_case ON case_metric_assignment(case_id);
CREATE INDEX idx_assignment_metric ON case_metric_assignment(metric_id);
```

### 10. `case_signal_value` ❌ MISSING
Stores enriched signal values for each case
```sql
CREATE TABLE case_signal_value (
  case_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,
  value JSONB,                                 -- Flexible: string, number, date, object
  confidence NUMERIC(3,2),                     -- 0.0 to 1.0
  source TEXT NOT NULL,                        -- "extracted", "ai_enriched", "manual_entry"
  provenance_path TEXT,                        -- "encounter.admission_datetime"
  enriched_at TIMESTAMP DEFAULT NOW(),
  reviewed_by TEXT,                            -- User ID who reviewed
  reviewed_at TIMESTAMP,
  PRIMARY KEY (case_id, metric_id, signal_code),
  FOREIGN KEY (case_id, metric_id) REFERENCES case_metric_assignment(case_id, metric_id),
  FOREIGN KEY (metric_id, signal_code) REFERENCES signal_def(metric_id, signal_code)
);

CREATE INDEX idx_signal_case ON case_signal_value(case_id);
CREATE INDEX idx_signal_source ON case_signal_value(source);
```

### 11. `case_followup_response` ❌ MISSING
Stores answers to follow-up questions
```sql
CREATE TABLE case_followup_response (
  case_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  followup_id TEXT NOT NULL,
  question_text TEXT NOT NULL,                 -- Copy of question at time of asking
  response_value JSONB,                        -- Answer from abstractor
  triggered_by TEXT[],                         -- Signal codes that triggered this followup
  answered_by TEXT,                            -- User ID
  answered_at TIMESTAMP,
  PRIMARY KEY (case_id, metric_id, followup_id),
  FOREIGN KEY (case_id, metric_id) REFERENCES case_metric_assignment(case_id, metric_id),
  FOREIGN KEY (metric_id, followup_id) REFERENCES followup(metric_id, followup_id)
);

CREATE INDEX idx_followup_case ON case_followup_response(case_id);
```

### 12. `case_audit_log` ❌ MISSING
Tracks all changes to case data
```sql
CREATE TABLE case_audit_log (
  log_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,                    -- "created", "enriched", "signal_updated", "completed"
  event_data JSONB,                            -- Details of what changed
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (case_id) REFERENCES case_instance(case_id)
);

CREATE INDEX idx_audit_case ON case_audit_log(case_id);
CREATE INDEX idx_audit_timestamp ON case_audit_log(timestamp);
```

### 13. `metric_applicability_rule` ❌ MISSING
Defines WHEN a metric applies to a case
```sql
CREATE TABLE metric_applicability_rule (
  rule_id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,                     -- "diagnosis_code", "procedure_code", "age_range", "specialty"
  rule_value JSONB NOT NULL,                   -- {"code": "S42.411A"} or {"min": 0, "max": 18}
  rule_priority INTEGER DEFAULT 1,
  FOREIGN KEY (metric_id) REFERENCES metric(metric_id)
);

CREATE INDEX idx_applicability_metric ON metric_applicability_rule(metric_id);
CREATE INDEX idx_applicability_type ON metric_applicability_rule(rule_type);
```

**Example Rules**:
```json
// Rule 1: ORTHO_I25 applies to Supracondylar fracture diagnosis
{
  "rule_id": "ORTHO_I25_DIAG_1",
  "metric_id": "ORTHO_I25",
  "rule_type": "diagnosis_code",
  "rule_value": {
    "codes": ["S42.411A", "S42.412A", "S42.413A"]
  }
}

// Rule 2: ORTHO_I25 applies to patients under 18
{
  "rule_id": "ORTHO_I25_AGE_1",
  "metric_id": "ORTHO_I25",
  "rule_type": "age_range",
  "rule_value": {
    "min": 0,
    "max": 18
  }
}

// Rule 3: ORTHO_I25 only for Ortho specialty
{
  "rule_id": "ORTHO_I25_SPEC_1",
  "metric_id": "ORTHO_I25",
  "rule_type": "specialty",
  "rule_value": {
    "specialties": ["Ortho"]
  }
}
```

---

## Database Schema Migration

### Step 1: Add to `shared/schema.ts`
Add the 6 missing tables to Drizzle schema

### Step 2: Create Migration
```bash
npm run db:push
```

### Step 3: Seed Applicability Rules
Create script to populate `metric_applicability_rule` from Excel or manual definition

---

## Data Flow Example

### Case: 6yo with Supracondylar Fracture

```
1. INSERT INTO case_instance
   - case_id: "case_123"
   - encounter_id: "ENC_456"
   - patient_age: 6
   - diagnosis_codes: ["S42.411A"]
   - specialty: "Ortho"
   - status: "new"

2. CaseClassifier checks metric_applicability_rule
   - Finds ORTHO_I25 (matches diagnosis + age + specialty)
   - confidence: 0.98

3. INSERT INTO case_metric_assignment
   - case_id: "case_123"
   - metric_id: "ORTHO_I25"
   - confidence: 0.98
   - status: "pending"

4. SignalEnricher processes signals for ORTHO_I25
   - Extracts: patient_age (6), injury_time, or_start_time
   - AI enriches: fracture_type ("displaced")

5. INSERT INTO case_signal_value (multiple rows)
   - (case_123, ORTHO_I25, patient_age, 6, 1.0, "extracted")
   - (case_123, ORTHO_I25, injury_time, "2024-01-15T06:00", 1.0, "extracted")
   - (case_123, ORTHO_I25, fracture_type, "displaced", 0.85, "ai_enriched")

6. FollowupGenerator evaluates followup rules
   - when_cond: "patient_age < 10" → TRUE
   - Triggers: "What was the mechanism of injury?"

7. INSERT INTO case_followup_response
   - (case_123, ORTHO_I25, injury_mechanism, "What was mechanism?", null, ["patient_age"])

8. Abstractor reviews in UI, answers followup

9. UPDATE case_followup_response
   - response_value: "Fall from playground equipment"
   - answered_by: "user_789"
   - answered_at: NOW()

10. UPDATE case_metric_assignment
    - status: "completed"

11. INSERT INTO case_audit_log
    - event_type: "completed"
    - event_data: {"metric_id": "ORTHO_I25", "completed_by": "user_789"}
```

---

## Summary

### Already Have (7 tables) ✅
- metric
- signal_group
- signal_def
- followup
- display_plan
- provenance_rule
- prompt

### Need to Create (6 tables) ❌
- case_instance
- case_metric_assignment
- case_signal_value
- case_followup_response
- case_audit_log
- metric_applicability_rule

Once these runtime tables exist, the core engine can:
1. ✅ Store case data
2. ✅ Classify cases to metrics
3. ✅ Persist enriched signals
4. ✅ Store followup responses
5. ✅ Track audit trail
6. ✅ Query case status at any time
