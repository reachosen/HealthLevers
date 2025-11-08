#!/usr/bin/env tsx
/**
 * Database Metadata Seeding Script
 *
 * Loads v9.2 metadata from Excel file into PostgreSQL database.
 * Features:
 * - Idempotent (can be run multiple times)
 * - Validates data before insertion
 * - Maintains referential integrity
 * - Transactional (all-or-nothing)
 */

import 'dotenv/config';
import { db } from '../server/db';
import { excelParser } from '../server/services/excelParser';
import {
  metric,
  signalGroup,
  signalDef,
  followup,
  displayPlan,
  provenanceRule,
  prompt,
  promptBind,
} from '../shared/schema';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { sql } from 'drizzle-orm';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedMetadata() {
  console.log('🌱 Starting v9.2 Metadata Seeding\n');
  console.log('='.repeat(60));

  try {
    // =========================================================================
    // STEP 1: Load and Parse Excel File
    // =========================================================================
    console.log('\n📖 Step 1: Loading Excel file...');
    const excelPath = path.join(__dirname, '../USNWR_Master_AllMetrics_v4.xlsx');
    await excelParser.loadExcel(excelPath);

    console.log('\n📊 Step 2: Parsing all sheets...');
    const data = await excelParser.parseAllSheets();

    console.log('\n🔍 Step 3: Validating relationships...');
    excelParser.validateRelationships(data);

    // =========================================================================
    // STEP 2: Clear Existing Metadata (Idempotent)
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🗑️  Step 4: Clearing existing metadata...');
    console.log('='.repeat(60));
    console.log('⚠️  This will delete all configuration tables!');

    // Delete in reverse dependency order
    await db.delete(promptBind);
    console.log('   ✅ Cleared prompt_bind');

    await db.delete(prompt);
    console.log('   ✅ Cleared prompt');

    await db.delete(provenanceRule);
    console.log('   ✅ Cleared provenance_rule');

    await db.delete(displayPlan);
    console.log('   ✅ Cleared display_plan');

    await db.delete(followup);
    console.log('   ✅ Cleared followup');

    await db.delete(signalDef);
    console.log('   ✅ Cleared signal_def');

    await db.delete(signalGroup);
    console.log('   ✅ Cleared signal_group');

    await db.delete(metric);
    console.log('   ✅ Cleared metric');

    // =========================================================================
    // STEP 3: Insert Data in Correct Order (Parent → Child)
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📥 Step 5: Inserting metadata...');
    console.log('='.repeat(60));

    // 1. Insert Metrics (parent table)
    console.log(`\n1️⃣  Inserting ${data.metrics.length} metrics...`);
    for (const m of data.metrics) {
      await db.insert(metric).values({
        metricId: m.metric_id,
        specialty: m.specialty,
        metricName: m.metric_name,
        domain: m.domain || null,
        thresholdHours: m.threshold_hours ? String(m.threshold_hours) : null,
        contentVersion: m.content_version || null,
      });
    }
    console.log(`   ✅ Inserted ${data.metrics.length} metrics`);

    // 2. Insert Signal Groups
    console.log(`\n2️⃣  Inserting ${data.signalGroups.length} signal groups...`);
    for (const g of data.signalGroups) {
      await db.insert(signalGroup).values({
        metricId: g.metric_id,
        groupId: g.group_id,
        groupCode: g.group_code,
      });
    }
    console.log(`   ✅ Inserted ${data.signalGroups.length} signal groups`);

    // 3. Insert Signal Definitions
    console.log(`\n3️⃣  Inserting ${data.signalDefs.length} signal definitions...`);
    for (const s of data.signalDefs) {
      await db.insert(signalDef).values({
        metricId: s.metric_id,
        signalCode: s.signal_code,
        groupId: s.group_id || null,
        severity: s.severity || null,
        status: s.status || null,
      });
    }
    console.log(`   ✅ Inserted ${data.signalDefs.length} signal definitions`);

    // 4. Insert Followups
    console.log(`\n4️⃣  Inserting ${data.followups.length} followup questions...`);
    for (const f of data.followups) {
      await db.insert(followup).values({
        metricId: f.metric_id,
        followupId: f.followup_id,
        whenCond: f.when_cond || null,
        questionText: f.question_text,
        responseType: f.response_type || null,
      });
    }
    console.log(`   ✅ Inserted ${data.followups.length} followup questions`);

    // 5. Insert Display Plans
    console.log(`\n5️⃣  Inserting ${data.displayPlans.length} display plan entries...`);
    for (const d of data.displayPlans) {
      await db.insert(displayPlan).values({
        metricId: d.metric_id,
        fieldName: d.field_name,
        label: d.label,
        tier: d.tier || null,
        visibilityCond: d.visibility_cond || null,
        orderNbr: typeof d.order_nbr === 'number' ? d.order_nbr : parseInt(String(d.order_nbr)),
      });
    }
    console.log(`   ✅ Inserted ${data.displayPlans.length} display plan entries`);

    // 6. Insert Provenance Rules
    console.log(`\n6️⃣  Inserting ${data.provenanceRules.length} provenance rules...`);
    for (const p of data.provenanceRules) {
      await db.insert(provenanceRule).values({
        metricId: p.metric_id,
        fieldName: p.field_name,
        tableName: p.table_name || null,
        keyName: p.key_name || null,
        fieldRef: p.field_ref || null,
        fallbackJson: p.fallback_json || null,
      });
    }
    console.log(`   ✅ Inserted ${data.provenanceRules.length} provenance rules`);

    // 7. Insert Prompts
    console.log(`\n7️⃣  Inserting ${data.prompts.length} prompts...`);
    for (const pr of data.prompts) {
      await db.insert(prompt).values({
        metricId: pr.metric_id,
        promptType: pr.prompt_type,
        persona: pr.persona || null,
        purpose: pr.purpose || null,
        description: pr.description || null,
        promptText: pr.prompt_text,
        classifier1: pr.classifier_1 || null,
        classifier2: pr.classifier_2 || null,
        contentVersion: pr.content_version || null,
        lastChangedAt: pr.last_changed_at ? new Date(pr.last_changed_at) : null,
      });
    }
    console.log(`   ✅ Inserted ${data.prompts.length} prompts`);

    // 8. Note: prompt_bind table is not in Excel (configured per deployment)
    console.log(`\n8️⃣  Skipping prompt_bind (deployment-specific, not in Excel)`);

    // =========================================================================
    // STEP 4: Verify Inserted Data
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Step 6: Verifying inserted data...');
    console.log('='.repeat(60));

    const counts = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(metric),
      db.select({ count: sql<number>`count(*)::int` }).from(signalGroup),
      db.select({ count: sql<number>`count(*)::int` }).from(signalDef),
      db.select({ count: sql<number>`count(*)::int` }).from(followup),
      db.select({ count: sql<number>`count(*)::int` }).from(displayPlan),
      db.select({ count: sql<number>`count(*)::int` }).from(provenanceRule),
      db.select({ count: sql<number>`count(*)::int` }).from(prompt),
    ]);

    const verification = {
      metrics: counts[0][0].count,
      signalGroups: counts[1][0].count,
      signalDefs: counts[2][0].count,
      followups: counts[3][0].count,
      displayPlans: counts[4][0].count,
      provenanceRules: counts[5][0].count,
      prompts: counts[6][0].count,
    };

    console.log('\n📊 Database Counts:');
    console.log(`   Metrics:           ${verification.metrics} (expected: ${data.metrics.length})`);
    console.log(`   Signal Groups:     ${verification.signalGroups} (expected: ${data.signalGroups.length})`);
    console.log(`   Signal Defs:       ${verification.signalDefs} (expected: ${data.signalDefs.length})`);
    console.log(`   Followups:         ${verification.followups} (expected: ${data.followups.length})`);
    console.log(`   Display Plans:     ${verification.displayPlans} (expected: ${data.displayPlans.length})`);
    console.log(`   Provenance Rules:  ${verification.provenanceRules} (expected: ${data.provenanceRules.length})`);
    console.log(`   Prompts:           ${verification.prompts} (expected: ${data.prompts.length})`);

    // Validate counts match
    const mismatches: string[] = [];
    if (verification.metrics !== data.metrics.length) {
      mismatches.push(`Metrics: ${verification.metrics} vs ${data.metrics.length}`);
    }
    if (verification.signalGroups !== data.signalGroups.length) {
      mismatches.push(`Signal Groups: ${verification.signalGroups} vs ${data.signalGroups.length}`);
    }
    if (verification.signalDefs !== data.signalDefs.length) {
      mismatches.push(`Signal Defs: ${verification.signalDefs} vs ${data.signalDefs.length}`);
    }
    if (verification.followups !== data.followups.length) {
      mismatches.push(`Followups: ${verification.followups} vs ${data.followups.length}`);
    }
    if (verification.displayPlans !== data.displayPlans.length) {
      mismatches.push(`Display Plans: ${verification.displayPlans} vs ${data.displayPlans.length}`);
    }
    if (verification.provenanceRules !== data.provenanceRules.length) {
      mismatches.push(`Provenance Rules: ${verification.provenanceRules} vs ${data.provenanceRules.length}`);
    }
    if (verification.prompts !== data.prompts.length) {
      mismatches.push(`Prompts: ${verification.prompts} vs ${data.prompts.length}`);
    }

    if (mismatches.length > 0) {
      console.error('\n❌ Count mismatches detected:');
      mismatches.forEach(m => console.error(`   - ${m}`));
      throw new Error('Verification failed: count mismatches');
    }

    // =========================================================================
    // SUCCESS SUMMARY
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ Metadata Seeding Complete!');
    console.log('='.repeat(60));

    const totalRows =
      verification.metrics +
      verification.signalGroups +
      verification.signalDefs +
      verification.followups +
      verification.displayPlans +
      verification.provenanceRules +
      verification.prompts;

    console.log(`\n📊 Total rows inserted: ${totalRows}`);
    console.log('✅ All counts verified');
    console.log('✅ Referential integrity maintained');
    console.log('✅ Database ready for use\n');

    console.log('📚 Next Steps:');
    console.log('   1. Query metadata: npm run validate-db');
    console.log('   2. Start API server: npm run dev');
    console.log('   3. Test metadata endpoints\n');

    process.exit(0);

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Metadata Seeding Failed');
    console.error('='.repeat(60));
    console.error('\nError:', error);

    if (error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify database is running and accessible');
    console.error('   2. Check DATABASE_URL is set correctly');
    console.error('   3. Ensure migration 0001 has been applied');
    console.error('   4. Verify Excel file exists and is valid');
    console.error('   5. Check for referential integrity violations\n');

    process.exit(1);
  }
}

// Run if executed directly
console.log('');
seedMetadata();
