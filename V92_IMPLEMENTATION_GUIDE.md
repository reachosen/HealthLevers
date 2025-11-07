# v9.2 Schema Implementation Guide for HealthLevers
## PostgreSQL Prototype → Snowflake Production (Standardized Schema)

---

## Executive Summary

**New Context:** PostgreSQL is for **prototyping only**. Production will be **Snowflake** with **standardized v9.2 schema across projects**.

**Revised Recommendation:** ✅ **Adopt v9.2 schema AS-IS** with PostgreSQL translation for prototype, then migrate to Snowflake for production.

### Strategy:
1. **Translate v9.2 to PostgreSQL** (minimal changes, ~1 day)
2. **Adapt HealthLevers to fit standardized schema** (not the reverse)
3. **Use configuration over customization** (stay compatible with standard)
4. **Smooth migration path to Snowflake** (minimize divergence)

---

## Part 1: Snowflake → PostgreSQL Translation Guide

### Type Mappings

| Snowflake Type | PostgreSQL Equivalent | Notes |
|----------------|----------------------|-------|
| `STRING` | `TEXT` or `VARCHAR` | Use TEXT for flexibility, VARCHAR(n) for constraints |
| `VARIANT` | `JSONB` | Use JSONB (not JSON) for indexing and performance |
| `NUMBER` | `NUMERIC` or `INTEGER` | NUMBER(10,2) → NUMERIC(10,2), NUMBER → INTEGER |
| `BOOLEAN` | `BOOLEAN` | Same |
| `TIMESTAMP_NTZ` | `TIMESTAMP` | Without timezone (NTZ = No Time Zone) |
| `TIMESTAMP_LTZ` | `TIMESTAMPTZ` | With timezone |

### Function Mappings

| Snowflake Function | PostgreSQL Equivalent |
|-------------------|-----------------------|
| `CURRENT_TIMESTAMP()` | `CURRENT_TIMESTAMP` (no parens) |
| `DATEADD(day, -7, CURRENT_TIMESTAMP())` | `CURRENT_TIMESTAMP - INTERVAL '7 days'` |
| `DATEADD(month, -1, CURRENT_TIMESTAMP())` | `CURRENT_TIMESTAMP - INTERVAL '1 month'` |

### Constraint Syntax

| Snowflake | PostgreSQL |
|-----------|------------|
| `DEFAULT CURRENT_TIMESTAMP()` | `DEFAULT CURRENT_TIMESTAMP` |
| `PRIMARY KEY` | `PRIMARY KEY` (same) |
| Foreign keys not shown in v9.2 | Add explicit `REFERENCES` clauses |

---

## Part 2: v9.2 Schema - PostgreSQL Translation

### Core Tables

#### encounter_context
```sql
-- Snowflake version (v9.2)
CREATE TABLE IF NOT EXISTS encounter_context (
  encounter_id STRING PRIMARY KEY,
  patient_id STRING,
  mrn STRING,
  context VARIANT,
  payload_version STRING,
  created_ts TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- PostgreSQL translation
CREATE TABLE IF NOT EXISTS encounter_context (
  encounter_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  mrn TEXT NOT NULL,
  context JSONB NOT NULL,
  payload_version TEXT DEFAULT '1.0',
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_encounter_context_patient ON encounter_context(patient_id);
CREATE INDEX idx_encounter_context_mrn ON encounter_context(mrn);
CREATE INDEX idx_encounter_context_payload ON encounter_context USING gin(context); -- JSONB indexing
```

#### metric
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS metric (
  metric_id TEXT PRIMARY KEY,
  specialty TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  domain TEXT,
  threshold_hours NUMERIC,
  content_version TEXT
);

CREATE INDEX idx_metric_specialty ON metric(specialty);
```

#### display_plan
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS display_plan (
  metric_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  label TEXT NOT NULL,
  tier TEXT, -- 'PRIMARY' | 'SECONDARY' | 'DETAIL' | 'HIDDEN'
  visibility_cond TEXT,
  order_nbr INTEGER NOT NULL,

  PRIMARY KEY (metric_id, field_name)
);

CREATE INDEX idx_display_plan_metric ON display_plan(metric_id, order_nbr);
```

#### signal_group
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS signal_group (
  metric_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  group_code TEXT NOT NULL,

  PRIMARY KEY (metric_id, group_id)
);
```

#### signal_def
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS signal_def (
  metric_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,
  group_id TEXT,
  severity TEXT,
  status TEXT, -- Expected status: 'pass' | 'fail' | 'caution' | 'inactive'

  PRIMARY KEY (metric_id, signal_code)
);

CREATE INDEX idx_signal_def_group ON signal_def(metric_id, group_id);
```

#### followup
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS followup (
  metric_id TEXT NOT NULL,
  followup_id TEXT NOT NULL,
  when_cond TEXT,
  question_text TEXT NOT NULL,
  response_type TEXT, -- 'TEXT' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT'

  PRIMARY KEY (metric_id, followup_id)
);

CREATE INDEX idx_followup_metric ON followup(metric_id);
```

#### provenance_rule
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS provenance_rule (
  metric_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  table_name TEXT,
  key_name TEXT,
  field_ref TEXT,
  fallback_json JSONB,

  PRIMARY KEY (metric_id, field_name)
);

CREATE INDEX idx_provenance_metric ON provenance_rule(metric_id);
```

#### prompt
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS prompt (
  metric_id TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  persona TEXT,
  purpose TEXT,
  description TEXT,
  prompt_text TEXT NOT NULL,
  classifier_1 TEXT,
  classifier_2 TEXT,
  content_version TEXT,
  last_changed_at TIMESTAMP,

  PRIMARY KEY (metric_id, prompt_type)
);

CREATE INDEX idx_prompt_metric ON prompt(metric_id);
```

#### case
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS "case" ( -- "case" is reserved keyword in PostgreSQL, needs quotes
  case_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT, -- Nullable
  specialty TEXT NOT NULL,
  module_code TEXT, -- Nullable
  case_state TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'IN_REVIEW' | 'CLOSED'
  state_comment TEXT,
  first_seen_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE INDEX idx_case_patient ON "case"(patient_id);
CREATE INDEX idx_case_encounter ON "case"(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_case_state ON "case"(case_state) WHERE case_state != 'CLOSED';
CREATE INDEX idx_case_specialty_module ON "case"(specialty, module_code);
CREATE INDEX idx_case_updated ON "case"(updated_ts DESC);
```

#### feedback
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  run_id TEXT,
  mode TEXT, -- 'TEST' | 'PROD'
  rating NUMERIC,
  label TEXT,
  comment TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_case ON feedback(case_id);
CREATE INDEX idx_feedback_run ON feedback(run_id);
CREATE INDEX idx_feedback_patient ON feedback(patient_id);
```

#### ai_run
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS ai_run (
  run_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  case_id TEXT,
  mode TEXT NOT NULL, -- 'TEST' | 'PROD'
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL, -- 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  input_snapshot JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  prompt_type TEXT,
  prompt_version TEXT,
  model_id TEXT NOT NULL,
  params JSONB
);

CREATE INDEX idx_ai_run_case ON ai_run(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_ai_run_patient ON ai_run(patient_id);
CREATE INDEX idx_ai_run_encounter ON ai_run(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_ai_run_status ON ai_run(status) WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_ai_run_mode ON ai_run(mode);
```

#### ai_response
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS ai_response (
  run_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  mode TEXT NOT NULL,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  response JSONB NOT NULL,
  tokens INTEGER,
  cost NUMERIC(10, 6)
);

CREATE INDEX idx_ai_response_patient ON ai_response(patient_id);
```

#### signal_ledger
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS signal_ledger (
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  signal_code TEXT NOT NULL,
  metric_id TEXT,
  value JSONB,
  confidence NUMERIC(3, 2),
  start_ts TIMESTAMP NOT NULL,
  end_ts TIMESTAMP,

  PRIMARY KEY (patient_id, encounter_id, signal_code, start_ts)
);

CREATE INDEX idx_signal_ledger_patient ON signal_ledger(patient_id);
CREATE INDEX idx_signal_ledger_encounter ON signal_ledger(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_signal_ledger_signal ON signal_ledger(signal_code);
CREATE INDEX idx_signal_ledger_metric ON signal_ledger(metric_id) WHERE metric_id IS NOT NULL;
```

#### evidence
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  encounter_id TEXT,
  signal_code TEXT NOT NULL,
  cite_type TEXT NOT NULL, -- 'note' | 'lab' | 'op' | 'image'
  cite_ref TEXT NOT NULL,
  span JSONB,
  raw_excerpt TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_run ON evidence(run_id);
CREATE INDEX idx_evidence_patient ON evidence(patient_id);
CREATE INDEX idx_evidence_signal ON evidence(signal_code);
CREATE INDEX idx_evidence_cite_type ON evidence(cite_type);
```

#### prompt_bind
```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS prompt_bind (
  app_feature TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  specialty TEXT NOT NULL,
  module_code TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (app_feature, metric_id, prompt_type)
);

CREATE INDEX idx_prompt_bind_metric ON prompt_bind(metric_id);
CREATE INDEX idx_prompt_bind_specialty_module ON prompt_bind(specialty, module_code);
```

#### Test Tables
```sql
-- test_suite
CREATE TABLE IF NOT EXISTS test_suite (
  suite_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- test_case
CREATE TABLE IF NOT EXISTS test_case (
  test_case_id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  title TEXT NOT NULL,
  fixture JSONB NOT NULL,
  expected_signals JSONB,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_case_suite ON test_case(suite_id);

-- test_run
CREATE TABLE IF NOT EXISTS test_run (
  test_run_id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  model_id TEXT,
  prompt_version TEXT,
  params JSONB,
  started_ts TIMESTAMP,
  ended_ts TIMESTAMP,
  status TEXT
);

CREATE INDEX idx_test_run_suite ON test_run(suite_id);

-- test_assertion
CREATE TABLE IF NOT EXISTS test_assertion (
  test_run_id TEXT NOT NULL,
  test_case_id TEXT NOT NULL,
  assertion TEXT NOT NULL,
  expected JSONB,
  actual JSONB,
  pass BOOLEAN NOT NULL,
  patient_id TEXT,
  encounter_id TEXT,

  PRIMARY KEY (test_run_id, test_case_id, assertion)
);

CREATE INDEX idx_test_assertion_run ON test_assertion(test_run_id);
CREATE INDEX idx_test_assertion_case ON test_assertion(test_case_id);
```

#### Views
```sql
-- cases_last_week
CREATE OR REPLACE VIEW cases_last_week AS
  SELECT * FROM "case"
  WHERE updated_ts >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- cases_last_month
CREATE OR REPLACE VIEW cases_last_month AS
  SELECT * FROM "case"
  WHERE updated_ts >= CURRENT_TIMESTAMP - INTERVAL '1 month';
```

---

## Part 3: Drizzle ORM Schema Definitions

```typescript
// shared/schema.ts - Add to existing file

import { pgTable, text, timestamp, jsonb, numeric, integer, boolean, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';

// encounter_context
export const encounterContext = pgTable('encounter_context', {
  encounterId: text('encounter_id').primaryKey(),
  patientId: text('patient_id').notNull(),
  mrn: text('mrn').notNull(),
  context: jsonb('context').notNull(),
  payloadVersion: text('payload_version').default('1.0'),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
}, (table) => ({
  patientIdx: index('idx_encounter_context_patient').on(table.patientId),
  mrnIdx: index('idx_encounter_context_mrn').on(table.mrn),
  contextIdx: index('idx_encounter_context_payload').on(table.context).using('gin'),
}));

// metric
export const metric = pgTable('metric', {
  metricId: text('metric_id').primaryKey(),
  specialty: text('specialty').notNull(),
  metricName: text('metric_name').notNull(),
  domain: text('domain'),
  thresholdHours: numeric('threshold_hours'),
  contentVersion: text('content_version'),
}, (table) => ({
  specialtyIdx: index('idx_metric_specialty').on(table.specialty),
}));

// display_plan
export const displayPlan = pgTable('display_plan', {
  metricId: text('metric_id').notNull(),
  fieldName: text('field_name').notNull(),
  label: text('label').notNull(),
  tier: text('tier'),
  visibilityCond: text('visibility_cond'),
  orderNbr: integer('order_nbr').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.fieldName] }),
  metricOrderIdx: index('idx_display_plan_metric').on(table.metricId, table.orderNbr),
}));

// signal_group
export const signalGroup = pgTable('signal_group', {
  metricId: text('metric_id').notNull(),
  groupId: text('group_id').notNull(),
  groupCode: text('group_code').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.groupId] }),
}));

// signal_def
export const signalDef = pgTable('signal_def', {
  metricId: text('metric_id').notNull(),
  signalCode: text('signal_code').notNull(),
  groupId: text('group_id'),
  severity: text('severity'),
  status: text('status'),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.signalCode] }),
  groupIdx: index('idx_signal_def_group').on(table.metricId, table.groupId),
}));

// followup
export const followup = pgTable('followup', {
  metricId: text('metric_id').notNull(),
  followupId: text('followup_id').notNull(),
  whenCond: text('when_cond'),
  questionText: text('question_text').notNull(),
  responseType: text('response_type'),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.followupId] }),
  metricIdx: index('idx_followup_metric').on(table.metricId),
}));

// provenance_rule
export const provenanceRule = pgTable('provenance_rule', {
  metricId: text('metric_id').notNull(),
  fieldName: text('field_name').notNull(),
  tableName: text('table_name'),
  keyName: text('key_name'),
  fieldRef: text('field_ref'),
  fallbackJson: jsonb('fallback_json'),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.fieldName] }),
  metricIdx: index('idx_provenance_metric').on(table.metricId),
}));

// prompt
export const prompt = pgTable('prompt', {
  metricId: text('metric_id').notNull(),
  promptType: text('prompt_type').notNull(),
  persona: text('persona'),
  purpose: text('purpose'),
  description: text('description'),
  promptText: text('prompt_text').notNull(),
  classifier1: text('classifier_1'),
  classifier2: text('classifier_2'),
  contentVersion: text('content_version'),
  lastChangedAt: timestamp('last_changed_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.promptType] }),
  metricIdx: index('idx_prompt_metric').on(table.metricId),
}));

// case (note: "case" is reserved in PostgreSQL, needs quotes in raw SQL)
export const caseTable = pgTable('case', {
  caseId: text('case_id').primaryKey(),
  patientId: text('patient_id').notNull(),
  encounterId: text('encounter_id'),
  specialty: text('specialty').notNull(),
  moduleCode: text('module_code'),
  caseState: text('case_state').notNull().default('OPEN'),
  stateComment: text('state_comment'),
  firstSeenTs: timestamp('first_seen_ts').notNull().defaultNow(),
  updatedTs: timestamp('updated_ts').notNull().defaultNow(),
  updatedBy: text('updated_by'),
}, (table) => ({
  patientIdx: index('idx_case_patient').on(table.patientId),
  encounterIdx: index('idx_case_encounter').on(table.encounterId),
  stateIdx: index('idx_case_state').on(table.caseState),
  specialtyModuleIdx: index('idx_case_specialty_module').on(table.specialty, table.moduleCode),
  updatedIdx: index('idx_case_updated').on(table.updatedTs),
}));

// feedback
export const feedback = pgTable('feedback', {
  feedbackId: text('feedback_id').primaryKey(),
  caseId: text('case_id').notNull(),
  patientId: text('patient_id').notNull(),
  encounterId: text('encounter_id'),
  runId: text('run_id'),
  mode: text('mode'),
  rating: numeric('rating'),
  label: text('label'),
  comment: text('comment'),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
}, (table) => ({
  caseIdx: index('idx_feedback_case').on(table.caseId),
  runIdx: index('idx_feedback_run').on(table.runId),
  patientIdx: index('idx_feedback_patient').on(table.patientId),
}));

// ai_run
export const aiRun = pgTable('ai_run', {
  runId: text('run_id').primaryKey(),
  patientId: text('patient_id').notNull(),
  encounterId: text('encounter_id'),
  caseId: text('case_id'),
  mode: text('mode').notNull(),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
  status: text('status').notNull(),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  inputHash: text('input_hash').notNull(),
  promptType: text('prompt_type'),
  promptVersion: text('prompt_version'),
  modelId: text('model_id').notNull(),
  params: jsonb('params'),
}, (table) => ({
  caseIdx: index('idx_ai_run_case').on(table.caseId),
  patientIdx: index('idx_ai_run_patient').on(table.patientId),
  encounterIdx: index('idx_ai_run_encounter').on(table.encounterId),
  statusIdx: index('idx_ai_run_status').on(table.status),
  modeIdx: index('idx_ai_run_mode').on(table.mode),
}));

// ai_response
export const aiResponse = pgTable('ai_response', {
  runId: text('run_id').primaryKey(),
  patientId: text('patient_id').notNull(),
  encounterId: text('encounter_id'),
  mode: text('mode').notNull(),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
  response: jsonb('response').notNull(),
  tokens: integer('tokens'),
  cost: numeric('cost', { precision: 10, scale: 6 }),
}, (table) => ({
  patientIdx: index('idx_ai_response_patient').on(table.patientId),
}));

// signal_ledger
export const signalLedger = pgTable('signal_ledger', {
  patientId: text('patient_id').notNull(),
  encounterId: text('encounter_id'),
  signalCode: text('signal_code').notNull(),
  metricId: text('metric_id'),
  value: jsonb('value'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  startTs: timestamp('start_ts').notNull(),
  endTs: timestamp('end_ts'),
}, (table) => ({
  pk: primaryKey({ columns: [table.patientId, table.encounterId, table.signalCode, table.startTs] }),
  patientIdx: index('idx_signal_ledger_patient').on(table.patientId),
  encounterIdx: index('idx_signal_ledger_encounter').on(table.encounterId),
  signalIdx: index('idx_signal_ledger_signal').on(table.signalCode),
  metricIdx: index('idx_signal_ledger_metric').on(table.metricId),
}));

// evidence
export const evidence = pgTable('evidence', {
  evidenceId: text('evidence_id').primaryKey(),
  patientId: text('patient_id').notNull(),
  runId: text('run_id').notNull(),
  encounterId: text('encounter_id'),
  signalCode: text('signal_code').notNull(),
  citeType: text('cite_type').notNull(),
  citeRef: text('cite_ref').notNull(),
  span: jsonb('span'),
  rawExcerpt: text('raw_excerpt'),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
}, (table) => ({
  runIdx: index('idx_evidence_run').on(table.runId),
  patientIdx: index('idx_evidence_patient').on(table.patientId),
  signalIdx: index('idx_evidence_signal').on(table.signalCode),
  citeTypeIdx: index('idx_evidence_cite_type').on(table.citeType),
}));

// prompt_bind
export const promptBind = pgTable('prompt_bind', {
  appFeature: text('app_feature').notNull(),
  metricId: text('metric_id').notNull(),
  promptType: text('prompt_type').notNull(),
  specialty: text('specialty').notNull(),
  moduleCode: text('module_code').notNull(),
  enabled: boolean('enabled').notNull().default(true),
}, (table) => ({
  pk: primaryKey({ columns: [table.appFeature, table.metricId, table.promptType] }),
  metricIdx: index('idx_prompt_bind_metric').on(table.metricId),
  specialtyModuleIdx: index('idx_prompt_bind_specialty_module').on(table.specialty, table.moduleCode),
}));

// Test tables
export const testSuite = pgTable('test_suite', {
  suiteId: text('suite_id').primaryKey(),
  name: text('name').notNull(),
  owner: text('owner'),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
});

export const testCase = pgTable('test_case', {
  testCaseId: text('test_case_id').primaryKey(),
  suiteId: text('suite_id').notNull(),
  title: text('title').notNull(),
  fixture: jsonb('fixture').notNull(),
  expectedSignals: jsonb('expected_signals'),
  createdTs: timestamp('created_ts').notNull().defaultNow(),
}, (table) => ({
  suiteIdx: index('idx_test_case_suite').on(table.suiteId),
}));

export const testRun = pgTable('test_run', {
  testRunId: text('test_run_id').primaryKey(),
  suiteId: text('suite_id').notNull(),
  mode: text('mode').notNull(),
  modelId: text('model_id'),
  promptVersion: text('prompt_version'),
  params: jsonb('params'),
  startedTs: timestamp('started_ts'),
  endedTs: timestamp('ended_ts'),
  status: text('status'),
}, (table) => ({
  suiteIdx: index('idx_test_run_suite').on(table.suiteId),
}));

export const testAssertion = pgTable('test_assertion', {
  testRunId: text('test_run_id').notNull(),
  testCaseId: text('test_case_id').notNull(),
  assertion: text('assertion').notNull(),
  expected: jsonb('expected'),
  actual: jsonb('actual'),
  pass: boolean('pass').notNull(),
  patientId: text('patient_id'),
  encounterId: text('encounter_id'),
}, (table) => ({
  pk: primaryKey({ columns: [table.testRunId, table.testCaseId, table.assertion] }),
  runIdx: index('idx_test_assertion_run').on(table.testRunId),
  caseIdx: index('idx_test_assertion_case').on(table.testCaseId),
}));
```

---

## Part 4: Adapting HealthLevers to v9.2 Schema

### Key Mapping: HealthLevers → v9.2

| HealthLevers Concept | v9.2 Equivalent | Adaptation Strategy |
|----------------------|-----------------|---------------------|
| **cases** | **case** | Direct mapping; case_id = UUID |
| **case_payloads.payload** | **encounter_context.context** | Store clinical payload in encounter_context |
| **patients** table | **encounter_context.patient_id + mrn** | Extract patient data to encounter_context |
| **modules** | **metric** | Map HealthLevers modules → metrics |
| **signal_definitions** | **signal_def** | Load from orthoSignalMatrix.ts |
| **followup_questions** | **followup** | Load from planningConfig.tsx |
| **abstraction_results** | **signal_ledger** | Map signals to signal_ledger |
| **signal_evidence** | **evidence** | Direct mapping with cite_type |
| **prompts + prompt_versions** | **prompt** | Flatten versions into content_version |

### Data Flow Adaptation

#### Current HealthLevers Flow:
```
1. User selects: Specialty → Module → Case
2. Upload patient JSON → case_payloads table
3. Call AI → abstraction_runs table
4. Store signals → abstraction_results table
5. Store cites → signal_evidence table
```

#### v9.2 Standardized Flow:
```
1. User selects: Specialty → Metric (module) → Case
2. Upload patient JSON → encounter_context table (with mrn)
3. Create case record → case table (links to encounter_id)
4. Call AI → ai_run table
5. Store AI response → ai_response table
6. Store signals → signal_ledger table
7. Store cites → evidence table
```

### Configuration Data Migration

#### Step 1: Load Specialties & Modules → metrics
```typescript
// Migration script: load-metadata-to-metrics.ts
import { specialtyMetadata } from '@/data/specialtyMetadata';
import { db } from './db';
import { metric, signalDef, signalGroup, displayPlan, followup, prompt } from './schema';

async function loadMetadata() {
  for (const [specialtyId, specialtyData] of Object.entries(specialtyMetadata)) {
    for (const module of specialtyData.modules) {
      // Create metric
      await db.insert(metric).values({
        metricId: `${specialtyId}_${module.value}`,
        specialty: specialtyId,
        metricName: module.name,
        domain: module.description,
        thresholdHours: module.value === 'timeliness_sch' ? 19 : null,
        contentVersion: '1.0',
      });

      // Load signals from orthoSignalMatrix.ts
      const signals = orthoSignalMatrix[module.value] || [];
      for (const signal of signals) {
        await db.insert(signalDef).values({
          metricId: `${specialtyId}_${module.value}`,
          signalCode: signal.id,
          groupId: signal.group,
          severity: signal.status === 'fail' ? 'HIGH' : 'LOW',
          status: signal.status,
        });
      }

      // Load signal groups
      const groups = [...new Set(signals.map(s => s.group))];
      for (const group of groups) {
        await db.insert(signalGroup).values({
          metricId: `${specialtyId}_${module.value}`,
          groupId: group,
          groupCode: group.toUpperCase().replace(/\s+/g, '_'),
        });
      }

      // Load display plan
      const planningCfg = planningConfig.domains
        .find(d => d.domainId === specialtyId)
        ?.questions.find(q => q.questionId === module.value);

      if (planningCfg) {
        let order = 1;
        for (const [groupName, visible] of Object.entries(planningCfg.visibleGroups || {})) {
          await db.insert(displayPlan).values({
            metricId: `${specialtyId}_${module.value}`,
            fieldName: groupName,
            label: groupName,
            tier: order <= 2 ? 'PRIMARY' : 'SECONDARY',
            visibilityCond: visible ? null : 'false',
            orderNbr: order++,
          });
        }
      }

      // Load followup questions
      const followups = planningCfg?.followups || [];
      for (let i = 0; i < followups.length; i++) {
        await db.insert(followup).values({
          metricId: `${specialtyId}_${module.value}`,
          followupId: `FU${i + 1}`,
          questionText: followups[i],
          responseType: 'TEXT',
          whenCond: null,
        });
      }

      // Load prompts
      const defaultPrompt = module.defaultPrompt;
      if (defaultPrompt) {
        await db.insert(prompt).values({
          metricId: `${specialtyId}_${module.value}`,
          promptType: 'signal_processing',
          persona: 'You are an expert pediatric quality analyst.',
          purpose: `Evaluate ${module.name} quality metrics`,
          description: module.description,
          promptText: defaultPrompt,
          classifier1: specialtyId,
          classifier2: module.value,
          contentVersion: '1.0',
          lastChangedAt: new Date(),
        });
      }
    }
  }

  console.log('Metadata loaded successfully');
}

loadMetadata();
```

#### Step 2: Map localStorage Cases → v9.2 Schema
```typescript
// Migration script: migrate-localstorage-to-v92.ts
async function migrateLocalStorageCases() {
  const localCases = JSON.parse(localStorage.getItem('abstraction.cases') || '[]');

  for (const localCase of localCases) {
    const patientPayload = localCase.patient_payload;
    const encounterId = localCase.selectedCaseId;
    const patientId = patientPayload.patient?.mrn || `P_${encounterId}`;
    const mrn = patientPayload.patient?.mrn;

    // 1. Create encounter_context
    await db.insert(encounterContext).values({
      encounterId: encounterId,
      patientId: patientId,
      mrn: mrn,
      context: patientPayload,
      payloadVersion: '1.0',
      createdTs: new Date(),
    });

    // 2. Create case
    const caseId = `CASE_${encounterId}`;
    const metricId = `${localCase.selectedSpecialty}_${localCase.selectedModuleId}`;

    await db.insert(caseTable).values({
      caseId: caseId,
      patientId: patientId,
      encounterId: encounterId,
      specialty: localCase.selectedSpecialty,
      moduleCode: localCase.selectedModuleId,
      caseState: 'CLOSED', // Assume completed
      stateComment: 'Migrated from localStorage',
      firstSeenTs: new Date(),
      updatedTs: new Date(),
      updatedBy: 'MIGRATION',
    });

    // 3. Create mock ai_run (since we don't have historical run data)
    const runId = `RUN_${encounterId}`;
    await db.insert(aiRun).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      caseId: caseId,
      mode: 'PROD',
      createdTs: new Date(),
      status: 'COMPLETED',
      inputSnapshot: patientPayload,
      inputHash: hashObject(patientPayload),
      promptType: 'signal_processing',
      promptVersion: '1.0',
      modelId: 'gpt-4o',
      params: { temperature: 0.7 },
    });

    // 4. Create ai_response
    await db.insert(aiResponse).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      mode: 'PROD',
      createdTs: new Date(),
      response: { signals: localCase.mergedSignals },
      tokens: null,
      cost: null,
    });

    // 5. Create signal_ledger entries
    for (const signal of localCase.mergedSignals) {
      await db.insert(signalLedger).values({
        patientId: patientId,
        encounterId: encounterId,
        signalCode: signal.id,
        metricId: metricId,
        value: {
          status: signal.status,
          label: signal.label,
          finding: signal.evidence,
        },
        confidence: signal.enriched ? 1.0 : 0.85,
        startTs: new Date(),
        endTs: null,
      });

      // 6. Create evidence entries from cites
      if (signal.cites && Array.isArray(signal.cites)) {
        for (const cite of signal.cites) {
          const evidenceId = `EV_${runId}_${signal.id}_${cite}`;
          const citeType = determineCiteType(cite); // Helper function

          await db.insert(evidence).values({
            evidenceId: evidenceId,
            patientId: patientId,
            runId: runId,
            encounterId: encounterId,
            signalCode: signal.id,
            citeType: citeType,
            citeRef: cite,
            span: null,
            rawExcerpt: extractExcerpt(patientPayload, cite), // Helper function
            createdTs: new Date(),
          });
        }
      }
    }
  }

  console.log(`Migrated ${localCases.length} cases from localStorage`);
}

// Helper: Determine cite type from field path
function determineCiteType(citePath: string): string {
  if (citePath.includes('notes') || citePath.includes('delay_summary')) return 'note';
  if (citePath.includes('labs')) return 'lab';
  if (citePath.includes('surgery') || citePath.includes('procedure')) return 'op';
  if (citePath.includes('imaging') || citePath.includes('xray') || citePath.includes('ct')) return 'image';
  return 'note'; // default
}

// Helper: Extract excerpt from payload
function extractExcerpt(payload: any, path: string): string | null {
  const value = path.split('.').reduce((obj, key) => obj?.[key], payload);
  return value ? String(value) : null;
}
```

### API Endpoint Updates

#### Update `/api/ai_signals` to use v9.2 schema
```typescript
// server/routes.ts - Updated endpoint
router.post('/api/ai_signals', async (req, res) => {
  const { specialty, moduleId, patient, promptText } = req.body;

  // Generate IDs
  const patientId = patient.patient?.mrn || `P_${Date.now()}`;
  const encounterId = patient.id || `E_${Date.now()}`;
  const caseId = `CASE_${Date.now()}`;
  const runId = `RUN_${Date.now()}`;
  const metricId = `${specialty}_${moduleId}`;

  try {
    // 1. Store encounter_context
    await db.insert(encounterContext).values({
      encounterId: encounterId,
      patientId: patientId,
      mrn: patient.patient?.mrn,
      context: patient,
      payloadVersion: '1.0',
      createdTs: new Date(),
    });

    // 2. Create case
    await db.insert(caseTable).values({
      caseId: caseId,
      patientId: patientId,
      encounterId: encounterId,
      specialty: specialty,
      moduleCode: moduleId,
      caseState: 'OPEN',
      stateComment: null,
      firstSeenTs: new Date(),
      updatedTs: new Date(),
      updatedBy: req.session?.user?.id || 'anonymous',
    });

    // 3. Create ai_run
    await db.insert(aiRun).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      caseId: caseId,
      mode: 'TEST',
      createdTs: new Date(),
      status: 'RUNNING',
      inputSnapshot: patient,
      inputHash: hashObject(patient),
      promptType: 'signal_processing',
      promptVersion: '1.0',
      modelId: 'gpt-4o',
      params: { temperature: 0.7 },
    });

    // 4. Call OpenAI
    const aiResult = await callOpenAI(promptText, patient);

    // 5. Store ai_response
    await db.insert(aiResponse).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      mode: 'TEST',
      createdTs: new Date(),
      response: aiResult.response,
      tokens: aiResult.tokens,
      cost: aiResult.cost,
    });

    // 6. Parse signals and store in signal_ledger
    const signals = aiResult.response.signals || [];
    for (const signal of signals) {
      await db.insert(signalLedger).values({
        patientId: patientId,
        encounterId: encounterId,
        signalCode: signal.id,
        metricId: metricId,
        value: {
          status: signal.status,
          label: signal.label,
          finding: signal.finding,
          reason: signal.reason,
        },
        confidence: signal.confidence || 0.85,
        startTs: new Date(),
        endTs: null,
      });

      // 7. Store evidence/cites
      if (signal.cites && Array.isArray(signal.cites)) {
        for (const cite of signal.cites) {
          await db.insert(evidence).values({
            evidenceId: `${runId}_${signal.id}_${cite}`,
            patientId: patientId,
            runId: runId,
            encounterId: encounterId,
            signalCode: signal.id,
            citeType: determineCiteType(cite),
            citeRef: cite,
            span: null,
            rawExcerpt: extractExcerpt(patient, cite),
            createdTs: new Date(),
          });
        }
      }
    }

    // 8. Update ai_run status
    await db.update(aiRun)
      .set({ status: 'COMPLETED' })
      .where(eq(aiRun.runId, runId));

    // Return formatted response
    res.json({
      signals: signals,
      category_counts: calculateCategoryCounts(signals),
      run_id: runId,
      case_id: caseId,
    });

  } catch (error) {
    console.error('AI processing error:', error);

    // Update ai_run status to FAILED
    await db.update(aiRun)
      .set({ status: 'FAILED' })
      .where(eq(aiRun.runId, runId));

    res.status(500).json({ error: 'AI processing failed' });
  }
});
```

---

## Part 5: Migration Path - PostgreSQL Prototype → Snowflake Production

### Phase 1: PostgreSQL Prototype (Current)
- Use v9.2 schema translated to PostgreSQL
- Develop and test all features
- Validate data model with real users
- **Duration**: 3-6 months

### Phase 2: Snowflake Preparation
- Create Snowflake instance
- Run v9.2 DDL (original Snowflake syntax)
- Set up data pipeline
- **Duration**: 2-4 weeks

### Phase 3: Dual-Write Period
- Write to both PostgreSQL AND Snowflake
- Compare data consistency
- Validate Snowflake queries
- **Duration**: 2-4 weeks

### Phase 4: Read Migration
- Switch reads from PostgreSQL → Snowflake
- Monitor performance
- Keep PostgreSQL as fallback
- **Duration**: 1-2 weeks

### Phase 5: Full Cutover
- All reads/writes from Snowflake
- Decommission PostgreSQL
- **Duration**: 1 week

### Data Migration Script (PostgreSQL → Snowflake)
```python
# migration/postgres_to_snowflake.py
import psycopg2
import snowflake.connector

# Connect to PostgreSQL
pg_conn = psycopg2.connect(
    host="your-neon-host",
    database="healthlevers",
    user="user",
    password="password"
)

# Connect to Snowflake
sf_conn = snowflake.connector.connect(
    account="your-account",
    user="user",
    password="password",
    warehouse="COMPUTE_WH",
    database="GOLD_AI",
    schema="PUBLIC"
)

def migrate_table(table_name, pg_cursor, sf_cursor):
    # Read from PostgreSQL
    pg_cursor.execute(f"SELECT * FROM {table_name}")
    rows = pg_cursor.fetchall()
    columns = [desc[0] for desc in pg_cursor.description]

    # Prepare Snowflake INSERT
    placeholders = ', '.join(['%s'] * len(columns))
    sf_query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"

    # Batch insert to Snowflake
    sf_cursor.executemany(sf_query, rows)
    print(f"Migrated {len(rows)} rows from {table_name}")

# Migrate all tables
tables = [
    'encounter_context', 'metric', 'display_plan', 'signal_group', 'signal_def',
    'followup', 'provenance_rule', 'prompt', 'case', 'feedback', 'ai_run',
    'ai_response', 'signal_ledger', 'evidence', 'prompt_bind', 'test_suite',
    'test_case', 'test_run', 'test_assertion'
]

pg_cursor = pg_conn.cursor()
sf_cursor = sf_conn.cursor()

for table in tables:
    migrate_table(table, pg_cursor, sf_cursor)
    sf_conn.commit()

pg_cursor.close()
sf_cursor.close()
pg_conn.close()
sf_conn.close()

print("Migration complete!")
```

---

## Part 6: Maintaining Cross-Project Standardization

### Configuration vs. Customization Strategy

**Use Configuration (NOT schema changes) for project-specific needs:**

1. **Different signal definitions** → Load into `signal_def` table
2. **Different UI layouts** → Configure via `display_plan`
3. **Different prompts** → Store in `prompt` table
4. **Different metrics** → Add rows to `metric` table
5. **Different followups** → Add rows to `followup` table

**Only customize schema for:**
- Truly project-specific entities (rare)
- Extensions that enhance the standard (submit back to standard)

### Example: Adding HealthLevers-Specific Config

```sql
-- Add HealthLevers-specific metrics to standard schema
INSERT INTO metric (metric_id, specialty, metric_name, domain, threshold_hours, content_version) VALUES
  ('orthopedics_timeliness_sch', 'Orthopedics', 'SCH Timeliness', 'Timeliness', 19, '1.0'),
  ('orthopedics_documentation_sch', 'Orthopedics', 'SCH Documentation', 'Documentation', NULL, '1.0');

-- Add HealthLevers-specific signals
INSERT INTO signal_def (metric_id, signal_code, group_id, severity, status) VALUES
  ('orthopedics_timeliness_sch', 'on_time_19h', 'Core', 'HIGH', 'pass'),
  ('orthopedics_timeliness_sch', 'dx_confirmed', 'Core', 'HIGH', 'pass'),
  ('orthopedics_timeliness_sch', 'npo_violation', 'Delay Drivers', 'MEDIUM', 'fail');

-- Add HealthLevers-specific display config
INSERT INTO display_plan (metric_id, field_name, label, tier, visibility_cond, order_nbr) VALUES
  ('orthopedics_timeliness_sch', 'on_time_19h', 'Incision within 19h', 'PRIMARY', NULL, 1),
  ('orthopedics_timeliness_sch', 'dx_confirmed', 'Diagnosis confirmed', 'PRIMARY', NULL, 2),
  ('orthopedics_timeliness_sch', 'npo_violation', 'NPO violation', 'SECONDARY', "value.status === 'fail'", 3);
```

### Contribution Back to Standard

If HealthLevers discovers schema improvements:
1. Document the enhancement
2. Submit to schema governance team
3. Include in next standard version
4. All projects benefit

---

## Summary

### ✅ **Final Recommendation: Adopt v9.2 Schema with PostgreSQL Translation**

**Immediate Steps (Week 1):**
1. Translate v9.2 DDL to PostgreSQL (use Part 2 of this document)
2. Add Drizzle ORM definitions (use Part 3)
3. Create migration: `0001_create_v92_schema.ts`
4. Run migration in development

**Short-term (Weeks 2-4):**
1. Load metadata (specialties, modules, signals) into metric/signal_def tables
2. Migrate localStorage cases to v9.2 schema
3. Update API endpoints to use v9.2 tables
4. Test with real cases

**Medium-term (Months 2-3):**
1. Develop all features on PostgreSQL
2. Validate with users
3. Refine configuration

**Long-term (Months 4-6):**
1. Set up Snowflake instance
2. Dual-write period (PostgreSQL + Snowflake)
3. Switch reads to Snowflake
4. Full cutover to Snowflake

### Key Principles:
- ✅ Use v9.2 standard schema (maintain cross-project compatibility)
- ✅ Configure, don't customize (use metric/signal_def/display_plan tables)
- ✅ PostgreSQL for prototype, Snowflake for production
- ✅ Minimize schema divergence (easier migration later)

---

## Next Steps

**Ready to implement? I can help with:**
1. Creating the Drizzle migration file for v9.2 schema
2. Writing the metadata loading scripts
3. Updating API endpoints to use v9.2 tables
4. Creating the localStorage → v9.2 migration script
5. Setting up the dual-write infrastructure for Snowflake migration

**Which would you like me to start with?**
