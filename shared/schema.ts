import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// =============================================================================
// V9.2 SCHEMA TABLES (Configuration + Runtime)
// =============================================================================

// Configuration Tables (from Excel metadata)

export const metric = pgTable('metric', {
  metricId: text('metric_id').primaryKey(),
  specialty: text('specialty').notNull(),              // Display name: "Ortho", "Cardiology"
  specialtyId: text('specialty_id'),                   // Code: "ORTHO", "CARDIOLOGY"
  questionCode: text('question_code'),                 // USNWR question: "I25", "E24", "I32a"
  metricName: text('metric_name').notNull(),
  domain: text('domain'),                              // Measurement category: "timeliness", "readmission"
  priority: integer('priority'),                       // Priority order
  thresholdHours: numeric('threshold_hours'),
  definitionWindow: text('definition_window'),         // "start_time -> end_time"
  active: boolean('active').default(true),             // Whether metric is active
  version: text('version'),                            // "0.0.1"
  contentVersion: text('content_version'),
}, (table) => ({
  specialtyIdx: index('idx_metric_specialty').on(table.specialty),
  specialtyIdIdx: index('idx_metric_specialty_id').on(table.specialtyId),
  questionCodeIdx: index('idx_metric_question_code').on(table.questionCode),
  activeIdx: index('idx_metric_active').on(table.active),
}));

export const signalGroup = pgTable('signal_group', {
  metricId: text('metric_id').notNull(),
  groupId: text('group_id').notNull(),
  groupCode: text('group_code').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.groupId] }),
  metricIdx: index('idx_signal_group_metric').on(table.metricId),
}));

export const signalDef = pgTable('signal_def', {
  metricId: text('metric_id').notNull(),
  signalCode: text('signal_code').notNull(),
  groupId: text('group_id'),
  severity: text('severity'),
  status: text('status'),
}, (table) => ({
  pk: primaryKey({ columns: [table.metricId, table.signalCode] }),
  metricIdx: index('idx_signal_def_metric').on(table.metricId),
  groupIdx: index('idx_signal_def_group').on(table.metricId, table.groupId),
}));

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

// Runtime Tables (clinical data and AI processing)

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
}));

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

// Test Tables

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

// Export v9.2 table types
export type Metric = typeof metric.$inferSelect;
export type InsertMetric = typeof metric.$inferInsert;

export type SignalGroup = typeof signalGroup.$inferSelect;
export type InsertSignalGroup = typeof signalGroup.$inferInsert;

export type SignalDef = typeof signalDef.$inferSelect;
export type InsertSignalDef = typeof signalDef.$inferInsert;

export type Followup = typeof followup.$inferSelect;
export type InsertFollowup = typeof followup.$inferInsert;

export type DisplayPlan = typeof displayPlan.$inferSelect;
export type InsertDisplayPlan = typeof displayPlan.$inferInsert;

export type ProvenanceRule = typeof provenanceRule.$inferSelect;
export type InsertProvenanceRule = typeof provenanceRule.$inferInsert;

export type Prompt = typeof prompt.$inferSelect;
export type InsertPrompt = typeof prompt.$inferInsert;

export type PromptBind = typeof promptBind.$inferSelect;
export type InsertPromptBind = typeof promptBind.$inferInsert;

export type EncounterContext = typeof encounterContext.$inferSelect;
export type InsertEncounterContext = typeof encounterContext.$inferInsert;

export type Case = typeof caseTable.$inferSelect;
export type InsertCase = typeof caseTable.$inferInsert;

export type AiRun = typeof aiRun.$inferSelect;
export type InsertAiRun = typeof aiRun.$inferInsert;

export type AiResponse = typeof aiResponse.$inferSelect;
export type InsertAiResponse = typeof aiResponse.$inferInsert;

export type SignalLedger = typeof signalLedger.$inferSelect;
export type InsertSignalLedger = typeof signalLedger.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = typeof evidence.$inferInsert;

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

export type TestSuite = typeof testSuite.$inferSelect;
export type InsertTestSuite = typeof testSuite.$inferInsert;

export type TestCaseFixture = typeof testCase.$inferSelect;
export type InsertTestCaseFixture = typeof testCase.$inferInsert;

export type TestRun = typeof testRun.$inferSelect;
export type InsertTestRun = typeof testRun.$inferInsert;

export type TestAssertion = typeof testAssertion.$inferSelect;
export type InsertTestAssertion = typeof testAssertion.$inferInsert;

// =============================================================================
// END V9.2 SCHEMA
// =============================================================================

// Specialty Configuration Schema
export const specialtyQuestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  key_fields: z.array(z.string()),
  validation: z.string(),
  signal_chips: z.array(z.string()).optional(),
  signal_defs: z.record(z.string(), z.object({
    definition: z.string(),
    rule: z.string()
  })).optional()
});

export const specialtyConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(specialtyQuestionSchema)
});

// Patient Data Schema
export const patientDataSchema = z.object({
  id: z.string(),
  description: z.string(),
  specialty: z.string(),
  data: z.record(z.string(), z.any()),
  editable_notes: z.string().optional()
});

// Test Case Schema
export const testCaseSchema = z.object({
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string(),
  fields: z.record(z.string(), z.any()),
  editable_notes: z.string().optional()
});

// Validation Result Schema
export const validationResultSchema = z.object({
  signal: z.string(),
  status: z.enum(["VALIDATED", "REJECTED"]),
  finding: z.string(),
  evidence: z.string(),
  category: z.string().optional()
});

// Abstraction Result Schema
export const abstractionResultSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string(),
  question_label: z.string(),
  validated_signals: z.array(validationResultSchema),
  processing_status: z.object({
    llm_inference: z.boolean(),
    signal_validation: z.boolean(),
    domain_rules_check: z.boolean(),
    evidence_compilation: z.boolean()
  }),
  created_at: z.string(),
  signals: z.array(z.object({
    check: z.string(),
    status: z.enum(["pass", "fail", "caution", "inactive"]),
    evidence: z.string()
  })).optional()
});

// Export types
export type SpecialtyQuestion = z.infer<typeof specialtyQuestionSchema>;
export type SpecialtyConfig = z.infer<typeof specialtyConfigSchema>;
export type PatientData = z.infer<typeof patientDataSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type AbstractionResult = z.infer<typeof abstractionResultSchema>;

// Insert schemas
export const insertTestCaseSchema = testCaseSchema.omit({ patient_id: true }).extend({
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string()
});

export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
