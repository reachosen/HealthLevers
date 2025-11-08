#!/usr/bin/env tsx
/**
 * Database Validation Script
 *
 * Validates all v9.2 tables by performing CRUD operations.
 * Tests: INSERT, SELECT, UPDATE, DELETE on all 19 tables.
 * Ensures database is properly set up and accessible.
 */

import 'dotenv/config';
import { db } from '../server/db';
import {
  // Configuration tables
  metric, signalGroup, signalDef, followup, displayPlan,
  provenanceRule, prompt, promptBind,
  // Runtime tables
  encounterContext, caseTable, aiRun, aiResponse, signalLedger, evidence, feedback,
  // Test tables
  testSuite, testCase, testRun, testAssertion,
} from '../shared/schema';
import { eq, and } from 'drizzle-orm';

// Test data IDs for cleanup
const testIds = {
  metricId: 'TEST_METRIC_001',
  metricId2: 'TEST_METRIC_002',
  patientId: 'TEST_PATIENT_001',
  encounterId: 'TEST_ENCOUNTER_001',
  caseId: 'TEST_CASE_001',
  runId: 'TEST_RUN_001',
  evidenceId: 'TEST_EVIDENCE_001',
  feedbackId: 'TEST_FEEDBACK_001',
  suiteId: 'TEST_SUITE_001',
  testCaseId: 'TEST_CASE_001',
  testRunId: 'TEST_RUN_001',
};

async function validateTable(
  tableName: string,
  testFn: () => Promise<void>
): Promise<boolean> {
  try {
    console.log(`\n${tableName}...`);
    await testFn();
    console.log(`   ✅ ${tableName} validation passed`);
    return true;
  } catch (error) {
    console.error(`   ❌ ${tableName} validation failed:`, error);
    return false;
  }
}

async function validateMetric() {
  // INSERT
  await db.insert(metric).values({
    metricId: testIds.metricId,
    specialty: 'ORTHO',
    metricName: 'Test Hip Fracture Metric',
    domain: 'surgical_timing',
    thresholdHours: '48',
    contentVersion: '1.0',
  });

  // SELECT
  const rows = await db.select().from(metric)
    .where(eq(metric.metricId, testIds.metricId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(metric)
    .set({ metricName: 'Updated Test Metric' })
    .where(eq(metric.metricId, testIds.metricId));

  const updated = await db.select().from(metric)
    .where(eq(metric.metricId, testIds.metricId));
  if (updated[0].metricName !== 'Updated Test Metric') {
    throw new Error('UPDATE failed');
  }

  // DELETE tested at end for FK dependencies
}

async function validateSignalGroup() {
  // INSERT
  await db.insert(signalGroup).values({
    metricId: testIds.metricId,
    groupId: 'test_group_001',
    groupCode: 'TEST_GROUP',
  });

  // SELECT
  const rows = await db.select().from(signalGroup)
    .where(and(
      eq(signalGroup.metricId, testIds.metricId),
      eq(signalGroup.groupId, 'test_group_001')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE (update groupCode)
  await db.update(signalGroup)
    .set({ groupCode: 'UPDATED_GROUP' })
    .where(and(
      eq(signalGroup.metricId, testIds.metricId),
      eq(signalGroup.groupId, 'test_group_001')
    ));

  // DELETE
  await db.delete(signalGroup)
    .where(and(
      eq(signalGroup.metricId, testIds.metricId),
      eq(signalGroup.groupId, 'test_group_001')
    ));
}

async function validateSignalDef() {
  // INSERT
  await db.insert(signalDef).values({
    metricId: testIds.metricId,
    signalCode: 'test_signal_001',
    groupId: 'test_group',
    severity: 'high',
    status: 'active',
  });

  // SELECT
  const rows = await db.select().from(signalDef)
    .where(and(
      eq(signalDef.metricId, testIds.metricId),
      eq(signalDef.signalCode, 'test_signal_001')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(signalDef)
    .set({ severity: 'medium' })
    .where(and(
      eq(signalDef.metricId, testIds.metricId),
      eq(signalDef.signalCode, 'test_signal_001')
    ));

  // DELETE
  await db.delete(signalDef)
    .where(and(
      eq(signalDef.metricId, testIds.metricId),
      eq(signalDef.signalCode, 'test_signal_001')
    ));
}

async function validateFollowup() {
  // INSERT
  await db.insert(followup).values({
    metricId: testIds.metricId,
    followupId: 'test_followup_001',
    whenCond: 'signal_detected',
    questionText: 'Was surgery performed?',
    responseType: 'yes_no',
  });

  // SELECT
  const rows = await db.select().from(followup)
    .where(and(
      eq(followup.metricId, testIds.metricId),
      eq(followup.followupId, 'test_followup_001')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(followup)
    .set({ questionText: 'Updated question?' })
    .where(and(
      eq(followup.metricId, testIds.metricId),
      eq(followup.followupId, 'test_followup_001')
    ));

  // DELETE
  await db.delete(followup)
    .where(and(
      eq(followup.metricId, testIds.metricId),
      eq(followup.followupId, 'test_followup_001')
    ));
}

async function validateDisplayPlan() {
  // INSERT
  await db.insert(displayPlan).values({
    metricId: testIds.metricId,
    fieldName: 'test_field',
    label: 'Test Field Label',
    tier: 'primary',
    visibilityCond: 'always',
    orderNbr: 1,
  });

  // SELECT
  const rows = await db.select().from(displayPlan)
    .where(and(
      eq(displayPlan.metricId, testIds.metricId),
      eq(displayPlan.fieldName, 'test_field')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(displayPlan)
    .set({ label: 'Updated Label' })
    .where(and(
      eq(displayPlan.metricId, testIds.metricId),
      eq(displayPlan.fieldName, 'test_field')
    ));

  // DELETE
  await db.delete(displayPlan)
    .where(and(
      eq(displayPlan.metricId, testIds.metricId),
      eq(displayPlan.fieldName, 'test_field')
    ));
}

async function validateProvenanceRule() {
  // INSERT
  await db.insert(provenanceRule).values({
    metricId: testIds.metricId,
    fieldName: 'test_field',
    tableName: 'encounter_context',
    keyName: 'encounter_id',
    fieldRef: 'context.admission_date',
    fallbackJson: { default: null },
  });

  // SELECT
  const rows = await db.select().from(provenanceRule)
    .where(and(
      eq(provenanceRule.metricId, testIds.metricId),
      eq(provenanceRule.fieldName, 'test_field')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(provenanceRule)
    .set({ tableName: 'updated_table' })
    .where(and(
      eq(provenanceRule.metricId, testIds.metricId),
      eq(provenanceRule.fieldName, 'test_field')
    ));

  // DELETE
  await db.delete(provenanceRule)
    .where(and(
      eq(provenanceRule.metricId, testIds.metricId),
      eq(provenanceRule.fieldName, 'test_field')
    ));
}

async function validatePrompt() {
  // INSERT
  await db.insert(prompt).values({
    metricId: testIds.metricId,
    promptType: 'extraction',
    persona: 'clinical_abstractor',
    purpose: 'Extract surgical timing',
    description: 'Test prompt',
    promptText: 'Extract the surgery date from the clinical notes.',
    classifier1: 'timing',
    classifier2: 'surgical',
    contentVersion: '1.0',
  });

  // SELECT
  const rows = await db.select().from(prompt)
    .where(and(
      eq(prompt.metricId, testIds.metricId),
      eq(prompt.promptType, 'extraction')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(prompt)
    .set({ description: 'Updated description' })
    .where(and(
      eq(prompt.metricId, testIds.metricId),
      eq(prompt.promptType, 'extraction')
    ));

  // DELETE
  await db.delete(prompt)
    .where(and(
      eq(prompt.metricId, testIds.metricId),
      eq(prompt.promptType, 'extraction')
    ));
}

async function validatePromptBind() {
  // INSERT
  await db.insert(promptBind).values({
    appFeature: 'extraction',
    metricId: testIds.metricId,
    promptType: 'extraction',
    specialty: 'ORTHO',
    moduleCode: 'hip_fracture',
    enabled: true,
  });

  // SELECT
  const rows = await db.select().from(promptBind)
    .where(and(
      eq(promptBind.appFeature, 'extraction'),
      eq(promptBind.metricId, testIds.metricId),
      eq(promptBind.promptType, 'extraction')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(promptBind)
    .set({ enabled: false })
    .where(and(
      eq(promptBind.appFeature, 'extraction'),
      eq(promptBind.metricId, testIds.metricId),
      eq(promptBind.promptType, 'extraction')
    ));

  // DELETE
  await db.delete(promptBind)
    .where(and(
      eq(promptBind.appFeature, 'extraction'),
      eq(promptBind.metricId, testIds.metricId),
      eq(promptBind.promptType, 'extraction')
    ));
}

async function validateEncounterContext() {
  // INSERT
  await db.insert(encounterContext).values({
    encounterId: testIds.encounterId,
    patientId: testIds.patientId,
    mrn: 'MRN123456',
    context: {
      admission_date: '2025-11-01',
      diagnosis: 'Hip fracture',
    },
    payloadVersion: '1.0',
  });

  // SELECT
  const rows = await db.select().from(encounterContext)
    .where(eq(encounterContext.encounterId, testIds.encounterId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(encounterContext)
    .set({ mrn: 'UPDATED_MRN' })
    .where(eq(encounterContext.encounterId, testIds.encounterId));

  // DELETE tested at end for FK dependencies
}

async function validateCase() {
  // INSERT
  await db.insert(caseTable).values({
    caseId: testIds.caseId,
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
    specialty: 'ORTHO',
    moduleCode: 'hip_fracture',
    caseState: 'OPEN',
    stateComment: 'Test case',
  });

  // SELECT
  const rows = await db.select().from(caseTable)
    .where(eq(caseTable.caseId, testIds.caseId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(caseTable)
    .set({ caseState: 'IN_PROGRESS' })
    .where(eq(caseTable.caseId, testIds.caseId));

  // DELETE tested at end for FK dependencies
}

async function validateAiRun() {
  // INSERT
  await db.insert(aiRun).values({
    runId: testIds.runId,
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
    caseId: testIds.caseId,
    mode: 'extraction',
    status: 'COMPLETED',
    inputSnapshot: { test: 'data' },
    inputHash: 'hash123',
    promptType: 'extraction',
    promptVersion: '1.0',
    modelId: 'gpt-4',
    params: { temperature: 0.7 },
  });

  // SELECT
  const rows = await db.select().from(aiRun)
    .where(eq(aiRun.runId, testIds.runId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(aiRun)
    .set({ status: 'VALIDATED' })
    .where(eq(aiRun.runId, testIds.runId));

  // DELETE tested at end for FK dependencies
}

async function validateAiResponse() {
  // INSERT
  await db.insert(aiResponse).values({
    runId: testIds.runId,
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
    mode: 'extraction',
    response: { signals: [], findings: [] },
    tokens: 1500,
    cost: '0.045',
  });

  // SELECT
  const rows = await db.select().from(aiResponse)
    .where(eq(aiResponse.runId, testIds.runId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(aiResponse)
    .set({ tokens: 2000 })
    .where(eq(aiResponse.runId, testIds.runId));

  // DELETE
  await db.delete(aiResponse)
    .where(eq(aiResponse.runId, testIds.runId));
}

async function validateSignalLedger() {
  // INSERT
  await db.insert(signalLedger).values({
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
    signalCode: 'test_signal',
    metricId: testIds.metricId,
    value: { detected: true },
    confidence: '0.95',
    startTs: new Date('2025-11-01'),
  });

  // SELECT
  const rows = await db.select().from(signalLedger)
    .where(and(
      eq(signalLedger.patientId, testIds.patientId),
      eq(signalLedger.encounterId, testIds.encounterId),
      eq(signalLedger.signalCode, 'test_signal')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(signalLedger)
    .set({ confidence: '0.98' })
    .where(and(
      eq(signalLedger.patientId, testIds.patientId),
      eq(signalLedger.encounterId, testIds.encounterId),
      eq(signalLedger.signalCode, 'test_signal')
    ));

  // DELETE
  await db.delete(signalLedger)
    .where(and(
      eq(signalLedger.patientId, testIds.patientId),
      eq(signalLedger.encounterId, testIds.encounterId),
      eq(signalLedger.signalCode, 'test_signal')
    ));
}

async function validateEvidence() {
  // INSERT
  await db.insert(evidence).values({
    evidenceId: testIds.evidenceId,
    patientId: testIds.patientId,
    runId: testIds.runId,
    encounterId: testIds.encounterId,
    signalCode: 'test_signal',
    citeType: 'note',
    citeRef: 'progress_note_123',
    span: { start: 0, end: 100 },
    rawExcerpt: 'Test clinical note excerpt',
  });

  // SELECT
  const rows = await db.select().from(evidence)
    .where(eq(evidence.evidenceId, testIds.evidenceId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(evidence)
    .set({ citeType: 'lab' })
    .where(eq(evidence.evidenceId, testIds.evidenceId));

  // DELETE
  await db.delete(evidence)
    .where(eq(evidence.evidenceId, testIds.evidenceId));
}

async function validateFeedback() {
  // INSERT
  await db.insert(feedback).values({
    feedbackId: testIds.feedbackId,
    caseId: testIds.caseId,
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
    runId: testIds.runId,
    mode: 'extraction',
    rating: '5',
    label: 'accurate',
    comment: 'Test feedback',
  });

  // SELECT
  const rows = await db.select().from(feedback)
    .where(eq(feedback.feedbackId, testIds.feedbackId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(feedback)
    .set({ rating: '4' })
    .where(eq(feedback.feedbackId, testIds.feedbackId));

  // DELETE
  await db.delete(feedback)
    .where(eq(feedback.feedbackId, testIds.feedbackId));
}

async function validateTestSuite() {
  // INSERT
  await db.insert(testSuite).values({
    suiteId: testIds.suiteId,
    name: 'Test Suite',
    owner: 'test_user',
  });

  // SELECT
  const rows = await db.select().from(testSuite)
    .where(eq(testSuite.suiteId, testIds.suiteId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(testSuite)
    .set({ name: 'Updated Test Suite' })
    .where(eq(testSuite.suiteId, testIds.suiteId));

  // DELETE tested at end for FK dependencies
}

async function validateTestCase() {
  // INSERT
  await db.insert(testCase).values({
    testCaseId: testIds.testCaseId,
    suiteId: testIds.suiteId,
    title: 'Test Case Title',
    fixture: { patient_data: {}, expected: [] },
    expectedSignals: ['signal1', 'signal2'],
  });

  // SELECT
  const rows = await db.select().from(testCase)
    .where(eq(testCase.testCaseId, testIds.testCaseId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(testCase)
    .set({ title: 'Updated Title' })
    .where(eq(testCase.testCaseId, testIds.testCaseId));

  // DELETE tested at end for FK dependencies
}

async function validateTestRun() {
  // INSERT
  await db.insert(testRun).values({
    testRunId: testIds.testRunId,
    suiteId: testIds.suiteId,
    mode: 'extraction',
    modelId: 'gpt-4',
    promptVersion: '1.0',
    params: { temperature: 0.7 },
    status: 'COMPLETED',
  });

  // SELECT
  const rows = await db.select().from(testRun)
    .where(eq(testRun.testRunId, testIds.testRunId));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(testRun)
    .set({ status: 'ANALYZED' })
    .where(eq(testRun.testRunId, testIds.testRunId));

  // DELETE tested at end for FK dependencies
}

async function validateTestAssertion() {
  // INSERT
  await db.insert(testAssertion).values({
    testRunId: testIds.testRunId,
    testCaseId: testIds.testCaseId,
    assertion: 'signal_detected',
    expected: { signal: 'test_signal' },
    actual: { signal: 'test_signal' },
    pass: true,
    patientId: testIds.patientId,
    encounterId: testIds.encounterId,
  });

  // SELECT
  const rows = await db.select().from(testAssertion)
    .where(and(
      eq(testAssertion.testRunId, testIds.testRunId),
      eq(testAssertion.testCaseId, testIds.testCaseId),
      eq(testAssertion.assertion, 'signal_detected')
    ));
  if (rows.length !== 1) throw new Error('SELECT failed');

  // UPDATE
  await db.update(testAssertion)
    .set({ pass: false })
    .where(and(
      eq(testAssertion.testRunId, testIds.testRunId),
      eq(testAssertion.testCaseId, testIds.testCaseId),
      eq(testAssertion.assertion, 'signal_detected')
    ));

  // DELETE
  await db.delete(testAssertion)
    .where(and(
      eq(testAssertion.testRunId, testIds.testRunId),
      eq(testAssertion.testCaseId, testIds.testCaseId),
      eq(testAssertion.assertion, 'signal_detected')
    ));
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  // Delete in reverse dependency order
  await db.delete(testAssertion)
    .where(eq(testAssertion.testRunId, testIds.testRunId));
  await db.delete(testRun)
    .where(eq(testRun.testRunId, testIds.testRunId));
  await db.delete(testCase)
    .where(eq(testCase.testCaseId, testIds.testCaseId));
  await db.delete(testSuite)
    .where(eq(testSuite.suiteId, testIds.suiteId));

  await db.delete(aiRun)
    .where(eq(aiRun.runId, testIds.runId));
  await db.delete(caseTable)
    .where(eq(caseTable.caseId, testIds.caseId));
  await db.delete(encounterContext)
    .where(eq(encounterContext.encounterId, testIds.encounterId));
  await db.delete(metric)
    .where(eq(metric.metricId, testIds.metricId));

  console.log('   ✅ Cleanup complete');
}

async function main() {
  console.log('🔍 Validating v9.2 Database Schema\n');
  console.log('Testing CRUD operations on all 19 tables...');

  const results: boolean[] = [];

  // Configuration tables
  console.log('\n📋 Configuration Tables (8):');
  results.push(await validateTable('1️⃣  metric', validateMetric));
  results.push(await validateTable('2️⃣  signal_group', validateSignalGroup));
  results.push(await validateTable('3️⃣  signal_def', validateSignalDef));
  results.push(await validateTable('4️⃣  followup', validateFollowup));
  results.push(await validateTable('5️⃣  display_plan', validateDisplayPlan));
  results.push(await validateTable('6️⃣  provenance_rule', validateProvenanceRule));
  results.push(await validateTable('7️⃣  prompt', validatePrompt));
  results.push(await validateTable('8️⃣  prompt_bind', validatePromptBind));

  // Runtime tables
  console.log('\n⚡ Runtime Tables (7):');
  results.push(await validateTable('9️⃣  encounter_context', validateEncounterContext));
  results.push(await validateTable('🔟 case', validateCase));
  results.push(await validateTable('1️⃣1️⃣ ai_run', validateAiRun));
  results.push(await validateTable('1️⃣2️⃣ ai_response', validateAiResponse));
  results.push(await validateTable('1️⃣3️⃣ signal_ledger', validateSignalLedger));
  results.push(await validateTable('1️⃣4️⃣ evidence', validateEvidence));
  results.push(await validateTable('1️⃣5️⃣ feedback', validateFeedback));

  // Test tables
  console.log('\n🧪 Test Tables (4):');
  results.push(await validateTable('1️⃣6️⃣ test_suite', validateTestSuite));
  results.push(await validateTable('1️⃣7️⃣ test_case', validateTestCase));
  results.push(await validateTable('1️⃣8️⃣ test_run', validateTestRun));
  results.push(await validateTable('1️⃣9️⃣ test_assertion', validateTestAssertion));

  // Cleanup
  await cleanup();

  // Summary
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;

  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary:');
  console.log(`   ✅ Passed: ${passed}/19 tables`);
  console.log(`   ❌ Failed: ${failed}/19 tables`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✅ All database validations passed!');
    console.log('✅ Database is ready for development\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed. Please check errors above.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error during validation:', error);
  process.exit(1);
});
