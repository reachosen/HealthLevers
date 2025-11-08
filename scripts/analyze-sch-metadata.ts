#!/usr/bin/env tsx
/**
 * Analyze SCH Timeliness Metadata
 *
 * Reads metadata from Excel and shows how it maps to UI components
 */

import { excelParser } from '../server/services/excelParser';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzeSchMetadata() {
  console.log('📊 SCH Timeliness Metadata Analysis\n');
  console.log('='.repeat(60));

  // Load Excel file
  const excelPath = path.join(__dirname, '../USNWR_Master_AllMetrics_v4.xlsx');
  await excelParser.loadExcel(excelPath);
  const data = await excelParser.parseAllSheets();

  // Find SCH timeliness metric
  const schMetrics = data.metrics.filter(m =>
    m.specialty === 'Orthopedics' &&
    (m.metric_name.includes('SCH') || m.metric_name.includes('Supracondylar'))
  );

  if (schMetrics.length === 0) {
    console.log('❌ No SCH metric found. Looking for timeliness metrics...\n');
    const orthoMetrics = data.metrics.filter(m => m.specialty === 'Orthopedics');
    console.log(`Found ${orthoMetrics.length} Orthopedics metrics:`);
    orthoMetrics.forEach(m => {
      console.log(`  - ${m.metric_id}: ${m.metric_name}`);
    });
    return;
  }

  const schMetric = schMetrics[0];
  console.log('\n📋 METRIC DEFINITION');
  console.log('='.repeat(60));
  console.log(`Metric ID: ${schMetric.metric_id}`);
  console.log(`Specialty: ${schMetric.specialty}`);
  console.log(`Name: ${schMetric.metric_name}`);
  console.log(`Domain: ${schMetric.domain || 'N/A'}`);
  console.log(`Threshold: ${schMetric.threshold_hours || 'N/A'}`);

  // Get signal groups
  const groups = data.signalGroups.filter(g => g.metric_id === schMetric.metric_id);
  console.log('\n📁 SIGNAL GROUPS');
  console.log('='.repeat(60));
  groups.forEach(g => {
    console.log(`  Group ID: ${g.group_id}`);
    console.log(`    Code: ${g.group_code}`);

    // Get signals in this group
    const signals = data.signalDefs.filter(s =>
      s.metric_id === schMetric.metric_id && s.group_id === g.group_id
    );
    console.log(`    Signals: ${signals.length}`);
    signals.forEach(s => {
      console.log(`      - ${s.signal_code} (severity: ${s.severity || 'N/A'})`);
    });
    console.log('');
  });

  // Get all signals
  const allSignals = data.signalDefs.filter(s => s.metric_id === schMetric.metric_id);
  console.log('\n🔔 ALL SIGNALS');
  console.log('='.repeat(60));
  allSignals.forEach(s => {
    console.log(`Signal: ${s.signal_code}`);
    console.log(`  Group: ${s.group_id || 'ungrouped'}`);
    console.log(`  Severity: ${s.severity || 'N/A'}`);
    console.log(`  Status: ${s.status || 'N/A'}`);
    console.log('');
  });

  // Get display plan
  const displayPlan = data.displayPlans
    .filter(d => d.metric_id === schMetric.metric_id)
    .sort((a, b) => {
      const aOrder = typeof a.order_nbr === 'number' ? a.order_nbr : parseInt(String(a.order_nbr) || '9999');
      const bOrder = typeof b.order_nbr === 'number' ? b.order_nbr : parseInt(String(b.order_nbr) || '9999');
      return aOrder - bOrder;
    });

  console.log('\n🎨 DISPLAY PLAN (ordered by order_nbr)');
  console.log('='.repeat(60));
  displayPlan.forEach(d => {
    const order = typeof d.order_nbr === 'number' ? d.order_nbr : parseInt(String(d.order_nbr) || '9999');
    console.log(`[${order}] ${d.field_name}`);
    console.log(`    Label: ${d.label}`);
    console.log(`    Tier: ${d.tier || 'N/A'}`);
    console.log(`    Visibility: ${d.visibility_cond || 'always'}`);
    console.log('');
  });

  // Get followup questions
  const followups = data.followups.filter(f => f.metric_id === schMetric.metric_id);
  console.log('\n❓ FOLLOWUP QUESTIONS');
  console.log('='.repeat(60));
  followups.forEach(f => {
    console.log(`ID: ${f.followup_id}`);
    console.log(`  Question: ${f.question_text}`);
    console.log(`  When: ${f.when_cond || 'always'}`);
    console.log(`  Response Type: ${f.response_type || 'text'}`);
    console.log('');
  });

  // Get prompts
  const prompts = data.prompts.filter(p => p.metric_id === schMetric.metric_id);
  console.log('\n💬 PROMPTS');
  console.log('='.repeat(60));
  prompts.forEach(p => {
    console.log(`Type: ${p.prompt_type}`);
    console.log(`  Persona: ${p.persona || 'N/A'}`);
    console.log(`  Purpose: ${p.purpose || 'N/A'}`);
    console.log(`  Text (first 100 chars): ${p.prompt_text.substring(0, 100)}...`);
    console.log('');
  });

  // Get provenance rules
  const provenance = data.provenanceRules.filter(p => p.metric_id === schMetric.metric_id);
  console.log('\n🔍 PROVENANCE RULES');
  console.log('='.repeat(60));
  provenance.forEach(p => {
    console.log(`Field: ${p.field_name}`);
    console.log(`  Table: ${p.table_name || 'N/A'}`);
    console.log(`  Key: ${p.key_name || 'N/A'}`);
    console.log(`  Field Ref: ${p.field_ref || 'N/A'}`);
    console.log('');
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Analysis Complete');
  console.log('='.repeat(60));
}

analyzeSchMetadata().catch(console.error);
