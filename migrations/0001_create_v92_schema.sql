-- Migration: Create v9.2 Schema for HealthLevers
-- Date: 2025-11-07
-- Description: Create all 19 v9.2 tables for metadata and runtime data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CONFIGURATION TABLES (Metadata from Excel)
-- =============================================================================

-- Table: metric
-- Purpose: Master definition of all quality metrics (from Excel metrics sheet)
CREATE TABLE IF NOT EXISTS metric (
  metric_id TEXT PRIMARY KEY,
  specialty TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  domain TEXT,
  threshold_hours NUMERIC,
  content_version TEXT
);

CREATE INDEX idx_metric_specialty ON metric(specialty);

-- Table: signal_group
-- Purpose: Signal grouping and categorization (from Excel groups sheet)
CREATE TABLE IF NOT EXISTS signal_group (
  metric_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  group_code TEXT NOT NULL,
  PRIMARY KEY (metric_id, group_id)
);

CREATE INDEX idx_signal_group_metric ON signal_group(metric_id);

-- Table: signal_def
-- Purpose: Individual signal definitions (from Excel signals sheet)
CREATE TABLE IF NOT EXISTS signal_def (
  metric_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,
  group_id TEXT,
  severity TEXT,
  status TEXT,
  PRIMARY KEY (metric_id, signal_code)
);

CREATE INDEX idx_signal_def_metric ON signal_def(metric_id);
CREATE INDEX idx_signal_def_group ON signal_def(metric_id, group_id);

-- Table: followup
-- Purpose: Dynamic follow-up questions (from Excel followups sheet)
CREATE TABLE IF NOT EXISTS followup (
  metric_id TEXT NOT NULL,
  followup_id TEXT NOT NULL,
  when_cond TEXT,
  question_text TEXT NOT NULL,
  response_type TEXT,
  PRIMARY KEY (metric_id, followup_id)
);

CREATE INDEX idx_followup_metric ON followup(metric_id);

-- Table: display_plan
-- Purpose: UI field visibility and layout (from Excel display_plan sheet)
CREATE TABLE IF NOT EXISTS display_plan (
  metric_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  label TEXT NOT NULL,
  tier TEXT,
  visibility_cond TEXT,
  order_nbr INTEGER NOT NULL,
  PRIMARY KEY (metric_id, field_name)
);

CREATE INDEX idx_display_plan_metric ON display_plan(metric_id, order_nbr);

-- Table: provenance_rule
-- Purpose: Data lineage and validation (from Excel provenance_rules sheet)
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

-- Table: prompt
-- Purpose: AI prompts for different workflow stages (from Excel prompts sheet)
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

-- Table: prompt_bind
-- Purpose: Routing configuration for prompts
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

-- =============================================================================
-- RUNTIME TABLES (Clinical data and AI processing)
-- =============================================================================

-- Table: encounter_context
-- Purpose: Canonical clinical payload per encounter
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
CREATE INDEX idx_encounter_context_payload ON encounter_context USING gin(context);

-- Table: "case" (quoted because "case" is a reserved keyword in PostgreSQL)
-- Purpose: Case workflow
CREATE TABLE IF NOT EXISTS "case" (
  case_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  specialty TEXT NOT NULL,
  module_code TEXT,
  case_state TEXT NOT NULL DEFAULT 'OPEN',
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

-- Table: ai_run
-- Purpose: Frozen inputs & run metadata
CREATE TABLE IF NOT EXISTS ai_run (
  run_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  case_id TEXT,
  mode TEXT NOT NULL,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL,
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

-- Table: ai_response
-- Purpose: Raw model outputs
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

-- Table: signal_ledger
-- Purpose: Normalized signals
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

-- Table: evidence
-- Purpose: Evidence & cites for signals
CREATE TABLE IF NOT EXISTS evidence (
  evidence_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  encounter_id TEXT,
  signal_code TEXT NOT NULL,
  cite_type TEXT NOT NULL,
  cite_ref TEXT NOT NULL,
  span JSONB,
  raw_excerpt TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_run ON evidence(run_id);
CREATE INDEX idx_evidence_patient ON evidence(patient_id);
CREATE INDEX idx_evidence_signal ON evidence(signal_code);
CREATE INDEX idx_evidence_cite_type ON evidence(cite_type);

-- Table: feedback
-- Purpose: Human-in-loop feedback
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  run_id TEXT,
  mode TEXT,
  rating NUMERIC,
  label TEXT,
  comment TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_case ON feedback(case_id);
CREATE INDEX idx_feedback_run ON feedback(run_id);
CREATE INDEX idx_feedback_patient ON feedback(patient_id);

-- =============================================================================
-- TEST TABLES
-- =============================================================================

-- Table: test_suite
-- Purpose: Test grouping
CREATE TABLE IF NOT EXISTS test_suite (
  suite_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: test_case
-- Purpose: Test fixtures
CREATE TABLE IF NOT EXISTS test_case (
  test_case_id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  title TEXT NOT NULL,
  fixture JSONB NOT NULL,
  expected_signals JSONB,
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_case_suite ON test_case(suite_id);

-- Table: test_run
-- Purpose: Test executions
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

-- Table: test_assertion
-- Purpose: Test results
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

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: cases_last_week
CREATE OR REPLACE VIEW cases_last_week AS
  SELECT * FROM "case"
  WHERE updated_ts >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- View: cases_last_month
CREATE OR REPLACE VIEW cases_last_month AS
  SELECT * FROM "case"
  WHERE updated_ts >= CURRENT_TIMESTAMP - INTERVAL '1 month';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verify tables created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'metric', 'signal_group', 'signal_def', 'followup', 'display_plan',
    'provenance_rule', 'prompt', 'prompt_bind', 'encounter_context',
    'case', 'ai_run', 'ai_response', 'signal_ledger', 'evidence',
    'feedback', 'test_suite', 'test_case', 'test_run', 'test_assertion'
  );

  IF table_count = 19 THEN
    RAISE NOTICE '✅ Migration successful: All 19 tables created';
  ELSE
    RAISE EXCEPTION '❌ Migration incomplete: Only % tables created (expected 19)', table_count;
  END IF;
END $$;
