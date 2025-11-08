# Round-Trip Handshake Plan
## Complete System Integration with Gap Analysis

**Version**: 1.0
**Date**: 2025-11-08
**Purpose**: Define all missing metadata, contracts, and handshakes for end-to-end case processing

---

## Table of Contents
1. [Gap Analysis Summary](#gap-analysis-summary)
2. [Missing Metadata Tables](#missing-metadata-tables)
3. [Complete Round-Trip Flow](#complete-round-trip-flow)
4. [API Contract Definitions](#api-contract-definitions)
5. [State Machine](#state-machine)
6. [Validation Rules](#validation-rules)
7. [Error Handling](#error-handling)
8. [Implementation Plan](#implementation-plan)

---

## Gap Analysis Summary

### Current State ✅
- [x] Core metadata tables (metric, signal_group, signal_def, display_plan, followup, prompt, provenance_rule)
- [x] Patient payload storage
- [x] Enrichment result storage
- [x] UI mock design
- [x] Excel parsing and seeding

### Missing Gaps ❌

#### 1. **Taxonomy & Classification**
- [ ] Specialty taxonomy (Ortho, Cardiology, Neurology, etc.)
- [ ] Domain taxonomy (timeliness, safety, appropriateness, etc.)
- [ ] Case type taxonomy (SCH, Hip Fracture, MI, Stroke, etc.)
- [ ] Diagnosis code mapping (ICD-10 → case types)
- [ ] Procedure code mapping (CPT → case types)

#### 2. **Metric Selection & Applicability**
- [ ] Metric applicability rules (age, diagnosis, procedure requirements)
- [ ] Inclusion/exclusion criteria
- [ ] Metric-to-specialty mapping
- [ ] Metric-to-domain mapping
- [ ] Active version tracking

#### 3. **API Contracts**
- [ ] Request/response schemas for all endpoints
- [ ] Validation rules and error messages
- [ ] Payload format specifications
- [ ] Authentication/authorization contracts

#### 4. **State Management**
- [ ] Case state machine definition
- [ ] State transition rules
- [ ] Status tracking
- [ ] Audit trail

#### 5. **Data Quality**
- [ ] Payload validation schemas
- [ ] Required field definitions
- [ ] Data type constraints
- [ ] Business rule validation

#### 6. **Error Handling**
- [ ] Error catalog with codes
- [ ] Retry strategies
- [ ] Fallback mechanisms
- [ ] User-facing error messages

---

## Missing Metadata Tables

### 1. SPECIALTY Table
**Purpose**: Define available specialties and their properties

```sql
CREATE TABLE specialty (
  specialty_code VARCHAR(50) PRIMARY KEY,  -- "ORTHO", "CARDIO", "NEURO"
  specialty_name VARCHAR(255) NOT NULL,    -- "Orthopedics", "Cardiology"
  display_order INTEGER DEFAULT 9999,
  icon_name VARCHAR(100),                  -- "bone", "heart", "brain"
  color_hex VARCHAR(7),                    -- "#007acc"
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',     -- "active", "deprecated"
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "specialty_code": "ORTHO",
    "specialty_name": "Orthopedics",
    "display_order": 10,
    "icon_name": "bone",
    "color_hex": "#007acc",
    "description": "Musculoskeletal conditions and procedures",
    "status": "active"
  },
  {
    "specialty_code": "CARDIO",
    "specialty_name": "Cardiology",
    "display_order": 20,
    "icon_name": "heart",
    "color_hex": "#d9534f",
    "description": "Cardiac conditions and procedures",
    "status": "active"
  }
]
```

---

### 2. DOMAIN Table
**Purpose**: Define quality measurement domains

```sql
CREATE TABLE domain (
  domain_code VARCHAR(50) PRIMARY KEY,     -- "timeliness", "safety", "appropriateness"
  domain_name VARCHAR(255) NOT NULL,       -- "Timeliness", "Safety"
  display_order INTEGER DEFAULT 9999,
  icon_name VARCHAR(100),                  -- "clock", "shield", "check-circle"
  color_hex VARCHAR(7),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "domain_code": "timeliness",
    "domain_name": "Timeliness",
    "display_order": 10,
    "icon_name": "clock",
    "color_hex": "#e0a800",
    "description": "Time-to-intervention metrics",
    "status": "active"
  },
  {
    "domain_code": "safety",
    "domain_name": "Safety",
    "display_order": 20,
    "icon_name": "shield",
    "color_hex": "#28a745",
    "description": "Patient safety and complications",
    "status": "active"
  },
  {
    "domain_code": "appropriateness",
    "domain_name": "Appropriateness",
    "display_order": 30,
    "icon_name": "check-circle",
    "color_hex": "#17a2b8",
    "description": "Clinical appropriateness and guideline adherence",
    "status": "active"
  }
]
```

---

### 3. CASE_TYPE Table
**Purpose**: Define case type taxonomy (the "what" being measured)

```sql
CREATE TABLE case_type (
  case_type_code VARCHAR(50) PRIMARY KEY,  -- "SCH", "HIP_FX", "STEMI"
  case_type_name VARCHAR(255) NOT NULL,    -- "Supracondylar Humerus Fracture"
  specialty_code VARCHAR(50) REFERENCES specialty(specialty_code),
  description TEXT,
  icd10_codes TEXT[],                      -- Array of applicable ICD-10 codes
  cpt_codes TEXT[],                        -- Array of applicable CPT codes
  age_min INTEGER,                         -- Minimum age in years (null = no limit)
  age_max INTEGER,                         -- Maximum age in years (null = no limit)
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "case_type_code": "SCH",
    "case_type_name": "Supracondylar Humerus Fracture",
    "specialty_code": "ORTHO",
    "description": "Pediatric supracondylar fracture requiring operative intervention",
    "icd10_codes": ["S42.411A", "S42.412A", "S42.413A", "S42.414A"],
    "cpt_codes": ["24545", "24546", "24565", "24566"],
    "age_min": 0,
    "age_max": 18,
    "status": "active"
  },
  {
    "case_type_code": "HIP_FX",
    "case_type_name": "Hip Fracture",
    "specialty_code": "ORTHO",
    "description": "Femoral neck or intertrochanteric fracture",
    "icd10_codes": ["S72.001A", "S72.002A", "S72.009A", "S72.141A"],
    "cpt_codes": ["27235", "27236", "27244", "27245"],
    "age_min": 65,
    "age_max": null,
    "status": "active"
  }
]
```

---

### 4. METRIC_APPLICABILITY Table
**Purpose**: Define when a metric applies to a case

```sql
CREATE TABLE metric_applicability (
  applicability_id SERIAL PRIMARY KEY,
  metric_id VARCHAR(50) REFERENCES metric(metric_id),
  case_type_code VARCHAR(50) REFERENCES case_type(case_type_code),

  -- Inclusion criteria (AND logic)
  required_diagnosis_codes TEXT[],         -- Must have one of these ICD-10
  required_procedure_codes TEXT[],         -- Must have one of these CPT
  required_age_min INTEGER,
  required_age_max INTEGER,
  required_fields TEXT[],                  -- Required payload fields

  -- Exclusion criteria (OR logic - any match excludes)
  excluded_diagnosis_codes TEXT[],
  excluded_procedure_codes TEXT[],
  excluded_conditions JSONB,               -- Complex exclusion logic

  priority INTEGER DEFAULT 100,            -- Lower = higher priority
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "metric_id": "ORTHO_I25",
    "case_type_code": "SCH",
    "required_diagnosis_codes": ["S42.411A", "S42.412A", "S42.413A", "S42.414A"],
    "required_procedure_codes": ["24545", "24546", "24565", "24566"],
    "required_age_min": 0,
    "required_age_max": 18,
    "required_fields": ["ed_arrival_time", "or_start_time"],
    "excluded_diagnosis_codes": ["S42.001A"],  // Exclude clavicle fractures
    "excluded_conditions": {
      "polytrauma": true,  // Exclude if polytrauma flag set
      "non_operative": true  // Exclude if non-operative treatment
    },
    "priority": 10,
    "status": "active"
  }
]
```

---

### 5. CASE_STATUS Table
**Purpose**: Track case processing state

```sql
CREATE TABLE case_status (
  status_code VARCHAR(50) PRIMARY KEY,
  status_name VARCHAR(255) NOT NULL,
  display_order INTEGER,
  description TEXT,
  is_terminal BOOLEAN DEFAULT FALSE,       -- Cannot transition from this state
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "status_code": "draft",
    "status_name": "Draft",
    "display_order": 10,
    "description": "Case created, not yet enriched",
    "is_terminal": false
  },
  {
    "status_code": "enriching",
    "status_name": "Enriching",
    "display_order": 20,
    "description": "AI enrichment in progress",
    "is_terminal": false
  },
  {
    "status_code": "enriched",
    "status_name": "Enriched",
    "display_order": 30,
    "description": "AI enrichment complete, awaiting review",
    "is_terminal": false
  },
  {
    "status_code": "in_review",
    "status_name": "In Review",
    "display_order": 40,
    "description": "Under human review",
    "is_terminal": false
  },
  {
    "status_code": "reviewed",
    "status_name": "Reviewed",
    "display_order": 50,
    "description": "Review complete, awaiting finalization",
    "is_terminal": false
  },
  {
    "status_code": "finalized",
    "status_name": "Finalized",
    "display_order": 60,
    "description": "Case locked, ready for reporting",
    "is_terminal": true
  },
  {
    "status_code": "error",
    "status_name": "Error",
    "display_order": 100,
    "description": "Processing error occurred",
    "is_terminal": false
  }
]
```

---

### 6. CASE Table (Enhanced)
**Purpose**: Central case tracking with state

```sql
CREATE TABLE case_record (
  case_id VARCHAR(100) PRIMARY KEY,
  specialty_code VARCHAR(50) REFERENCES specialty(specialty_code),
  case_type_code VARCHAR(50) REFERENCES case_type(case_type_code),

  -- Patient identifiers (de-identified)
  patient_id VARCHAR(100),
  encounter_id VARCHAR(100),

  -- Case metadata
  case_date DATE NOT NULL,
  facility_id VARCHAR(100),
  provider_id VARCHAR(100),

  -- State tracking
  status_code VARCHAR(50) REFERENCES case_status(status_code) DEFAULT 'draft',

  -- Audit trail
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  finalized_by VARCHAR(255),
  finalized_at TIMESTAMP,

  -- Version tracking
  version_id VARCHAR(50),

  CONSTRAINT case_record_pkey PRIMARY KEY (case_id)
);
```

---

### 7. CASE_METRIC_ASSIGNMENT Table
**Purpose**: Track which metrics are assigned to a case

```sql
CREATE TABLE case_metric_assignment (
  assignment_id SERIAL PRIMARY KEY,
  case_id VARCHAR(100) REFERENCES case_record(case_id),
  metric_id VARCHAR(50) REFERENCES metric(metric_id),

  -- Assignment metadata
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(255),                -- "system" or user email
  assignment_method VARCHAR(50),           -- "auto", "manual", "suggested"

  -- Result tracking
  computed_status VARCHAR(20),             -- "pass", "fail", "caution", "error"
  computed_at TIMESTAMP,

  -- Review tracking
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Override tracking
  override_status VARCHAR(20),             -- If reviewer changes status
  override_reason TEXT,
  override_by VARCHAR(255),
  override_at TIMESTAMP,

  UNIQUE(case_id, metric_id)
);
```

---

### 8. VALIDATION_RULE Table
**Purpose**: Define payload validation rules

```sql
CREATE TABLE validation_rule (
  rule_id SERIAL PRIMARY KEY,
  metric_id VARCHAR(50) REFERENCES metric(metric_id),
  field_name VARCHAR(255) NOT NULL,

  -- Validation spec
  required BOOLEAN DEFAULT FALSE,
  data_type VARCHAR(50),                   -- "string", "number", "timestamp", "boolean"
  min_value NUMERIC,
  max_value NUMERIC,
  pattern VARCHAR(500),                    -- Regex pattern
  allowed_values TEXT[],                   -- Enum values

  -- Error messaging
  error_code VARCHAR(50),
  error_message TEXT,

  -- Conditional validation
  when_cond TEXT,                          -- Only validate if condition true

  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "metric_id": "ORTHO_I25",
    "field_name": "ed_arrival_time",
    "required": true,
    "data_type": "timestamp",
    "error_code": "MISSING_ED_ARRIVAL",
    "error_message": "ED arrival time is required for timeliness metrics"
  },
  {
    "metric_id": "ORTHO_I25",
    "field_name": "or_start_time",
    "required": true,
    "data_type": "timestamp",
    "error_code": "MISSING_OR_START",
    "error_message": "OR start time is required for timeliness metrics"
  },
  {
    "metric_id": "ORTHO_I25",
    "field_name": "age",
    "required": true,
    "data_type": "number",
    "min_value": 0,
    "max_value": 18,
    "error_code": "AGE_OUT_OF_RANGE",
    "error_message": "Patient age must be 0-18 years for pediatric SCH metric"
  }
]
```

---

### 9. ERROR_CATALOG Table
**Purpose**: Standardized error definitions

```sql
CREATE TABLE error_catalog (
  error_code VARCHAR(50) PRIMARY KEY,
  error_category VARCHAR(50),              -- "validation", "enrichment", "system"
  error_severity VARCHAR(20),              -- "fatal", "error", "warning", "info"
  error_message TEXT NOT NULL,
  user_message TEXT,                       -- User-friendly message
  suggested_action TEXT,                   -- What user should do
  retry_eligible BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Data**:
```json
[
  {
    "error_code": "MISSING_ED_ARRIVAL",
    "error_category": "validation",
    "error_severity": "error",
    "error_message": "Required field 'ed_arrival_time' is missing",
    "user_message": "ED arrival time is required but not found in the case data",
    "suggested_action": "Please verify the case data includes ED arrival timestamp",
    "retry_eligible": false
  },
  {
    "error_code": "ENRICHMENT_TIMEOUT",
    "error_category": "enrichment",
    "error_severity": "error",
    "error_message": "AI enrichment request timed out after 30 seconds",
    "user_message": "The AI analysis took too long and was cancelled",
    "suggested_action": "Try again. If the problem persists, contact support.",
    "retry_eligible": true
  },
  {
    "error_code": "INVALID_METRIC_ASSIGNMENT",
    "error_category": "validation",
    "error_severity": "error",
    "error_message": "Metric does not apply to this case type",
    "user_message": "This metric cannot be used for the selected case type",
    "suggested_action": "Review case type and metric applicability rules",
    "retry_eligible": false
  }
]
```

---

## Complete Round-Trip Flow

### Phase 1: Case Intake & Classification

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1.1: User Initiates Case Creation                         │
├─────────────────────────────────────────────────────────────────┤
│ Screen: Intake Screen                                           │
│ User Action: Selects specialty from dropdown                    │
│                                                                 │
│ API Request:                                                    │
│   GET /api/specialties                                          │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "specialties": [                                            │
│       {                                                         │
│         "code": "ORTHO",                                        │
│         "name": "Orthopedics",                                  │
│         "icon": "bone",                                         │
│         "color": "#007acc"                                      │
│       },                                                        │
│       ...                                                       │
│     ]                                                           │
│   }                                                             │
│                                                                 │
│ Handshake: specialty.specialty_code → UI dropdown               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1.2: User Uploads Patient Payload                         │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Uploads JSON/XML file or pastes data              │
│                                                                 │
│ API Request:                                                    │
│   POST /api/cases                                               │
│   Content-Type: application/json                               │
│   {                                                             │
│     "specialty_code": "ORTHO",                                  │
│     "payload": {                                                │
│       "patient_id": "P123456",                                  │
│       "age": 6,                                                 │
│       "diagnosis_codes": ["S42.411A"],                          │
│       "procedure_codes": ["24545"],                             │
│       "ed_arrival_time": "2024-01-15T08:23:00-05:00",          │
│       "or_start_time": "2024-01-16T00:05:00-05:00",            │
│       ...                                                       │
│     }                                                           │
│   }                                                             │
│                                                                 │
│ Backend Processing:                                             │
│   1. Generate case_id: "CS_2024_001234"                        │
│   2. Validate payload structure (not empty, valid JSON)        │
│   3. INSERT INTO patient_payload (case_id, payload_json)       │
│   4. Determine case_type from diagnosis/procedure codes        │
│   5. INSERT INTO case_record (case_id, specialty_code,         │
│      case_type_code, status_code='draft')                      │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "case_id": "CS_2024_001234",                               │
│     "status": "draft",                                          │
│     "specialty_code": "ORTHO",                                  │
│     "case_type_code": "SCH",                                    │
│     "created_at": "2024-01-16T10:30:00Z"                       │
│   }                                                             │
│                                                                 │
│ Handshake:                                                      │
│   payload.diagnosis_codes → case_type.icd10_codes → case_type_code │
│   payload.procedure_codes → case_type.cpt_codes → case_type_code   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1.3: System Suggests Applicable Metrics                   │
├─────────────────────────────────────────────────────────────────┤
│ API Request:                                                    │
│   GET /api/cases/CS_2024_001234/suggested-metrics              │
│                                                                 │
│ Backend Processing:                                             │
│   1. Fetch case details: specialty_code, case_type_code, payload │
│   2. Query metric_applicability:                               │
│      SELECT ma.*, m.*                                           │
│      FROM metric_applicability ma                              │
│      JOIN metric m ON m.metric_id = ma.metric_id               │
│      WHERE ma.case_type_code = 'SCH'                           │
│        AND ma.status = 'active'                                │
│        AND m.status = 'active'                                 │
│      ORDER BY ma.priority ASC                                  │
│                                                                 │
│   3. For each metric, validate:                                │
│      - Age in range (required_age_min, required_age_max)       │
│      - Has required diagnosis code                             │
│      - Has required procedure code                             │
│      - Has required payload fields                             │
│      - Does NOT have excluded diagnosis/procedure              │
│      - Does NOT match excluded_conditions                      │
│                                                                 │
│   4. Return matching metrics with confidence score             │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "case_id": "CS_2024_001234",                               │
│     "suggested_metrics": [                                      │
│       {                                                         │
│         "metric_id": "ORTHO_I25",                              │
│         "metric_name": "In OR <18 hrs – Supracondylar fracture", │
│         "domain": "timeliness",                                │
│         "confidence": "high",  // "high", "medium", "low"      │
│         "match_reason": "Diagnosis S42.411A + Procedure 24545 + Age 6", │
│         "missing_fields": [],                                   │
│         "auto_assign": true                                     │
│       },                                                        │
│       {                                                         │
│         "metric_id": "ORTHO_S02",                              │
│         "metric_name": "Complication rate – SCH",              │
│         "domain": "safety",                                    │
│         "confidence": "medium",                                │
│         "match_reason": "Case type SCH matches",               │
│         "missing_fields": ["followup_30d_complications"],      │
│         "auto_assign": false                                    │
│       }                                                         │
│     ]                                                           │
│   }                                                             │
│                                                                 │
│ Handshake:                                                      │
│   case_type_code → metric_applicability → metric_id list       │
│   payload → validation_rule → missing_fields                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1.4: User Confirms Metric Selection                       │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Reviews suggested metrics, confirms or selects    │
│                                                                 │
│ API Request:                                                    │
│   POST /api/cases/CS_2024_001234/metrics                       │
│   {                                                             │
│     "metric_ids": ["ORTHO_I25"],                               │
│     "assignment_method": "auto"  // or "manual"                │
│   }                                                             │
│                                                                 │
│ Backend Processing:                                             │
│   1. For each metric_id:                                       │
│      - Validate metric applicability (run validation again)    │
│      - INSERT INTO case_metric_assignment (                    │
│          case_id, metric_id, assigned_by, assignment_method)   │
│   2. Trigger enrichment workflow                               │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "case_id": "CS_2024_001234",                               │
│     "assignments": [                                            │
│       {                                                         │
│         "metric_id": "ORTHO_I25",                              │
│         "assigned_at": "2024-01-16T10:32:00Z",                 │
│         "status": "pending_enrichment"                          │
│       }                                                         │
│     ]                                                           │
│   }                                                             │
│                                                                 │
│ State Transition:                                               │
│   case_record.status_code: 'draft' → 'enriching'              │
│                                                                 │
│ Handshake:                                                      │
│   case_id + metric_id → case_metric_assignment → enrichment trigger │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 2: AI Enrichment & Signal Detection

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2.1: Payload Validation                                   │
├─────────────────────────────────────────────────────────────────┤
│ Backend Process: Pre-enrichment validation                      │
│                                                                 │
│ Processing:                                                     │
│   1. Fetch validation rules:                                   │
│      SELECT * FROM validation_rule                             │
│      WHERE metric_id = 'ORTHO_I25' AND status = 'active'       │
│                                                                 │
│   2. For each rule:                                            │
│      - Check if field exists in payload                        │
│      - Validate data type                                      │
│      - Validate min/max values                                 │
│      - Validate pattern/allowed_values                         │
│      - Evaluate when_cond (conditional validation)             │
│                                                                 │
│   3. Collect validation errors                                 │
│                                                                 │
│ If validation fails:                                            │
│   - case_metric_assignment.computed_status = 'error'           │
│   - Store validation errors                                    │
│   - Notify user                                                │
│   - STOP enrichment                                            │
│                                                                 │
│ If validation passes:                                           │
│   - Continue to enrichment                                     │
│                                                                 │
│ Handshake:                                                      │
│   validation_rule + payload → validation_errors → proceed/stop │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2.2: AI Enrichment Call                                   │
├─────────────────────────────────────────────────────────────────┤
│ Backend Process: OpenAI GPT-4o signal detection                │
│                                                                 │
│ API Internal Call:                                              │
│   POST /api/enrichment                                          │
│   {                                                             │
│     "case_id": "CS_2024_001234",                               │
│     "metric_id": "ORTHO_I25",                                  │
│     "payload": {...}                                            │
│   }                                                             │
│                                                                 │
│ Processing:                                                     │
│   1. Fetch intake prompt:                                      │
│      SELECT prompt_text FROM prompt                            │
│      WHERE metric_id = 'ORTHO_I25'                             │
│        AND prompt_type = 'intake'                              │
│                                                                 │
│   2. Inject payload into prompt template:                      │
│      - Replace {{payload}} with JSON.stringify(payload)        │
│      - Replace {{threshold_hours}} with metric.threshold_hours │
│                                                                 │
│   3. Call OpenAI API:                                          │
│      POST https://api.openai.com/v1/chat/completions           │
│      {                                                          │
│        "model": "gpt-4o",                                       │
│        "messages": [                                            │
│          {"role": "system", "content": promptText},            │
│          {"role": "user", "content": JSON.stringify(payload)}  │
│        ],                                                       │
│        "temperature": 0.1,                                      │
│        "response_format": {"type": "json_object"}              │
│      }                                                          │
│                                                                 │
│   4. Parse response:                                            │
│      Expected format:                                           │
│      {                                                          │
│        "signals": [                                             │
│          "within_threshold",                                    │
│          "borderline_pm30",                                     │
│          "consult_delay",                                       │
│          "imaging_delay"                                        │
│        ],                                                       │
│        "computed_status": "pass",                              │
│        "time_to_or_hours": 15.7,                               │
│        "reasoning": "Patient met 18h threshold..."             │
│      }                                                          │
│                                                                 │
│   5. Validate response signals:                                │
│      - All signals exist in signal_def for this metric         │
│      - All signals have status = 'active'                      │
│                                                                 │
│   6. Store enrichment result:                                  │
│      INSERT INTO enrichment_result (                           │
│        case_id, metric_id, signals, computed_status,           │
│        time_to_event, reasoning, computed_at                   │
│      )                                                          │
│                                                                 │
│   7. Update case_metric_assignment:                            │
│      UPDATE case_metric_assignment                             │
│      SET computed_status = 'pass',                             │
│          computed_at = NOW()                                    │
│      WHERE case_id = 'CS_2024_001234'                          │
│        AND metric_id = 'ORTHO_I25'                             │
│                                                                 │
│   8. Cache result (1 hour TTL):                                │
│      SET cache:enrichment:CS_2024_001234:ORTHO_I25 = {...}    │
│                                                                 │
│ Error Handling:                                                 │
│   - OpenAI timeout → retry up to 3 times                       │
│   - Invalid JSON response → log error, mark as 'error'         │
│   - Invalid signals → log warning, filter out invalid          │
│                                                                 │
│ State Transition:                                               │
│   case_record.status_code: 'enriching' → 'enriched'           │
│                                                                 │
│ Handshake:                                                      │
│   prompt.prompt_text + payload → OpenAI → signals              │
│   signals → signal_def (validation) → enrichment_result        │
│   enrichment_result → case_metric_assignment.computed_status   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 3: UI Display & Review

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3.1: User Navigates to Case Detail                        │
├─────────────────────────────────────────────────────────────────┤
│ Screen: Case Detail / Metric Card Screen                       │
│                                                                 │
│ API Request:                                                    │
│   GET /api/cases/CS_2024_001234/metrics/ORTHO_I25              │
│                                                                 │
│ Backend Processing:                                             │
│   1. Check cache first:                                        │
│      GET cache:case:CS_2024_001234:ORTHO_I25                   │
│      If hit: return cached response (5 min TTL)                │
│                                                                 │
│   2. If cache miss, fetch all metadata (SINGLE QUERY):         │
│      SELECT                                                     │
│        m.*,                    -- metric                        │
│        s.specialty_name,       -- specialty                     │
│        d.domain_name,          -- domain                        │
│        sg.*,                   -- signal_group                  │
│        sd.*,                   -- signal_def                    │
│        dp.*,                   -- display_plan                  │
│        fq.*,                   -- followup                      │
│        pr.*,                   -- prompt                        │
│        prov.*,                 -- provenance_rule               │
│        er.*,                   -- enrichment_result             │
│        pp.payload_json,        -- patient_payload               │
│        cr.status_code,         -- case_record status            │
│        cma.*                   -- case_metric_assignment        │
│      FROM metric m                                              │
│      JOIN specialty s ON s.specialty_code = m.specialty        │
│      JOIN domain d ON d.domain_code = m.domain                 │
│      LEFT JOIN signal_group sg ON sg.metric_id = m.metric_id   │
│      LEFT JOIN signal_def sd ON sd.metric_id = m.metric_id     │
│      LEFT JOIN display_plan dp ON dp.metric_id = m.metric_id   │
│      LEFT JOIN followup fq ON fq.metric_id = m.metric_id       │
│      LEFT JOIN prompt pr ON pr.metric_id = m.metric_id         │
│      LEFT JOIN provenance_rule prov ON prov.metric_id = m.metric_id │
│      LEFT JOIN enrichment_result er ON er.case_id = 'CS_2024_001234' │
│        AND er.metric_id = m.metric_id                           │
│      LEFT JOIN patient_payload pp ON pp.case_id = 'CS_2024_001234' │
│      LEFT JOIN case_record cr ON cr.case_id = 'CS_2024_001234' │
│      LEFT JOIN case_metric_assignment cma ON cma.case_id = 'CS_2024_001234' │
│        AND cma.metric_id = m.metric_id                          │
│      WHERE m.metric_id = 'ORTHO_I25'                           │
│                                                                 │
│   3. Transform to response format:                             │
│      - Group signal_groups with their signal_defs              │
│      - Sort display_plan by tier and order_nbr                 │
│      - Filter followups by when_cond                           │
│      - Extract field values using provenance_rules             │
│                                                                 │
│   4. Cache response (5 min TTL)                                │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "case_id": "CS_2024_001234",                               │
│     "metric": {                                                 │
│       "metric_id": "ORTHO_I25",                                │
│       "specialty": "Orthopedics",                              │
│       "domain": "Timeliness",                                  │
│       "metric_name": "In OR <18h (Supracondylar)",            │
│       "threshold_hours": 18                                    │
│     },                                                          │
│     "patient": {                                                │
│       "patient_id": "P123456",                                 │
│       "age": 6,                                                │
│       "sex": "F",                                              │
│       "weight_kg": 22.5                                        │
│     },                                                          │
│     "timeline": {                                               │
│       "start": "2024-01-15T08:23:00-05:00",                    │
│       "end": "2024-01-16T00:05:00-05:00",                      │
│       "duration_hours": 15.7,                                   │
│       "threshold_hours": 18,                                    │
│       "percent_complete": 87                                    │
│     },                                                          │
│     "status": {                                                 │
│       "computed": "pass",                                       │
│       "reviewed": false,                                        │
│       "case_status": "enriched"                                │
│     },                                                          │
│     "signal_groups": [                                          │
│       {                                                         │
│         "group_id": "core",                                     │
│         "group_name": "Core",                                   │
│         "color": "#007acc",                                     │
│         "signals": [                                            │
│           {                                                     │
│             "signal_code": "within_threshold",                 │
│             "severity": "info",                                │
│             "description": "Case met <18h threshold",          │
│             "active": true                                      │
│           },                                                    │
│           ...                                                   │
│         ]                                                       │
│       },                                                        │
│       ...                                                       │
│     ],                                                          │
│     "fields": {                                                 │
│       "tier1": [                                                │
│         {                                                       │
│           "field_name": "ed_arrival_time",                     │
│           "label": "ED Arrival",                               │
│           "value": "2024-01-15T08:23:00-05:00",                │
│           "display_value": "Mon Jan 15, 2024 at 8:23 AM",     │
│           "provenance": "patient_payload.ed_arrival_time"      │
│         },                                                      │
│         ...                                                     │
│       ],                                                        │
│       "tier2": [...],                                           │
│       "tier3": [...]                                            │
│     },                                                          │
│     "followup_questions": [                                     │
│       {                                                         │
│         "followup_id": "FU_CT",                                │
│         "question_text": "Was CT clinically required beyond X-ray?", │
│         "response_type": "single-select",                      │
│         "options": ["Yes", "No", "Uncertain"],                 │
│         "answered": false,                                      │
│         "response": null                                        │
│       },                                                        │
│       ...                                                       │
│     ],                                                          │
│     "prompts": {                                                │
│       "abstractor": "SYSTEM: You assist a human..."            │
│     }                                                           │
│   }                                                             │
│                                                                 │
│ Handshake:                                                      │
│   specialty.specialty_code → metric.specialty → display        │
│   domain.domain_code → metric.domain → display                 │
│   signal_group + signal_def + enrichment_result.signals → chips │
│   display_plan + provenance_rule + patient_payload → fields    │
│   followup + enrichment_result.signals → active_questions      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3.2: User Answers Followup Questions                      │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Clicks "View Followup Questions", submits answers │
│                                                                 │
│ API Request:                                                    │
│   POST /api/cases/CS_2024_001234/followup                      │
│   {                                                             │
│     "followup_id": "FU_CT",                                    │
│     "response": "Yes - clinical indication"                    │
│   }                                                             │
│                                                                 │
│ Backend Processing:                                             │
│   INSERT INTO followup_response (                              │
│     case_id, followup_id, response, responded_by, responded_at │
│   ) VALUES (                                                    │
│     'CS_2024_001234', 'FU_CT', 'Yes...', 'user@ex.com', NOW() │
│   )                                                             │
│                                                                 │
│ Response:                                                       │
│   { "success": true, "followup_id": "FU_CT" }                  │
│                                                                 │
│ Handshake:                                                      │
│   followup.followup_id → followup_response → answered          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3.3: User Marks Case as Reviewed                          │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Clicks "Mark Reviewed"                            │
│                                                                 │
│ API Request:                                                    │
│   POST /api/cases/CS_2024_001234/metrics/ORTHO_I25/review      │
│   {                                                             │
│     "review_notes": "Imaging delay justified, case passes",    │
│     "override_status": null  // or "fail", "caution"           │
│   }                                                             │
│                                                                 │
│ Backend Processing:                                             │
│   1. UPDATE case_metric_assignment                             │
│      SET reviewed = TRUE,                                       │
│          reviewed_by = 'user@example.com',                     │
│          reviewed_at = NOW(),                                   │
│          review_notes = '...',                                  │
│          override_status = NULL                                 │
│      WHERE case_id = 'CS_2024_001234'                          │
│        AND metric_id = 'ORTHO_I25'                             │
│                                                                 │
│   2. Check if all assigned metrics reviewed:                   │
│      SELECT COUNT(*) FROM case_metric_assignment               │
│      WHERE case_id = 'CS_2024_001234' AND reviewed = FALSE     │
│                                                                 │
│   3. If all reviewed:                                          │
│      UPDATE case_record                                         │
│      SET status_code = 'reviewed',                             │
│          reviewed_at = NOW(),                                   │
│          reviewed_by = 'user@example.com'                      │
│      WHERE case_id = 'CS_2024_001234'                          │
│                                                                 │
│ Response:                                                       │
│   {                                                             │
│     "success": true,                                            │
│     "reviewed_at": "2024-01-16T11:00:00Z",                     │
│     "case_status": "reviewed"                                   │
│   }                                                             │
│                                                                 │
│ State Transition:                                               │
│   case_record.status_code: 'enriched' → 'reviewed'            │
│                                                                 │
│ Handshake:                                                      │
│   user action → case_metric_assignment.reviewed → case_status  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Contract Definitions

### 1. GET /api/specialties
**Purpose**: Fetch available specialties

**Request**: None

**Response**:
```typescript
interface SpecialtyListResponse {
  specialties: Array<{
    code: string;           // "ORTHO"
    name: string;           // "Orthopedics"
    icon: string;           // "bone"
    color: string;          // "#007acc"
    description?: string;
  }>;
}
```

**Errors**: None (always succeeds, may return empty array)

---

### 2. POST /api/cases
**Purpose**: Create new case with payload

**Request**:
```typescript
interface CreateCaseRequest {
  specialty_code: string;    // Required: "ORTHO"
  payload: Record<string, any>;  // Required: patient data
}
```

**Response**:
```typescript
interface CreateCaseResponse {
  case_id: string;           // "CS_2024_001234"
  status: string;            // "draft"
  specialty_code: string;
  case_type_code: string | null;  // "SCH" or null if couldn't determine
  created_at: string;        // ISO 8601 timestamp
}
```

**Errors**:
- `400 INVALID_SPECIALTY`: specialty_code not found
- `400 INVALID_PAYLOAD`: payload is empty or malformed
- `500 DATABASE_ERROR`: Failed to create case

---

### 3. GET /api/cases/:caseId/suggested-metrics
**Purpose**: Get applicable metrics for case

**Request**: None (case_id in path)

**Response**:
```typescript
interface SuggestedMetricsResponse {
  case_id: string;
  case_type_code: string | null;
  suggested_metrics: Array<{
    metric_id: string;
    metric_name: string;
    domain: string;
    specialty: string;
    confidence: 'high' | 'medium' | 'low';
    match_reason: string;
    missing_fields: string[];
    auto_assign: boolean;
  }>;
}
```

**Errors**:
- `404 CASE_NOT_FOUND`: case_id doesn't exist
- `500 DATABASE_ERROR`: Query failed

---

### 4. POST /api/cases/:caseId/metrics
**Purpose**: Assign metrics to case and trigger enrichment

**Request**:
```typescript
interface AssignMetricsRequest {
  metric_ids: string[];      // ["ORTHO_I25"]
  assignment_method: 'auto' | 'manual';
}
```

**Response**:
```typescript
interface AssignMetricsResponse {
  case_id: string;
  assignments: Array<{
    metric_id: string;
    assigned_at: string;
    status: 'pending_enrichment' | 'error';
    error?: {
      code: string;
      message: string;
    };
  }>;
}
```

**Errors**:
- `404 CASE_NOT_FOUND`: case_id doesn't exist
- `400 INVALID_METRIC`: metric_id not found
- `400 METRIC_NOT_APPLICABLE`: metric doesn't apply to case
- `409 ALREADY_ASSIGNED`: metric already assigned to case

---

### 5. GET /api/cases/:caseId/metrics/:metricId
**Purpose**: Fetch complete metric card data

**Request**: None

**Response**:
```typescript
interface MetricCardResponse {
  case_id: string;
  metric: {
    metric_id: string;
    specialty: string;
    domain: string;
    metric_name: string;
    threshold_hours?: number;
  };
  patient: {
    patient_id: string;
    age: number;
    sex: string;
    weight_kg?: number;
  };
  timeline?: {
    start: string;
    end: string;
    duration_hours: number;
    threshold_hours: number;
    percent_complete: number;
  };
  status: {
    computed: 'pass' | 'fail' | 'caution' | 'error' | null;
    reviewed: boolean;
    case_status: string;
  };
  signal_groups: Array<{
    group_id: string;
    group_name: string;
    color: string;
    signals: Array<{
      signal_code: string;
      severity: 'info' | 'warn' | 'error';
      description: string;
      active: boolean;
    }>;
  }>;
  fields: {
    tier1: FieldDisplay[];
    tier2: FieldDisplay[];
    tier3: FieldDisplay[];
  };
  followup_questions: Array<{
    followup_id: string;
    question_text: string;
    response_type: string;
    options?: string[];
    answered: boolean;
    response: any;
  }>;
  prompts: {
    abstractor: string;
  };
}

interface FieldDisplay {
  field_name: string;
  label: string;
  value: any;
  display_value: string;
  provenance: string;
}
```

**Errors**:
- `404 CASE_NOT_FOUND`
- `404 METRIC_NOT_FOUND`
- `404 ASSIGNMENT_NOT_FOUND`: metric not assigned to case

---

### 6. POST /api/cases/:caseId/followup
**Purpose**: Submit followup question response

**Request**:
```typescript
interface FollowupResponseRequest {
  followup_id: string;
  response: any;  // Type depends on followup.response_type
}
```

**Response**:
```typescript
interface FollowupResponseResponse {
  success: boolean;
  followup_id: string;
}
```

**Errors**:
- `404 CASE_NOT_FOUND`
- `404 FOLLOWUP_NOT_FOUND`
- `400 INVALID_RESPONSE_TYPE`

---

### 7. POST /api/cases/:caseId/metrics/:metricId/review
**Purpose**: Mark metric as reviewed

**Request**:
```typescript
interface ReviewMetricRequest {
  review_notes?: string;
  override_status?: 'pass' | 'fail' | 'caution' | null;
}
```

**Response**:
```typescript
interface ReviewMetricResponse {
  success: boolean;
  reviewed_at: string;
  case_status: string;
}
```

**Errors**:
- `404 CASE_NOT_FOUND`
- `404 ASSIGNMENT_NOT_FOUND`
- `400 ALREADY_REVIEWED`

---

## State Machine

### Case States

```
┌──────────────────────────────────────────────────────────────┐
│                     CASE STATE MACHINE                       │
└──────────────────────────────────────────────────────────────┘

   ┌─────────┐
   │  START  │
   └────┬────┘
        │
        │ POST /api/cases
        ↓
   ┌─────────┐
   │  draft  │  ← Initial state after case creation
   └────┬────┘
        │
        │ POST /api/cases/:id/metrics (auto triggers enrichment)
        ↓
   ┌────────────┐
   │ enriching  │  ← AI enrichment in progress
   └─────┬──────┘
        │
        │ Enrichment completes successfully
        ↓
   ┌───────────┐
   │ enriched  │  ← Signals computed, ready for review
   └─────┬─────┘
        │
        │ User clicks "View Case" or "Start Review"
        ↓
   ┌────────────┐
   │ in_review  │  ← User actively reviewing
   └─────┬──────┘
        │
        │ User clicks "Mark Reviewed" (all metrics reviewed)
        ↓
   ┌──────────┐
   │ reviewed │  ← Review complete, pending finalization
   └────┬─────┘
        │
        │ Admin clicks "Finalize Case" (locks for reporting)
        ↓
   ┌───────────┐
   │ finalized │  ← Terminal state, read-only
   └───────────┘

   ERROR PATHS:

   enriching → error  (enrichment fails)
   error → enriching  (retry enrichment)
   error → draft      (reset and re-assign metrics)
```

### State Transition Rules

| From State | To State | Trigger | Validation |
|-----------|----------|---------|------------|
| draft | enriching | POST /api/cases/:id/metrics | At least one metric assigned |
| enriching | enriched | Enrichment completes | All assignments have computed_status |
| enriching | error | Enrichment fails | Retry count < 3 |
| enriched | in_review | User opens case detail | None |
| in_review | reviewed | POST /api/cases/:id/metrics/:mid/review | All assignments have reviewed=true |
| reviewed | finalized | POST /api/cases/:id/finalize | Case reviewed, no pending followups |
| error | enriching | POST /api/cases/:id/retry | Retry count < 3 |
| error | draft | POST /api/cases/:id/reset | Admin action |

---

## Validation Rules

### Payload Validation Flow

```typescript
function validatePayload(metricId: string, payload: any): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Fetch validation rules
  const rules = db.query(
    `SELECT * FROM validation_rule
     WHERE metric_id = ? AND status = 'active'
     ORDER BY field_name`,
    [metricId]
  );

  // 2. Validate each rule
  for (const rule of rules) {
    // Check conditional validation
    if (rule.when_cond && !evaluateCondition(rule.when_cond, payload)) {
      continue; // Skip if condition not met
    }

    // Check required
    if (rule.required && !(rule.field_name in payload)) {
      errors.push({
        field: rule.field_name,
        error_code: rule.error_code || 'FIELD_REQUIRED',
        error_message: rule.error_message || `Field '${rule.field_name}' is required`,
        severity: 'error'
      });
      continue;
    }

    const value = payload[rule.field_name];

    // Check data type
    if (value !== undefined && rule.data_type) {
      if (!validateDataType(value, rule.data_type)) {
        errors.push({
          field: rule.field_name,
          error_code: 'INVALID_DATA_TYPE',
          error_message: `Expected ${rule.data_type}, got ${typeof value}`,
          severity: 'error'
        });
        continue;
      }
    }

    // Check min/max
    if (rule.data_type === 'number') {
      if (rule.min_value !== null && value < rule.min_value) {
        errors.push({
          field: rule.field_name,
          error_code: rule.error_code || 'VALUE_TOO_LOW',
          error_message: rule.error_message || `Value must be >= ${rule.min_value}`,
          severity: 'error'
        });
      }
      if (rule.max_value !== null && value > rule.max_value) {
        errors.push({
          field: rule.field_name,
          error_code: rule.error_code || 'VALUE_TOO_HIGH',
          error_message: rule.error_message || `Value must be <= ${rule.max_value}`,
          severity: 'error'
        });
      }
    }

    // Check pattern
    if (rule.pattern && typeof value === 'string') {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: rule.field_name,
          error_code: rule.error_code || 'PATTERN_MISMATCH',
          error_message: rule.error_message || `Value doesn't match required pattern`,
          severity: 'error'
        });
      }
    }

    // Check allowed values
    if (rule.allowed_values && !rule.allowed_values.includes(value)) {
      errors.push({
        field: rule.field_name,
        error_code: rule.error_code || 'INVALID_VALUE',
        error_message: rule.error_message || `Value must be one of: ${rule.allowed_values.join(', ')}`,
        severity: 'error'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Error Handling

### Error Response Format (Standardized)

```typescript
interface ErrorResponse {
  error: {
    code: string;              // "MISSING_ED_ARRIVAL"
    message: string;           // Technical message
    user_message: string;      // User-friendly message
    suggested_action?: string; // What user should do
    details?: any;             // Additional context
    retry_eligible: boolean;
  };
}
```

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  'ENRICHMENT_TIMEOUT': {
    max_retries: 3,
    backoff: 'exponential', // 2s, 4s, 8s
    retry_delay_base: 2000
  },
  'OPENAI_RATE_LIMIT': {
    max_retries: 5,
    backoff: 'exponential',
    retry_delay_base: 5000
  },
  'DATABASE_ERROR': {
    max_retries: 2,
    backoff: 'linear', // 1s, 1s
    retry_delay_base: 1000
  }
};

async function executeWithRetry(
  fn: () => Promise<any>,
  errorCode: string
): Promise<any> {
  const config = RETRY_CONFIG[errorCode];
  if (!config) {
    throw new Error(`No retry config for ${errorCode}`);
  }

  let lastError;
  for (let attempt = 0; attempt <= config.max_retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < config.max_retries) {
        const delay = config.backoff === 'exponential'
          ? config.retry_delay_base * Math.pow(2, attempt)
          : config.retry_delay_base;

        console.log(`Retry ${attempt + 1}/${config.max_retries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

---

## Implementation Plan

### Phase 1: Metadata Tables (Week 1)
- [ ] Create specialty, domain, case_type tables
- [ ] Create metric_applicability table
- [ ] Create case_status, case_record, case_metric_assignment tables
- [ ] Create validation_rule, error_catalog tables
- [ ] Seed initial data from Excel + manual entries

### Phase 2: Case Classification Logic (Week 2)
- [ ] Implement ICD-10 / CPT code → case_type matching
- [ ] Implement metric applicability evaluation
- [ ] Implement suggested metrics endpoint
- [ ] Add validation rule engine

### Phase 3: API Contracts & State Management (Week 2-3)
- [ ] Implement all API endpoints with typed contracts
- [ ] Add request validation middleware
- [ ] Implement state machine transitions
- [ ] Add audit logging

### Phase 4: Error Handling & Retry Logic (Week 3)
- [ ] Implement retry strategies for enrichment
- [ ] Add error catalog lookups
- [ ] Implement user-facing error messages
- [ ] Add monitoring and alerting

### Phase 5: UI Integration (Week 4)
- [ ] Update frontend to use new specialty/domain endpoints
- [ ] Implement metric selection flow
- [ ] Add case state indicators
- [ ] Add error display components

### Phase 6: Testing & Validation (Week 5)
- [ ] Unit tests for all validation logic
- [ ] Integration tests for round-trip flow
- [ ] Load testing for enrichment pipeline
- [ ] User acceptance testing

---

## Key Handshakes Summary

| From | To | Via | Contract |
|------|----|----|----------|
| User | Specialty List | GET /api/specialties | specialty table → SpecialtyListResponse |
| User | Case Creation | POST /api/cases | payload + specialty_code → case_id |
| Case | Case Type | ICD-10/CPT codes | case_type.icd10_codes, case_type.cpt_codes → case_type_code |
| Case | Metric Suggestions | GET /api/cases/:id/suggested-metrics | metric_applicability rules → suggested metrics |
| Case + Metric | Enrichment | POST /api/cases/:id/metrics | prompt + payload → enrichment_result |
| Enrichment | Signals | OpenAI API | prompt.prompt_text → signals[] |
| Signals | UI Chips | GET /api/cases/:id/metrics/:mid | signal_group + signal_def + enrichment → chips |
| Display Plan | UI Fields | Field extraction | display_plan + provenance_rule + payload → field values |
| Signals | Followup Questions | Condition eval | followup.when_cond + active signals → questions |
| User | Review | POST /api/cases/:id/metrics/:mid/review | reviewed → case_status transition |

---

**End of Round-Trip Handshake Plan**
